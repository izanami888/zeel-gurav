import { endSession } from "@/lib/zurvas/auth";
import { handler, ok } from "@/lib/zurvas/http";

export const POST = handler(async () => {
  endSession();
  return ok();
});
