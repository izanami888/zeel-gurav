import { getCurrentUser } from "@/lib/zurvas/auth";
import { error, handler, ok } from "@/lib/zurvas/http";
import { getStore } from "@/lib/zurvas/store";

export const DELETE = handler(async (_req, { params }: { params: { id: string } }) => {
  const user = await getCurrentUser();
  if (!user) return error("Нэвтэрнэ үү.", 401);

  const deleted = await getStore().deleteMessage(user.id, params.id);
  return deleted ? ok() : error("Зурвас олдсонгүй.", 404);
});
