import "server-only";
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { cookies } from "next/headers";
import { getStore, type ZurvasUser } from "./store";

const COOKIE_NAME = "zurvas_session";
const SESSION_DAYS = 30;

function secret(): string {
  const value = process.env.ZURVAS_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ZURVAS_SECRET (16+ тэмдэгт) тохируулаагүй байна.");
  }
  return "dev-only-zurvas-secret-do-not-use-in-production";
}

export function hmac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// ------------------------------------------------------------------ Нууц үг

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64).toString("base64url");
  return safeEqual(candidate, hash);
}

// -------------------------------------------------------------------- Сесс

export function startSession(userId: string): void {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${userId}.${expires}`;
  cookies().set(COOKIE_NAME, `${payload}.${hmac(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
}

export function endSession(): void {
  cookies().delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<ZurvasUser | null> {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const [userId, expires, signature] = raw.split(".");
  if (!userId || !expires || !signature) return null;
  if (!safeEqual(signature, hmac(`${userId}.${expires}`))) return null;
  if (Number(expires) < Date.now()) return null;

  return getStore().getUserById(userId);
}
