import { PROMPT_MAX } from "@/lib/zurvas/config";
import { getCurrentUser } from "@/lib/zurvas/auth";
import { error, handler, ok, readJson } from "@/lib/zurvas/http";
import { getStore } from "@/lib/zurvas/store";

// Профайл дээр харагдах асуулт/уриаг солих.
export const PATCH = handler(async (req) => {
  const user = await getCurrentUser();
  if (!user) return error("Нэвтэрнэ үү.", 401);

  const body = await readJson(req);
  const prompt = String(body.prompt ?? "").trim();
  if (prompt.length > PROMPT_MAX) {
    return error(`Асуулт ${PROMPT_MAX} тэмдэгтээс хэтрэхгүй байх ёстой.`);
  }

  await getStore().updatePrompt(user.id, prompt || null);
  return ok();
});
