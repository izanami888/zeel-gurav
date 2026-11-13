import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  RESERVED_USERNAMES,
  USERNAME_REGEX,
  normalizeUsername,
} from "@/lib/zurvas/config";
import { hashPassword, startSession } from "@/lib/zurvas/auth";
import { clientIp, error, handler, ok, readJson, tooManyAttempts } from "@/lib/zurvas/http";
import { getStore } from "@/lib/zurvas/store";

export const POST = handler(async (req) => {
  if (tooManyAttempts(`signup:${clientIp(req)}`, 5)) {
    return error("Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу.", 429);
  }

  const body = await readJson(req);
  const username = normalizeUsername(String(body.username ?? ""));
  const password = String(body.password ?? "");

  if (!USERNAME_REGEX.test(username)) {
    return error(
      "Нэр 3–20 тэмдэгт, зөвхөн латин жижиг үсэг, тоо, цэг, доогуур зураас байна."
    );
  }
  if (RESERVED_USERNAMES.has(username)) {
    return error("Энэ нэрийг ашиглах боломжгүй.");
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return error(`Нууц үг хамгийн багадаа ${PASSWORD_MIN} тэмдэгт байна.`);
  }

  const user = await getStore().createUser(username, hashPassword(password));
  if (!user) return error("Энэ нэр аль хэдийн бүртгэгдсэн байна.", 409);

  startSession(user.id);
  return ok({ username: user.username });
});
