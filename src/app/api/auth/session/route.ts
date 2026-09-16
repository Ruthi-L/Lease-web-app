import { NextResponse } from "next/server";
import { getCurrentLandlord } from "@/lib/auth";

export async function GET() {
  const landlord = await getCurrentLandlord();
  return NextResponse.json({ authenticated: Boolean(landlord), landlord: landlord ? { id: landlord.id, name: landlord.name, email: landlord.email } : null });
}
