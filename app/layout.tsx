import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Тоглоомын Тавцан",
  description:
    "Монгол хэл дээрх онлайн ширээний болон бодлогын тоглоомын вэбсайт.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn">
      <body className="min-h-screen bg-mongol-blue font-sans text-white antialiased">
        {children}
      </body>
    </html>
  );
}
