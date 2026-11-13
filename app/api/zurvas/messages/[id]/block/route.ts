import { getCurrentUser } from "@/lib/zurvas/auth";
import { error, handler, ok } from "@/lib/zurvas/http";
import { getStore } from "@/lib/zurvas/store";

// Энэ зурвасыг илгээсэн хүнийг блоклоод зурвасыг устгана.
// Илгээгч хэн болохыг эзэмшигч хэзээ ч олж мэдэхгүй.
export const POST = handler(async (_req, { params }: { params: { id: string } }) => {
  const user = await getCurrentUser();
  if (!user) return error("Нэвтэрнэ үү.", 401);

  const store = getStore();
  const message = await store.getMessage(user.id, params.id);
  if (!message) return error("Зурвас олдсонгүй.", 404);

  await store.blockSender(user.id, message.senderHash);
  await store.deleteMessage(user.id, message.id);
  return ok();
});
