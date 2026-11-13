import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import AuthForm from "@/components/zurvas/AuthForm";
import { getCurrentUser } from "@/lib/zurvas/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Нууц зурвас — найзуудаасаа нэрээ нууцалсан зурвас аваарай",
  description:
    "Өөрийн линкийг үүсгээд Instagram, Facebook дээрээ хуваалцаж, найзуудаасаа нууц зурвас хүлээн аваарай.",
};

const steps = [
  { emoji: "🔗", title: "Линкээ ав", text: "Нэр, нууц үгээ оруулаад өөрийн линкийг үүсгэ." },
  { emoji: "📲", title: "Хуваалц", text: "Линкээ story, bio дээрээ тавь." },
  { emoji: "💌", title: "Зурвас ав", text: "Найзууд чинь нэрээ нууцлан зурвас бичнэ." },
];

export default async function ZurvasLandingPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/zurvas/inbox");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <section className="mb-8 text-center">
          <div className="mb-3 text-5xl">💌</div>
          <h1 className="text-3xl font-bold text-white">Нууц зурвас</h1>
          <p className="mt-3 text-white/60">
            Найзууд чинь чиний тухай юу бодож байгааг нэрээ нууцлан хэлэх боломж олго.
          </p>
        </section>

        <AuthForm />

        <ol className="mt-10 flex flex-col gap-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-4">
              <span className="text-3xl">{s.emoji}</span>
              <div>
                <div className="font-semibold text-white">
                  {i + 1}. {s.title}
                </div>
                <div className="text-sm text-white/60">{s.text}</div>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
