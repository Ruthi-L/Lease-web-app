import { NextResponse } from "next/server";
import { getCurrentLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildLeasePdfAttachment, sendEmail } from "@/lib/mail";

type RouteContext = { params: Promise<{ leaseId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const landlord = await getCurrentLandlord();
  if (!landlord) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { leaseId } = await params;
  const body = await request.json() as { signatureData?: string };
  if (!body.signatureData?.startsWith("data:image/png;base64,")) return NextResponse.json({ error: "A saved signature is required." }, { status: 400 });
  const lease = await prisma.lease.findFirst({ where: { id: leaseId, landlordId: landlord.id }, include: { tenants: true, landlord: true } });
  if (!lease) return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  const allAdultTenantsSigned = lease.tenants.filter((tenant) => !tenant.isMinor).every((tenant) => tenant.signed_at);
  const updatedLease = await prisma.lease.update({ where: { id: lease.id }, data: { landlordSignatureData: body.signatureData, landlordSignedAt: new Date(), status: allAdultTenantsSigned ? "COMPLETED" : "PENDING_TENANTS" } });

  if (allAdultTenantsSigned) {
    const attachment = await buildLeasePdfAttachment({
      id: updatedLease.id,
      createdAt: updatedLease.createdAt,
      landlord: { name: lease.landlord.name, email: lease.landlord.email },
      formData: updatedLease.formData,
      tenants: lease.tenants.map((tenant) => ({ firstName: tenant.firstName, lastName: tenant.lastName, email: tenant.email, isMinor: tenant.isMinor })),
    });

    await Promise.all([
      sendEmail(landlord.email, "Signed lease agreement", "All required parties have signed the lease. Please find the final PDF attached.", [attachment]),
      ...lease.tenants.filter((tenant) => !tenant.isMinor).map((tenant) => sendEmail(tenant.email, "Signed lease agreement", "All required parties have signed the lease. Please find the final PDF attached.", [attachment]))
    ]);
  }

  return NextResponse.json({ signedAt: updatedLease.landlordSignedAt });
}