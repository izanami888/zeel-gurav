import "server-only";
import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Зөвхөн сервер талд ажиллах өгөгдлийн давхарга.
//  - Supabase тохируулсан бол (URL + service role key) Supabase-д хадгална.
//  - Тохируулаагүй бол зөвхөн хөгжүүлэлтийн үед .data/zurvas.json файлд хадгална.

export interface ZurvasUser {
  id: string;
  username: string;
  prompt: string | null;
  passwordHash: string;
  createdAt: string;
}

export interface ZurvasMessage {
  id: string;
  userId: string;
  body: string;
  senderHash: string;
  createdAt: string;
  readAt: string | null;
}

export type GiftStatus = "pending" | "paid" | "redeemed";

export interface ZurvasGift {
  id: string;
  userId: string;
  productId: string;
  amountMnt: number;
  /** null бол илгээгч нэрээ нууцалсан. */
  senderName: string | null;
  /** true бол нэвтэрсэн хэрэглэгчийн баталгаатай @нэр. */
  senderVerified: boolean;
  note: string | null;
  status: GiftStatus;
  paymentProvider: string;
  paymentRef: string | null;
  /** Төлбөр төлөгдсөний дараа үүснэ. QR кодонд энэ утга орно. */
  redeemCode: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  redeemedAt: string | null;
  redeemedBy: string | null;
  createdAt: string;
}

export interface NewGift {
  userId: string;
  productId: string;
  amountMnt: number;
  senderName: string | null;
  senderVerified: boolean;
  note: string | null;
  paymentProvider: string;
}

export interface ZurvasPartner {
  id: string;
  name: string;
}

export interface ZurvasStore {
  createGift(gift: NewGift): Promise<ZurvasGift>;
  getGift(id: string): Promise<ZurvasGift | null>;
  setGiftPaymentRef(id: string, ref: string): Promise<void>;
  /** pending → paid. Аль хэдийн төлөгдсөн бол false (давхар боловсруулахгүй). */
  markGiftPaid(
    id: string,
    redeemCode: string,
    paidAt: string,
    expiresAt: string
  ): Promise<boolean>;
  /** Зөвхөн төлөгдсөн болон ашигласан бэлгүүд. */
  listGifts(userId: string): Promise<ZurvasGift[]>;
  getGiftByRedeemCode(code: string): Promise<ZurvasGift | null>;
  /** paid → redeemed, хугацаа дуусаагүй үед л. Амжилтгүй бол false. */
  redeemGift(id: string, partnerId: string, nowIso: string): Promise<boolean>;
  getPartnerByCodeHash(codeHash: string): Promise<ZurvasPartner | null>;
  getPartnerById(id: string): Promise<ZurvasPartner | null>;

  /** Нэр давхцвал null буцаана. */
  createUser(username: string, passwordHash: string): Promise<ZurvasUser | null>;
  getUserByUsername(username: string): Promise<ZurvasUser | null>;
  getUserById(id: string): Promise<ZurvasUser | null>;
  updatePrompt(userId: string, prompt: string | null): Promise<void>;
  addMessage(userId: string, body: string, senderHash: string): Promise<void>;
  listMessages(userId: string, limit: number): Promise<ZurvasMessage[]>;
  getMessage(userId: string, id: string): Promise<ZurvasMessage | null>;
  markAllRead(userId: string): Promise<void>;
  deleteMessage(userId: string, id: string): Promise<boolean>;
  blockSender(userId: string, senderHash: string): Promise<void>;
  isBlocked(userId: string, senderHash: string): Promise<boolean>;
  countRecentFromSender(senderHash: string, sinceIso: string): Promise<number>;
}

