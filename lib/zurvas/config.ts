// "Нууц зурвас" — нэрээ нууцалсан зурвасын функцийн нийтлэг тохиргоо.
// Клиент болон сервер талд аль алинд нь импортлож болно (нууц зүйл байхгүй).

export const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 100;
export const MESSAGE_MAX = 500;
export const PROMPT_MAX = 80;
export const DEFAULT_PROMPT = "Надад нууцаар зурвас илгээгээрэй!";

// Нэг илгээгч 10 минутад хамгийн ихдээ хэдэн зурвас илгээж болох вэ.
export const SEND_LIMIT = 8;
export const SEND_WINDOW_MS = 10 * 60 * 1000;

export const INBOX_LIMIT = 100;

// Хэрэглэгчийн нэр болгож болохгүй үгс.
export const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "games",
  "zurvas",
  "inbox",
  "login",
  "signup",
  "support",
  "help",
  "root",
  "system",
  "moderator",
  "null",
  "undefined",
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export function profilePath(username: string): string {
  return `/u/${username}`;
}
