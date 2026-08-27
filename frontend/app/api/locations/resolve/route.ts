import { NextResponse } from "next/server";
import { AppError } from "@/lib/server/errors";
import { apiErrorResponse } from "@/lib/server/http";
import { getMapsProvider } from "@/lib/server/maps/google";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const placeId = typeof body?.placeId === "string" ? body.placeId.trim() : "";
    const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";

    if (!placeId || placeId.length > 255 || sessionToken.length < 8 || sessionToken.length > 128) {
      throw new AppError("INVALID_LOCATION", "Please choose a valid location suggestion.", 400);
    }

    const location = await getMapsProvider().resolvePlace(placeId, sessionToken);
    return NextResponse.json(location, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
