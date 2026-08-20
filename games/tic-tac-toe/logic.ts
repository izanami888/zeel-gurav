export type Cell = "X" | "O" | null;
export type Board = Cell[];

export const EMPTY_BOARD: Board = Array(9).fill(null);

const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export interface WinResult {
  winner: "X" | "O";
  line: number[];
}

export function calculateWinner(board: Board): WinResult | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as "X" | "O", line };
    }
  }
  return null;
}

export function isDraw(board: Board, win: WinResult | null): boolean {
  return !win && board.every((cell) => cell !== null);
}

export function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== null);
}
