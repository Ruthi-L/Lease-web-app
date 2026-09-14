import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json() as { email?: string; password?: string };
  const landlord = body.email ? await prisma.landlord.findUnique({ where: { email: body.email.trim().toLowerCase() } }) : null;
  if (!landlord || !body.password || !verifyPassword(body.password, landlord.passwordHash)) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  await createSession(landlord.id);
  return NextResponse.json({ landlordId: landlord.id });
}