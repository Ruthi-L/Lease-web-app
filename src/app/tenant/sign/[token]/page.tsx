import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TenantSigningForm from "@/components/tenant-signing-form";

export const dynamic = "force-dynamic";

type TenantSignPageProps = {
  params: Promise<{ token: string }>;
};

export default async function TenantSignPage({ params }: TenantSignPageProps) {
  const { token } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { accessToken: token },
    include: { lease: true },
  });

  if (!tenant || tenant.isMinor) notFound();

  return (
    <TenantSigningForm
      token={token}
      tenant={{
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        email: tenant.email,
        signedAt: tenant.signed_at?.toISOString() ?? null,
        signatureData: tenant.signatureData,
      }}
      leaseCreatedAt={tenant.lease.createdAt.toISOString()}
    />
  );
}