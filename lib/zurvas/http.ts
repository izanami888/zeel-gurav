import "server-only";
import { NextResponse } from "next/server";
import { hmac } from "./auth";
import { StoreNotConfiguredError } from "./store";

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...data });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Илгээгчийн IP-г хэзээ ч шууд хадгалахгүй — зөвхөн нууц түлхүүрээр
 * хэшлэсэн утгыг хадгална (давтамж хязгаарлах, блоклоход л ашиглана).
 */
export function senderHash(req: Request): string {
  return hmac(`sender:${clientIp(req)}`);
}

/** CSRF-ээс хамгаалах: өөр сайтаас ирсэн POST/PATCH/DELETE-г татгалзана. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // хөтөч биш клиент
  try {
    const host = new URL(origin).host;
    return (
      host === req.headers.get("host") ||
      host === req.headers.get("x-forwarded-host")
    );
  } catch {
    return false;
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

// Нэвтрэх/бүртгүүлэх оролдлогыг хязгаарлах (санах ойд, best-effort —
// serverless орчинд instance бүр тусдаа тоолно).
const attempts = new Map<string, number[]>();

export function tooManyAttempts(key: string, max = 10, windowMs = 600_000) {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 5000) attempts.clear();
  return recent.length > max;
}

/** Route handler-ийг боож, нийтлэг шалгалт + алдааны хариуг нэг мөр болгоно. */
export function handler(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any) => {
    if (!isSameOrigin(req)) return error("Хүсэлт зөвшөөрөгдөөгүй.", 403);
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof StoreNotConfiguredError) {
        return error("Үйлчилгээ хараахан тохируулагдаагүй байна.", 503);
      }
      console.error("[zurvas]", e);
      return error("Алдаа гарлаа. Дахин оролдоно уу.", 500);
    }
  };
}
