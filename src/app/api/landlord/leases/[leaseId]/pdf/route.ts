import { NextResponse } from "next/server";
import { getCurrentLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildLeasePdfAttachment } from "@/lib/mail";

type RouteContext = { params: Promise<{ leaseId: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteContext) {
  const landlord = await getCurrentLandlord();
  if (!landlord) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { leaseId } = await params;
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, landlordId: landlord.id },
    include: { landlord: true, tenants: true },
  });
  if (!lease) return NextResponse.json({ error: "Lease not found." }, { status: 404 });

  const attachment = await buildLeasePdfAttachment({
    id: lease.id,
    createdAt: lease.createdAt,
    landlord: { name: lease.landlord.name, email: lease.landlord.email },
    landlordSignatureData: lease.landlordSignatureData,
    landlordSignedAt: lease.landlordSignedAt,
    formData: lease.formData,
    tenants: lease.tenants.map((tenant) => ({
      firstName: tenant.firstName,
      lastName: tenant.lastName,
      email: tenant.email,
      isMinor: tenant.isMinor,
      signatureData: tenant.signatureData,
      signedAt: tenant.signed_at,
    })),
  });

  return new NextResponse(new Uint8Array(attachment.content as Buffer), {
    headers: {
      "Content-Type": attachment.contentType ?? "application/pdf",
      "Content-Disposition": `inline; filename="${attachment.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
