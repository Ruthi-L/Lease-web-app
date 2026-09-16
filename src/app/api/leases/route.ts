import { randomBytes, scryptSync } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentLandlord } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";
import { normalizeFormPData } from "@/lib/form-p";

type TenantInput = { firstName: string; initial?: string; lastName: string; email: string; phone: string; dateOfBirth: string; isMinor: boolean };
type LeasePayload = {
  landlord: { name: string; email: string; phone?: string; phoneHome?: string; phoneBusiness?: string; civicAddress: string; mailingAddress?: string; password?: string };
  sections: Record<string, Record<string, unknown>>;
  tenants: TenantInput[];
};

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LeasePayload;
    const currentLandlord = await getCurrentLandlord();
    if (!payload.landlord?.name || !payload.landlord.email || (!currentLandlord && !payload.landlord.password)) return NextResponse.json({ error: "Landlord name, email, and password are required." }, { status: 400 });
    if (!payload.tenants?.length) {
      return NextResponse.json({ error: "Add at least one tenant or occupant before submitting." }, { status: 400 });
    }

    const adultCount = payload.tenants.filter((tenant) => !tenant.isMinor).length;
    let adultIndex = 0;
    const tenantData = payload.tenants.map((tenant) => {
      const accessToken = tenant.isMinor ? null : randomBytes(32).toString("hex");
      adultIndex += tenant.isMinor ? 0 : 1;
      return {
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        email: tenant.email,
        phone: tenant.phone || null,
        dateOfBirth: new Date(`${tenant.dateOfBirth}T00:00:00.000Z`),
        isMinor: tenant.isMinor,
        accessToken,
        sectionData: { initial: tenant.initial || "", role: tenant.isMinor ? "Occupant" : "Tenant", hasSigningRights: !tenant.isMinor, signingOrder: tenant.isMinor ? null : adultIndex },
      };
    });

    const lease = await prisma.$transaction(async (transaction) => {
      const landlord = currentLandlord ?? await transaction.landlord.upsert({
        where: { email: payload.landlord.email.trim().toLowerCase() },
        update: { name: payload.landlord.name, phone: payload.landlord.phone || null, civicAddress: payload.landlord.civicAddress || null },
        create: { name: payload.landlord.name, email: payload.landlord.email.trim().toLowerCase(), passwordHash: hashPassword(payload.landlord.password ?? ""), phone: payload.landlord.phone || payload.landlord.phoneHome || payload.landlord.phoneBusiness || null, civicAddress: payload.landlord.civicAddress || null },
      });

      return transaction.lease.create({
        data: { landlordId: landlord.id, status: adultCount ? "PENDING_TENANTS" : "PENDING_LANDLORD", formData: normalizeFormPData(payload.sections), tenants: { create: tenantData } },
        include: { tenants: true },
      });
    });

    const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
    await Promise.all(lease.tenants.filter((tenant) => tenant.accessToken).map(async (tenant) => {
      await prisma.tenant.update({ where: { id: tenant.id }, data: { invitationSentAt: new Date() } });
      await sendEmail(tenant.email, "Your rental application is ready to complete", `Hello ${tenant.firstName},\n\nPlease complete and sign your rental application here:\n${baseUrl}/tenant/sign/${tenant.accessToken}\n\nThis secure link is unique to you.`);
    }));
    return NextResponse.json({ leaseId: lease.id, signingLinks: lease.tenants.filter((tenant) => tenant.accessToken).map((tenant) => ({ tenantId: tenant.id, name: `${tenant.firstName} ${tenant.lastName}`, phone: tenant.phone, email: tenant.email, url: `/tenant/sign/${tenant.accessToken}`, pending: !tenant.signed_at })) }, { status: 201 });
  } catch (error) {
    console.error("Lease creation failed", error);
    return NextResponse.json({ error: "Unable to save this lease right now." }, { status: 500 });
  }
}