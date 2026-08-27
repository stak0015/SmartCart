import { NextResponse } from "next/server";
import { asAppError } from "./errors";

export function apiErrorResponse(error: unknown): NextResponse {
  const appError = asAppError(error);
  return NextResponse.json(
    { error: { code: appError.code, message: appError.message } },
    { status: appError.status, headers: { "Cache-Control": "no-store" } },
  );
}
