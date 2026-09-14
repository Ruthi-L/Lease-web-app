import { NextResponse } from "next/server";
import { getCurrentLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const landlord = await getCurrentLandlord();
  if (!landlord) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const leases = await prisma.lease.findMany({ where: { landlordId: landlord.id }, include: { tenants: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ leases });
}