import { NextResponse } from "next/server";
import { AppError } from "@/lib/server/errors";
import { apiErrorResponse } from "@/lib/server/http";
import { getMapsProvider } from "@/lib/server/maps/google";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim() ?? "";
    const sessionToken = searchParams.get("sessionToken")?.trim() ?? "";

    if (query.length < 3 || query.length > 160) {
      throw new AppError("INVALID_LOCATION_QUERY", "Enter at least three characters to search.", 400);
    }
    if (sessionToken.length < 8 || sessionToken.length > 128) {
      throw new AppError("INVALID_SESSION_TOKEN", "The location search session is invalid.", 400);
    }

    const suggestions = await getMapsProvider().autocomplete(query, sessionToken);
    return NextResponse.json(
      { suggestions },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
