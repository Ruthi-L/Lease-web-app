import twilio from "twilio";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type NotificationPayload = { tenantId?: string };

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function POST(request: Request) {
  try {
    const { tenantId } = (await request.json()) as NotificationPayload;
    if (!tenantId) return NextResponse.json({ error: "tenantId is required." }, { status: 400 });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { lease: true } });
    if (!tenant || tenant.isMinor || !tenant.accessToken) return NextResponse.json({ error: "Pending adult tenant not found." }, { status: 404 });
    if (tenant.signed_at) return NextResponse.json({ error: "This tenant has already signed the lease." }, { status: 409 });
    if (!tenant.phone) return NextResponse.json({ error: "This tenant does not have a phone number." }, { status: 400 });

    const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
    const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
    const fromPhone = requiredEnv("TWILIO_FROM_PHONE");
    const fromWhatsApp = requiredEnv("TWILIO_WHATSAPP_FROM");
    const whatsappContentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;
    const smsContentSid = process.env.TWILIO_SMS_CONTENT_SID;
    const client = twilio(accountSid, authToken);
    const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const link = `${baseUrl}/tenant/sign/${tenant.accessToken}`;
    const body = `Your lease is ready to sign: ${link}`;

    const channels = await Promise.all([
      client.messages.create({ ...(smsContentSid ? { contentSid: smsContentSid, contentVariables: JSON.stringify({ "1": link }) } : { body }), from: fromPhone, to: tenant.phone }).then(() => ({ channel: "sms", sent: true })).catch((error: unknown) => ({ channel: "sms", sent: false, error: twilioErrorMessage(error) })),
      (whatsappContentSid ? client.messages.create({ contentSid: whatsappContentSid, contentVariables: JSON.stringify({ "1": link }), from: `whatsapp:${fromWhatsApp.replace(/^whatsapp:/, "")}`, to: `whatsapp:${tenant.phone}` }) : Promise.reject(new Error("TWILIO_WHATSAPP_CONTENT_SID is not configured"))).then(() => ({ channel: "whatsapp", sent: true })).catch((error: unknown) => ({ channel: "whatsapp", sent: false, error: twilioErrorMessage(error) })),
    ]);

    return NextResponse.json({ sent: channels.some((channel) => channel.sent), channels }, { status: channels.some((channel) => channel.sent) ? 200 : 502 });
  } catch (error) {
    console.error("Tenant notification failed", error);
    const message = error instanceof Error && error.message.endsWith("is not configured") ? error.message : "Unable to send tenant notifications.";
    return NextResponse.json({ error: message }, { status: message.endsWith("is not configured") ? 503 : 502 });
  }
}

function twilioErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.endsWith("is not configured")) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
  return "Twilio rejected this message.";
}