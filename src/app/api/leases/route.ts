import { randomBytes, scryptSync } from "node:crypto";
import { NextResponse } from "next/server";
import { LeaseStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, getCurrentLandlord } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";

type TenantInput = { firstName: string; initial?: string; lastName: string; email: string; phone: string; dateOfBirth: string };
type LeasePayload = {
  landlord: { name: string; email: string; phone: string; civicAddress: string; password: string };
  sections: Record<string, Record<string, string>>;
  tenants: TenantInput[];
};

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function isMinorFromDate(dateOfBirth: Date) {
  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const birthdayPassed = today.getUTCMonth() > dateOfBirth.getUTCMonth() || (today.getUTCMonth() === dateOfBirth.getUTCMonth() && today.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!birthdayPassed) age -= 1;
  return age < 18;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LeasePayload;
    if (!payload.landlord?.name || !payload.landlord.email || !payload.landlord.password) {
      return NextResponse.json({ error: "Landlord name, email, and password are required." }, { status: 400 });
    }
    if (!payload.tenants?.length) {
      return NextResponse.json({ error: "Add at least one tenant or occupant before submitting." }, { status: 400 });
    }

    const adultCount = payload.tenants.filter((tenant) => !isMinorFromDate(new Date(`${tenant.dateOfBirth}T00:00:00.000Z`))).length;
    let adultIndex = 0;
    const tenantData = payload.tenants.map((tenant) => {
      const dateOfBirth = new Date(`${tenant.dateOfBirth}T00:00:00.000Z`);
      const isMinor = isMinorFromDate(dateOfBirth);
      const accessToken = isMinor ? null : randomBytes(32).toString("hex");
      adultIndex += isMinor ? 0 : 1;
      return {
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        email: tenant.email,
        phone: tenant.phone || null,
        dateOfBirth,
        isMinor,
        accessToken,
        sectionData: { role: isMinor ? "Occupant" : "Tenant", hasSigningRights: !isMinor, signingOrder: isMinor ? null : adultIndex, initial: tenant.initial ?? "" },
      };
    });

    const currentLandlord = await getCurrentLandlord();
    const lease = await prisma.$transaction(async (transaction) => {
      const landlord = currentLandlord ?? await transaction.landlord.upsert({
        where: { email: payload.landlord.email.trim().toLowerCase() },
        update: { name: payload.landlord.name, phone: payload.landlord.phone || null, civicAddress: payload.landlord.civicAddress || null },
        create: { name: payload.landlord.name, email: payload.landlord.email.trim().toLowerCase(), passwordHash: hashPassword(payload.landlord.password), phone: payload.landlord.phone || null, civicAddress: payload.landlord.civicAddress || null },
      });

      return transaction.lease.create({
        data: { landlordId: landlord.id, status: adultCount ? LeaseStatus.PENDING_TENANTS : LeaseStatus.PENDING_LANDLORD, formData: payload.sections, tenants: { create: tenantData } },
        include: { tenants: true },
      });
    });
    if (!currentLandlord) await createSession(lease.landlordId);

    const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const signingLinks = lease.tenants.filter((tenant) => tenant.accessToken).map((tenant) => ({ tenantId: tenant.id, name: `${tenant.firstName} ${tenant.lastName}`, phone: tenant.phone, email: tenant.email, url: `/tenant/sign/${tenant.accessToken}`, pending: !tenant.signed_at }));
    const emailResults = await Promise.all(signingLinks.map(async (link) => {
      const tenant = lease.tenants.find((candidate) => candidate.id === link.tenantId);
      if (!tenant) return { sent: false, error: "Tenant record not found." };
      try {
        await sendEmail(tenant.email, "Your rental application is ready to complete", `Hello ${tenant.firstName},\n\nPlease complete and sign your rental application here:\n${baseUrl}/tenant/sign/${tenant.accessToken}\n\nThis secure link is unique to you.`);
        await prisma.tenant.update({ where: { id: tenant.id }, data: { invitationSentAt: new Date() } });
        return { sent: true };
      } catch (emailError) {
        console.error(`Invitation email failed for ${tenant.email}`, emailError);
        return { sent: false, error: emailError instanceof Error ? emailError.message : "Email delivery failed." };
      }
    }));
    const failedEmails = emailResults.filter((result) => !result.sent);
    if (failedEmails.length) return NextResponse.json({ leaseId: lease.id, signingLinks, error: failedEmails[0].error, emailDeliveryFailed: true }, { status: 502 });
    return NextResponse.json({ leaseId: lease.id, signingLinks }, { status: 201 });
  } catch (error) {
    console.error("Lease creation failed", error);
    return NextResponse.json({ error: "Unable to save this lease right now." }, { status: 500 });
  }
}