import { redirect } from "next/navigation";
import { getCurrentLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Dashboard from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const landlord = await getCurrentLandlord();
  if (!landlord) redirect("/landlord/login");
  const leases = await prisma.lease.findMany({ where: { landlordId: landlord.id }, include: { tenants: true }, orderBy: { createdAt: "desc" } });
  return <Dashboard landlordName={landlord.name} leases={leases.map((lease) => ({ id: lease.id, status: lease.status, createdAt: lease.createdAt.toISOString(), landlordSignedAt: lease.landlordSignedAt?.toISOString() ?? null, tenants: lease.tenants.map((tenant) => ({ id: tenant.id, name: `${tenant.firstName} ${tenant.lastName}`, email: tenant.email, signedAt: tenant.signed_at?.toISOString() ?? null, isMinor: tenant.isMinor })) }))} />;
}