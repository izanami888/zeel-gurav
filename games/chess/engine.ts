import type { MoveInput, PromotionPiece, Square } from "./logic";

// Stockfish хөдөлгүүрийг Web Worker дотор ажиллуулж, UCI текст
// командаар харилцана. Хөдөлгүүрийн файлууд public/stockfish/ дотор
// байгаа (GPLv3 — public/stockfish/README.md-г үзнэ үү).

const ENGINE_URL = "/stockfish/stockfish-19-lite-single.js";

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Хялбар",
  medium: "Дунд",
  hard: "Хэцүү",
};

// skill: Stockfish-ийн "Skill Level" (0–20). go: хайлтын хязгаар.
const DIFFICULTY_SETTINGS: Record<Difficulty, { skill: number; go: string }> = {
  easy: { skill: 0, go: "depth 1" },
  medium: { skill: 7, go: "depth 6" },
  hard: { skill: 20, go: "movetime 1000" },
};

function toUci(move: MoveInput): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function fromUci(uci: string): MoveInput | null {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
  if (!match) return null;
  return {
    from: match[1] as Square,
    to: match[2] as Square,
    promotion: match[3] as PromotionPiece | undefined,
  };
}

export class ChessEngine {
  private worker: Worker;
  private ready: Promise<void>;
  // "go" бүр яг нэг "bestmove" буцаадаг тул дарааллаар нь тааруулна.
  private pending: Array<(move: MoveInput | null) => void> = [];
  private failed: Array<(error: Error) => void> = [];

  constructor() {
    this.worker = new Worker(ENGINE_URL);

    this.ready = new Promise<void>((resolve, reject) => {
      this.failed.push(reject);
      const onReady = (event: MessageEvent) => {
        if (event.data === "readyok") {
          this.worker.removeEventListener("message", onReady);
          resolve();
        }
      };
      this.worker.addEventListener("message", onReady);
    });
    // Хэн ч хүлээгээгүй үед алдаа гарвал "unhandled rejection" болохгүй.
    this.ready.catch(() => {});

    this.worker.addEventListener("message", (event: MessageEvent) => {
      const line = typeof event.data === "string" ? event.data : "";
      if (!line.startsWith("bestmove")) return;
      this.pending.shift()?.(fromUci(line.split(" ")[1] ?? ""));
    });

    this.worker.addEventListener("error", () => {
      const error = new Error("Stockfish хөдөлгүүрийг ачаалж чадсангүй");
      for (const reject of this.failed.splice(0)) reject(error);
    });

    this.worker.postMessage("uci");
    this.worker.postMessage("isready");
  }

  /** Өгөгдсөн нүүдлүүдийн дараах байрлалд компьютерийн нүүдлийг олно. */
  async findMove(
    moves: MoveInput[],
    difficulty: Difficulty
  ): Promise<MoveInput | null> {
    await this.ready;
    const { skill, go } = DIFFICULTY_SETTINGS[difficulty];

    return new Promise<MoveInput | null>((resolve, reject) => {
      this.pending.push(resolve);
      this.failed.push(reject);
      this.worker.postMessage(`setoption name Skill Level value ${skill}`);
      this.worker.postMessage(
        `position startpos moves ${moves.map(toUci).join(" ")}`.trim()
      );
      this.worker.postMessage(`go ${go}`);
    });
  }

  /** Явагдаж буй хайлтыг зогсооно (хариу нь тоогдохгүй болсон үед). */
  stop() {
    this.worker.postMessage("stop");
  }

  dispose() {
    this.worker.terminate();
  }
}
