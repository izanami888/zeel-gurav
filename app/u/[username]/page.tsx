import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SendForm from "@/components/zurvas/SendForm";
import { DEFAULT_PROMPT, USERNAME_REGEX, normalizeUsername, profilePath } from "@/lib/zurvas/config";
import { getStore } from "@/lib/zurvas/store";

export const dynamic = "force-dynamic";

interface Props {
  params: { username: string };
}

async function findUser(raw: string) {
  const username = normalizeUsername(decodeURIComponent(raw));
  if (!USERNAME_REGEX.test(username)) return null;
  return getStore().getUserByUsername(username);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await findUser(params.username).catch(() => null);
  if (!user) return { title: "Хэрэглэгч олдсонгүй — Нууц зурвас" };
  const title = `@${user.username}-д нууц зурвас илгээ`;
  const description = user.prompt || DEFAULT_PROMPT;
  return { title, description, openGraph: { title, description } };
}

export default async function ProfilePage({ params }: Props) {
  const user = await findUser(params.username);
  if (!user) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <SendForm username={user.username} prompt={user.prompt || DEFAULT_PROMPT} />
      <Link
        href={`${profilePath(user.username)}/gift`}
        className="mt-4 rounded-full border border-mongol-gold/50 px-6 py-3 text-center font-semibold text-mongol-gold-light transition hover:border-mongol-gold"
      >
        ☕ Кофе бэлэглэх
      </Link>
      <p className="mt-8 text-center text-xs text-white/40">
        💌 Нууц зурвас · Бусдыг доромжилсон, заналхийлсэн зурвас илгээхийг хориглоно.
      </p>
    </main>
  );
}
