import {
  MESSAGE_MAX,
  SEND_LIMIT,
  SEND_WINDOW_MS,
  normalizeUsername,
} from "@/lib/zurvas/config";
import { error, handler, ok, readJson, senderHash } from "@/lib/zurvas/http";
import { getStore } from "@/lib/zurvas/store";

// Нэрээ нууцалсан зурвас илгээх. Нэвтрэх шаардлагагүй.
export const POST = handler(async (req) => {
  const body = await readJson(req);
  const username = normalizeUsername(String(body.username ?? ""));
  const text = String(body.message ?? "").trim();

  if (!text) return error("Зурвасаа бичнэ үү.");
  if (text.length > MESSAGE_MAX) {
    return error(`Зурвас ${MESSAGE_MAX} тэмдэгтээс хэтрэхгүй байх ёстой.`);
  }

  const store = getStore();
  const user = await store.getUserByUsername(username);
  if (!user) return error("Хэрэглэгч олдсонгүй.", 404);

  const sender = senderHash(req);

  const since = new Date(Date.now() - SEND_WINDOW_MS).toISOString();
  if ((await store.countRecentFromSender(sender, since)) >= SEND_LIMIT) {
    return error("Хэт олон зурвас илгээлээ. Түр хүлээгээд дахин оролдоно уу.", 429);
  }

  // Блоклогдсон илгээгчид амжилттай мэт хариулна, гэхдээ хадгалахгүй.
  if (!(await store.isBlocked(user.id, sender))) {
    await store.addMessage(user.id, text, sender);
  }
  return ok();
});