export class StoreNotConfiguredError extends Error {
  constructor() {
    super(
      "Zurvas storage is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
}

// ---------------------------------------------------------------- Supabase

interface UserRow {
  id: string;
  username: string;
  prompt: string | null;
  password_hash: string;
  created_at: string;
}

interface MessageRow {
  id: string;
  user_id: string;
  body: string;
  sender_hash: string;
  created_at: string;
  read_at: string | null;
}

const toUser = (r: UserRow): ZurvasUser => ({
  id: r.id,
  username: r.username,
  prompt: r.prompt,
  passwordHash: r.password_hash,
  createdAt: r.created_at,
});

const toMessage = (r: MessageRow): ZurvasMessage => ({
  id: r.id,
  userId: r.user_id,
  body: r.body,
  senderHash: r.sender_hash,
  createdAt: r.created_at,
  readAt: r.read_at,
});

interface GiftRow {
  id: string;
  user_id: string;
  product_id: string;
  amount_mnt: number;
  sender_name: string | null;
  sender_verified: boolean;
  note: string | null;
  status: GiftStatus;
  payment_provider: string;
  payment_ref: string | null;
  redeem_code: string | null;
  paid_at: string | null;
  expires_at: string | null;
  redeemed_at: string | null;
  redeemed_by: string | null;
  created_at: string;
}

const toGift = (r: GiftRow): ZurvasGift => ({
  id: r.id,
  userId: r.user_id,
  productId: r.product_id,
  amountMnt: r.amount_mnt,
  senderName: r.sender_name,
  senderVerified: r.sender_verified,
  note: r.note,
  status: r.status,
  paymentProvider: r.payment_provider,
  paymentRef: r.payment_ref,
  redeemCode: r.redeem_code,
  paidAt: r.paid_at,
  expiresAt: r.expires_at,
  redeemedAt: r.redeemed_at,
  redeemedBy: r.redeemed_by,
  createdAt: r.created_at,
});

function fail(error: { message: string } | null): void {
  if (error) throw new Error(`Supabase: ${error.message}`);
}

function supabaseStore(db: SupabaseClient): ZurvasStore {
  return {
    async createGift(g) {
      const { data, error } = await db
        .from("zurvas_gifts")
        .insert({
          user_id: g.userId,
          product_id: g.productId,
          amount_mnt: g.amountMnt,
          sender_name: g.senderName,
          sender_verified: g.senderVerified,
          note: g.note,
          payment_provider: g.paymentProvider,
        })
        .select()
        .single();
      fail(error);
      return toGift(data as GiftRow);
    },
    async getGift(id) {
      const { data, error } = await db
        .from("zurvas_gifts")
        .select()
        .eq("id", id)
        .maybeSingle();
      fail(error);
      return data ? toGift(data as GiftRow) : null;
    },
    async setGiftPaymentRef(id, ref) {
      const { error } = await db
        .from("zurvas_gifts")
        .update({ payment_ref: ref })
        .eq("id", id);
      fail(error);
    },
    async markGiftPaid(id, redeemCode, paidAt, expiresAt) {
      const { data, error } = await db
        .from("zurvas_gifts")
        .update({
          status: "paid",
          redeem_code: redeemCode,
          paid_at: paidAt,
          expires_at: expiresAt,
        })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      fail(error);
      return (data ?? []).length > 0;
    },
    async listGifts(userId) {
      const { data, error } = await db
        .from("zurvas_gifts")
        .select()
        .eq("user_id", userId)
        .in("status", ["paid", "redeemed"])
        .order("paid_at", { ascending: false })
        .limit(100);
      fail(error);
      return ((data ?? []) as GiftRow[]).map(toGift);
    },
    async getGiftByRedeemCode(code) {
      const { data, error } = await db
        .from("zurvas_gifts")
        .select()
        .eq("redeem_code", code)
        .maybeSingle();
      fail(error);
      return data ? toGift(data as GiftRow) : null;
    },
    async redeemGift(id, partnerId, nowIso) {
      const { data, error } = await db
        .from("zurvas_gifts")
        .update({ status: "redeemed", redeemed_at: nowIso, redeemed_by: partnerId })
        .eq("id", id)
        .eq("status", "paid")
        .gt("expires_at", nowIso)
        .select("id");
      fail(error);
      return (data ?? []).length > 0;
    },
    async getPartnerByCodeHash(codeHash) {
      const { data, error } = await db
        .from("zurvas_partners")
        .select("id, name")
        .eq("code_hash", codeHash)
        .eq("active", true)
        .maybeSingle();
      fail(error);
      return (data as ZurvasPartner | null) ?? null;
    },
    async getPartnerById(id) {
      const { data, error } = await db
        .from("zurvas_partners")
        .select("id, name")
        .eq("id", id)
        .maybeSingle();
      fail(error);
      return (data as ZurvasPartner | null) ?? null;
    },
    async createUser(username, passwordHash) {
      const { data, error } = await db
        .from("zurvas_users")
        .insert({ username, password_hash: passwordHash })
        .select()
        .single();
      if (error?.code === "23505") return null; // unique violation
      fail(error);
      return toUser(data as UserRow);
    },
    async getUserByUsername(username) {
      const { data, error } = await db
        .from("zurvas_users")
        .select()
        .eq("username", username)
        .maybeSingle();
      fail(error);
      return data ? toUser(data as UserRow) : null;
    },
    async getUserById(id) {
      const { data, error } = await db
        .from("zurvas_users")
        .select()
        .eq("id", id)
        .maybeSingle();
      fail(error);
      return data ? toUser(data as UserRow) : null;
    },
    async updatePrompt(userId, prompt) {
      const { error } = await db
        .from("zurvas_users")
        .update({ prompt })
        .eq("id", userId);
      fail(error);
    },
    async addMessage(userId, body, senderHash) {
      const { error } = await db
        .from("zurvas_messages")
        .insert({ user_id: userId, body, sender_hash: senderHash });
      fail(error);
    },
    async listMessages(userId, limit) {
      const { data, error } = await db
        .from("zurvas_messages")
        .select()
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      fail(error);
      return ((data ?? []) as MessageRow[]).map(toMessage);
    },
    async getMessage(userId, id) {
      const { data, error } = await db
        .from("zurvas_messages")
        .select()
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      fail(error);
      return data ? toMessage(data as MessageRow) : null;
    },
    async markAllRead(userId) {
      const { error } = await db
        .from("zurvas_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
      fail(error);
    },
    async deleteMessage(userId, id) {
      const { data, error } = await db
        .from("zurvas_messages")
        .delete()
        .eq("user_id", userId)
        .eq("id", id)
        .select("id");
      fail(error);
      return (data ?? []).length > 0;
    },
    async blockSender(userId, senderHash) {
      const { error } = await db
        .from("zurvas_blocks")
        .upsert(
          { user_id: userId, sender_hash: senderHash },
          { onConflict: "user_id,sender_hash", ignoreDuplicates: true }
        );
      fail(error);
    },
    async isBlocked(userId, senderHash) {
      const { count, error } = await db
        .from("zurvas_blocks")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("sender_hash", senderHash);
      fail(error);
      return (count ?? 0) > 0;
    },
    async countRecentFromSender(senderHash, sinceIso) {
      const { count, error } = await db
        .from("zurvas_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_hash", senderHash)
        .gte("created_at", sinceIso);
      fail(error);
      return count ?? 0;
    },
  };
}

// ------------------------------------------------- Файл (зөвхөн хөгжүүлэлт)

interface FileData {
  users: ZurvasUser[];
  messages: ZurvasMessage[];
  blocks: { userId: string; senderHash: string }[];
  gifts: ZurvasGift[];
  partners: (ZurvasPartner & { codeHash: string })[];
}

// Локал туршилтын түнш кофе шоп. Код: DEMO-COFFEE
const DEMO_PARTNER = {
  id: "demo-partner",
  name: "Demo Coffee (туршилт)",
  codeHash: createHash("sha256").update("DEMO-COFFEE").digest("hex"),
};

function fileStore(filePath: string): ZurvasStore {
  const load = (): FileData => {
    let data: Partial<FileData> = {};
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      // файл байхгүй — хоосноос эхэлнэ
    }
    return {
      users: data.users ?? [],
      messages: data.messages ?? [],
      blocks: data.blocks ?? [],
      gifts: data.gifts ?? [],
      partners: data.partners?.length ? data.partners : [DEMO_PARTNER],
    };
  };
  const save = (data: FileData) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  };

  return {
    async createGift(g) {
      const data = load();
      const gift: ZurvasGift = {
        ...g,
        id: randomUUID(),
        status: "pending",
        paymentRef: null,
        redeemCode: null,
        paidAt: null,
        expiresAt: null,
        redeemedAt: null,
        redeemedBy: null,
        createdAt: new Date().toISOString(),
      };
      data.gifts.push(gift);
      save(data);
      return gift;
    },
    async getGift(id) {
      return load().gifts.find((g) => g.id === id) ?? null;
    },
    async setGiftPaymentRef(id, ref) {
      const data = load();
      const gift = data.gifts.find((g) => g.id === id);
      if (gift) gift.paymentRef = ref;
      save(data);
    },
    async markGiftPaid(id, redeemCode, paidAt, expiresAt) {
      const data = load();
      const gift = data.gifts.find((g) => g.id === id);
      if (!gift || gift.status !== "pending") return false;
      Object.assign(gift, { status: "paid", redeemCode, paidAt, expiresAt });
      save(data);
      return true;
    },
    async listGifts(userId) {
      return load()
        .gifts.filter((g) => g.userId === userId && g.status !== "pending")
        .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
    },
    async getGiftByRedeemCode(code) {
      return load().gifts.find((g) => g.redeemCode === code) ?? null;
    },
    async redeemGift(id, partnerId, nowIso) {
      const data = load();
      const gift = data.gifts.find((g) => g.id === id);
      if (!gift || gift.status !== "paid" || !gift.expiresAt || gift.expiresAt <= nowIso) {
        return false;
      }
      Object.assign(gift, { status: "redeemed", redeemedAt: nowIso, redeemedBy: partnerId });
      save(data);
      return true;
    },
    async getPartnerByCodeHash(codeHash) {
      const p = load().partners.find((x) => x.codeHash === codeHash);
      return p ? { id: p.id, name: p.name } : null;
    },
    async getPartnerById(id) {
      const p = load().partners.find((x) => x.id === id);
      return p ? { id: p.id, name: p.name } : null;
    },
    async createUser(username, passwordHash) {
      const data = load();
      if (data.users.some((u) => u.username === username)) return null;
      const user: ZurvasUser = {
        id: randomUUID(),
        username,
        prompt: null,
        passwordHash,
        createdAt: new Date().toISOString(),
      };
      data.users.push(user);
      save(data);
      return user;
    },
    async getUserByUsername(username) {
      return load().users.find((u) => u.username === username) ?? null;
    },
    async getUserById(id) {
      return load().users.find((u) => u.id === id) ?? null;
    },
    async updatePrompt(userId, prompt) {
      const data = load();
      const user = data.users.find((u) => u.id === userId);
      if (user) user.prompt = prompt;
      save(data);
    },
    async addMessage(userId, body, senderHash) {
      const data = load();
      data.messages.push({
        id: randomUUID(),
        userId,
        body,
        senderHash,
        createdAt: new Date().toISOString(),
        readAt: null,
      });
      save(data);
    },
    async listMessages(userId, limit) {
      return load()
        .messages.filter((m) => m.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
    async getMessage(userId, id) {
      return (
        load().messages.find((m) => m.userId === userId && m.id === id) ?? null
      );
    },
    async markAllRead(userId) {
      const data = load();
      const now = new Date().toISOString();
      for (const m of data.messages) {
        if (m.userId === userId && !m.readAt) m.readAt = now;
      }
      save(data);
    },
    async deleteMessage(userId, id) {
      const data = load();
      const before = data.messages.length;
      data.messages = data.messages.filter(
        (m) => !(m.userId === userId && m.id === id)
      );
      save(data);
      return data.messages.length < before;
    },
    async blockSender(userId, senderHash) {
      const data = load();
      if (
        !data.blocks.some(
          (b) => b.userId === userId && b.senderHash === senderHash
        )
      ) {
        data.blocks.push({ userId, senderHash });
        save(data);
      }
    },
    async isBlocked(userId, senderHash) {
      return load().blocks.some(
        (b) => b.userId === userId && b.senderHash === senderHash
      );
    },
    async countRecentFromSender(senderHash, sinceIso) {
      return load().messages.filter(
        (m) => m.senderHash === senderHash && m.createdAt >= sinceIso
      ).length;
    },
  };
}

// ------------------------------------------------------------------ Сонголт

let cached: ZurvasStore | null = null;

export function getStore(): ZurvasStore {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    cached = supabaseStore(
      createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    );
  } else if (process.env.NODE_ENV !== "production") {
    cached = fileStore(path.join(process.cwd(), ".data", "zurvas.json"));
  } else {
    throw new StoreNotConfiguredError();
  }
  return cached;
}
