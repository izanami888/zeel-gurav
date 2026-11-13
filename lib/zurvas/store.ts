import "server-only";
import { randomUUID } from "crypto";
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

export interface ZurvasStore {
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

function fail(error: { message: string } | null): void {
  if (error) throw new Error(`Supabase: ${error.message}`);
}

function supabaseStore(db: SupabaseClient): ZurvasStore {
  return {
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
}

function fileStore(filePath: string): ZurvasStore {
  const load = (): FileData => {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as FileData;
    } catch {
      return { users: [], messages: [], blocks: [] };
    }
  };
  const save = (data: FileData) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  };

  return {
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
