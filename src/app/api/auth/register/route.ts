import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; email?: string; password?: string; phone?: string; civicAddress?: string };
    if (!body.name || !body.email || !body.password || body.password.length < 8) return NextResponse.json({ error: "Name, email, and a password of at least 8 characters are required." }, { status: 400 });
    const landlord = await prisma.landlord.create({ data: { name: body.name.trim(), email: body.email.trim().toLowerCase(), passwordHash: hashPassword(body.password), phone: body.phone || null, civicAddress: body.civicAddress || null } });
    await createSession(landlord.id);
    return NextResponse.json({ landlordId: landlord.id }, { status: 201 });
  } catch (error) {
    console.error("Registration failed", error);
    return NextResponse.json({ error: "An account with that email may already exist." }, { status: 409 });
  }
}