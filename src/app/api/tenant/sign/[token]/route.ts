import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildLeasePdfAttachment, sendEmail } from "@/lib/mail";

type SignPayload = {
  emergencyContactName: string;
  emergencyContactPhone: string;
  serviceEmail: string;
  acknowledgeTruth: boolean;
  acknowledgeElectronicDelivery: boolean;
  acknowledgeAgreement: boolean;
  signatureData: string;
};

type RouteContext = { params: Promise<{ token: string }> };

function isPngDataUrl(value: string) {
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= 2_000_000;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { token } = await params;
    const payload = (await request.json()) as SignPayload;
    const tenant = await prisma.tenant.findUnique({ where: { accessToken: token } });

    if (!tenant || tenant.isMinor) {
      return NextResponse.json({ error: "This signing link is invalid or has expired." }, { status: 404 });
    }

    if (!payload.emergencyContactName || !payload.emergencyContactPhone || !payload.serviceEmail || !payload.acknowledgeTruth || !payload.acknowledgeElectronicDelivery || !payload.acknowledgeAgreement || !isPngDataUrl(payload.signatureData)) {
      return NextResponse.json({ error: "Complete all fields and save your signature before submitting." }, { status: 400 });
    }

    const sectionData = (tenant.sectionData && typeof tenant.sectionData === "object" && !Array.isArray(tenant.sectionData) ? tenant.sectionData : {}) as Record<string, unknown>;
    const updatedTenant = await prisma.$transaction(async (transaction) => {
      const signedTenant = await transaction.tenant.update({
        where: { id: tenant.id },
        data: {
          signatureData: payload.signatureData,
          signed_at: new Date(),
          sectionData: {
            ...sectionData,
            signing: {
              emergencyContactName: payload.emergencyContactName.trim(),
              emergencyContactPhone: payload.emergencyContactPhone.trim(),
              serviceEmail: payload.serviceEmail.trim().toLowerCase(),
              acknowledgments: {
                truth: payload.acknowledgeTruth,
                electronicDelivery: payload.acknowledgeElectronicDelivery,
                agreement: payload.acknowledgeAgreement,
              },
            },
          },
        },
      });

      const unsignedAdults = await transaction.tenant.count({ where: { leaseId: tenant.leaseId, isMinor: false, signed_at: null } });
      const lease = await transaction.lease.findUnique({ where: { id: tenant.leaseId }, include: { landlord: true } });
      if (unsignedAdults === 0 && lease?.landlordSignedAt) await transaction.lease.update({ where: { id: tenant.leaseId }, data: { status: "COMPLETED" } });
      return signedTenant;
    });

    const completedLease = await prisma.lease.findUnique({ where: { id: tenant.leaseId }, include: { landlord: true, tenants: true } });
    if (completedLease) {
      await sendEmail(completedLease.landlord.email, "A tenant signed your rental application", `${tenant.firstName} ${tenant.lastName} has completed their signature. Review the application in your landlord dashboard.`);
      const allSigned = completedLease.landlordSignedAt && completedLease.tenants.filter((candidate) => !candidate.isMinor).every((candidate) => candidate.signed_at);
      if (allSigned) {
        const attachment = await buildLeasePdfAttachment({
          id: completedLease.id,
          createdAt: completedLease.createdAt,
          landlord: { name: completedLease.landlord.name, email: completedLease.landlord.email },
          formData: completedLease.formData,
          tenants: completedLease.tenants.map((candidate) => ({ firstName: candidate.firstName, lastName: candidate.lastName, email: candidate.email, isMinor: candidate.isMinor })),
        });

        await Promise.all([
          sendEmail(completedLease.landlord.email, "Signed lease agreement", "All required parties have signed the lease. Please find the final PDF attached.", [attachment]),
          ...completedLease.tenants.filter((candidate) => !candidate.isMinor).map((candidate) => sendEmail(candidate.email, "Signed lease agreement", "All required parties have signed the lease. Please find the final PDF attached.", [attachment]))
        ]);
      }
    }

    return NextResponse.json({ signedAt: updatedTenant.signed_at?.toISOString() });
  } catch (error) {
    console.error("Tenant signing failed", error);
    return NextResponse.json({ error: "Unable to save your signature right now." }, { status: 500 });
  }
}