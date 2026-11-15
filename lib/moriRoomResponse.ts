import "server-only";
import { NextResponse } from "next/server";
import type { MoriOutcome } from "./moriRooms";
import type { MoriErrorCode } from "@/games/mori/online";

const STATUS: Partial<Record<MoriErrorCode, number>> = {
  not_configured: 503,
  bad_request: 400,
  not_found: 404,
  not_player: 403,
  not_host: 403,
  conflict: 409,
  server_error: 500,
};

export function moriResponse(outcome: MoriOutcome) {
  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error },
      { status: STATUS[outcome.error] ?? 422 }
    );
  }
  return NextResponse.json({ room: outcome.room, seat: outcome.seat });
}
