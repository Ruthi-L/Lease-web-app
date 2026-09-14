import { NextResponse } from "next/server";
import { getCurrentLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ leaseId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const landlord = await getCurrentLandlord();
  if (!landlord) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { leaseId } = await params;
  const body = await request.json() as { signatureData?: string };
  if (!body.signatureData?.startsWith("data:image/png;base64,")) return NextResponse.json({ error: "A saved signature is required." }, { status: 400 });
  const lease = await prisma.lease.findFirst({ where: { id: leaseId, landlordId: landlord.id }, include: { tenants: true } });
  if (!lease) return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  const updatedLease = await prisma.lease.update({ where: { id: lease.id }, data: { landlordSignatureData: body.signatureData, landlordSignedAt: new Date(), status: lease.tenants.some((tenant) => !tenant.isMinor && !tenant.signed_at) ? "PENDING_TENANTS" : "COMPLETED" } });
  return NextResponse.json({ signedAt: updatedLease.landlordSignedAt });
}