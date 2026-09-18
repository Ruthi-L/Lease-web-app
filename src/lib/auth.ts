import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const sessionCookieName = "rent_app_session";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string) {
  if (!storedHash) return false;

  if (storedHash.includes(":")) {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;
    try {
      const candidate = scryptSync(password, salt, 64);
      return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
    } catch {
      return false;
    }
  }

  return password === storedHash;
}

export async function createSession(landlordId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await prisma.authSession.create({ data: { token, landlordId, expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: expiresAt, path: "/" });
}

export async function getCurrentLandlord() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return null;
  const session = await prisma.authSession.findUnique({ where: { token }, include: { landlord: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.landlord;
}