import { normalizeUsername } from "@/lib/zurvas/config";
import { startSession, verifyPassword } from "@/lib/zurvas/auth";
import { clientIp, error, handler, ok, readJson, tooManyAttempts } from "@/lib/zurvas/http";
import { getStore } from "@/lib/zurvas/store";

export const POST = handler(async (req) => {
  if (tooManyAttempts(`login:${clientIp(req)}`)) {
    return error("Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу.", 429);
  }

  const body = await readJson(req);
  const username = normalizeUsername(String(body.username ?? ""));
  const password = String(body.password ?? "");

  const user = await getStore().getUserByUsername(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return error("Нэр эсвэл нууц үг буруу байна.", 401);
  }

  startSession(user.id);
  return ok({ username: user.username });
});
