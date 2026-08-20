"use client";

import { useState } from "react";
import {
  EMPTY_BOARD,
  calculateWinner,
  isDraw,
  type Board,
} from "@/games/tic-tac-toe/logic";
import ResultShareCard from "@/components/ResultShareCard";

const PLAYER_LABEL: Record<"X" | "O", string> = {
  X: "Тоглогч 1",
  O: "Тоглогч 2",
};

export default function TicTacToeGame() {
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [currentPlayer, setCurrentPlayer] = useState<"X" | "O">("X");

  const win = calculateWinner(board);
  const draw = isDraw(board, win);
  const gameOver = win !== null || draw;

  function handleCellClick(index: number) {
    if (board[index] || gameOver) return;
    const next = [...board];
    next[index] = currentPlayer;
    setBoard(next);
    setCurrentPlayer(currentPlayer === "X" ? "O" : "X");
  }

  function handleReset() {
    setBoard(EMPTY_BOARD);
    setCurrentPlayer("X");
  }

  if (gameOver) {
    const resultText = win
      ? `${PLAYER_LABEL[win.winner]} яллаа!`
      : "Тэнцлээ!";

    return (
      <ResultShareCard
        game="Хөндлөвч тоглоом"
        result={resultText}
        subtitle={win ? `${win.winner} тэмдэгээр яллаа` : undefined}
        onPlayAgain={handleReset}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-mongol-gold-light/80">
          {PLAYER_LABEL[currentPlayer]}-ийн ээлж
        </p>
        <p className="mt-1 text-2xl font-bold text-white">
          {currentPlayer === "X" ? "✕" : "○"}
        </p>
      </div>

      <div className="grid w-full max-w-sm grid-cols-3 gap-3">
        {board.map((cell, index) => (
          <button
            key={index}
            onClick={() => handleCellClick(index)}
            disabled={cell !== null}
            aria-label={`Нүд ${index + 1}`}
            className="flex aspect-square items-center justify-center rounded-2xl border border-mongol-gold/30 bg-mongol-blue-light/50 text-5xl font-bold text-white transition active:scale-95 disabled:active:scale-100"
          >
            {cell === "X" && <span className="text-mongol-gold-light">✕</span>}
            {cell === "O" && <span className="text-white">○</span>}
          </button>
        ))}
      </div>

      <button
        onClick={handleReset}
        className="text-sm font-medium text-white/50 underline underline-offset-4"
      >
        Дахин эхлэх
      </button>
    </div>
  );
}
