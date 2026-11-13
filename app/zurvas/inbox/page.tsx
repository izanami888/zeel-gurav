import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import type { InboxGift } from "@/components/zurvas/GiftList";
import Inbox from "@/components/zurvas/Inbox";
import { getCurrentUser } from "@/lib/zurvas/auth";
import { INBOX_LIMIT } from "@/lib/zurvas/config";
import { getStore } from "@/lib/zurvas/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ирсэн зурвас — Нууц зурвас",
  robots: { index: false },
};

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/zurvas");

  const store = getStore();
  const messages = await store.listMessages(user.id, INBOX_LIMIT);
  // Энэ удаа "Шинэ" гэж харуулаад, дараагийн удаад уншсан болгоно.
  if (messages.some((m) => !m.readAt)) await store.markAllRead(user.id);

  const now = new Date().toISOString();
  const gifts: InboxGift[] = (await store.listGifts(user.id)).map((g) => {
    const state =
      g.status === "redeemed" ? "redeemed" : (g.expiresAt ?? "") <= now ? "expired" : "active";
    return {
      id: g.id,
      productId: g.productId,
      senderName: g.senderName,
      senderVerified: g.senderVerified,
      note: g.note,
      state,
      expiresAt: g.expiresAt ?? now,
      redeemCode: state === "active" ? g.redeemCode : null,
    };
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-white">Сайн уу, @{user.username} 👋</h1>
        <Inbox
          username={user.username}
          prompt={user.prompt}
          // senderHash-г клиент рүү хэзээ ч дамжуулахгүй.
          gifts={gifts}
          messages={messages.map((m) => ({
            id: m.id,
            body: m.body,
            createdAt: m.createdAt,
            isNew: !m.readAt,
          }))}
        />
      </main>
    </div>
  );
}
