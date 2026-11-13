import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import GiftForm from "@/components/zurvas/GiftForm";
import { getCurrentUser } from "@/lib/zurvas/auth";
import { USERNAME_REGEX, normalizeUsername, profilePath } from "@/lib/zurvas/config";
import { getStore } from "@/lib/zurvas/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Бэлэг илгээх — Нууц зурвас" };

export default async function GiftPage({ params }: { params: { username: string } }) {
  const username = normalizeUsername(decodeURIComponent(params.username));
  if (!USERNAME_REGEX.test(username)) notFound();
  const user = await getStore().getUserByUsername(username);
  if (!user) notFound();

  const me = await getCurrentUser();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href={profilePath(user.username)} className="mb-4 text-sm text-white/50">
        ← Буцах
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-white">
        @{user.username}-д бэлэг илгээх 🎁
      </h1>
      <GiftForm username={user.username} me={me?.username ?? null} />
    </main>
  );
}
