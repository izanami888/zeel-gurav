export type GameStatus = "available" | "soon";

export interface GameMeta {
  id: string;
  name: string;
  description: string;
  href: string;
  emoji: string;
  status: GameStatus;
}

// Шинэ тоглоом нэмэхдээ энд бичээд, /games/<id> замд хуудсаа нэмнэ үү.
export const games: GameMeta[] = [
  {
    id: "tic-tac-toe",
    name: "Хөндлөвч тоглоом",
    description: "Ширээн дээрх сонгодог 3x3 хөндлөвч (X, O) тоглоом. 2 тоглогч ээлжлэн тоглоно.",
    href: "/games/tic-tac-toe",
    emoji: "⭕",
    status: "available",
  },
  {
    id: "chess",
    name: "Шатар",
    description: "Сонгодог шатар. Нэг төхөөрөмж дээр 2 тоглогч ээлжлэн нүүнэ.",
    href: "/games/chess",
    emoji: "♟️",
    status: "available",
  },
  {
    id: "chuluu",
    name: "Чулуу таалцах",
    description: "Гартаа чулуу нууж, нийт хэдэн чулуу байгааг таах уламжлалт тоглоом. 2–6 тоглогч эсвэл компьютертэй.",
    href: "/games/chuluu",
    emoji: "✊",
    status: "available",
  },
  {
    id: "checkers",
    name: "Шашки",
    description: "Тун удахгүй нэмэгдэнэ.",
    href: "#",
    emoji: "🔴",
    status: "soon",
  },
  {
    id: "connect-four",
    name: "Дөрөв дараалуулах",
    description: "Тун удахгүй нэмэгдэнэ.",
    href: "#",
    emoji: "🟡",
    status: "soon",
  },
];
