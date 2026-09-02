import pg from "pg";

const { Pool } = pg;

function readIntegerArgument(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function resolveCoordinates(apiKey, placeId) {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,location",
      },
    },
  );

  if (!response.ok) {
    const diagnostic = await response.text();
    const error = new Error(
      `Google Places returned ${response.status}: ${diagnostic.slice(0, 300)}`,
    );
    error.status = response.status;
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      error.retryAfterMilliseconds = retryAfterSeconds * 1_000;
    }
    throw error;
  }

  const body = await response.json();
  if (
    typeof body.location?.latitude !== "number" ||
    typeof body.location?.longitude !== "number"
  ) {
    throw new Error("Google Places did not return coordinates");
  }
  return body.location;
}

async function resolveCoordinatesWithRetry(apiKey, placeId, waitForRequestSlot) {
  const maximumAttempts = 6;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    await waitForRequestSlot();
    try {
      return await resolveCoordinates(apiKey, placeId);
    } catch (error) {
      const retryable = error?.status === 429 || error?.status >= 500;
      if (!retryable || attempt === maximumAttempts) throw error;

      const retryDelay =
        error.retryAfterMilliseconds ??
        (error.status === 429 ? 60_000 : Math.min(2 ** attempt * 1_000, 30_000));
      console.warn(
        `Google Places returned ${error.status}; retrying in ${Math.ceil(retryDelay / 1_000)} second(s) ` +
          `(attempt ${attempt + 1}/${maximumAttempts}).`,
      );
      await sleep(retryDelay);
    }
  }

  throw new Error("Google Places retry loop ended unexpectedly");
}

const databaseUrl = requireEnvironment("DATABASE_URL");
const cleanupOnly = process.argv.includes("--cleanup-only");
const staleDays = readIntegerArgument("stale-days", 29);
const requestedLimit = process.argv.includes("--all") ? 100_000 : readIntegerArgument("limit", 100);
const districtFilter =
  process.argv.find(argument => argument.startsWith("--district="))?.slice("--district=".length)?.trim() ||
  null;
const requestsPerMinute = readIntegerArgument("requests-per-minute", 300);
const requestIntervalMilliseconds = Math.ceil(60_000 / requestsPerMinute);
const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

let updated = 0;
let failed = 0;
let nextRequestAt = 0;

async function waitForRequestSlot() {
  const waitMilliseconds = nextRequestAt - Date.now();
  if (waitMilliseconds > 0) await sleep(waitMilliseconds);
  nextRequestAt = Date.now() + requestIntervalMilliseconds;
}

try {
  const cleanupResult = await pool.query(
    `
      UPDATE premise
      SET latitude = NULL,
          longitude = NULL,
          location_provider = NULL,
          location_refreshed_at = NULL
      WHERE location_provider = 'google'
        AND location_refreshed_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
    `,
  );
  console.log(`Expired Google coordinate caches removed: ${cleanupResult.rowCount ?? 0}.`);

  if (cleanupOnly) {
    console.log("Cleanup complete.");
  } else {
    const apiKey =
      process.env.GOOGLE_PLACES_API_KEY?.trim() ||
      requireEnvironment("GOOGLE_MAPS_API_KEY");
    const result = await pool.query(
      `
        SELECT premise_id, premise_code, google_place_id
        FROM premise
        WHERE google_place_id IS NOT NULL
          AND ($3::text IS NULL OR district ILIKE $3)
          AND (
            latitude IS NULL OR
            longitude IS NULL OR
            location_provider IS DISTINCT FROM 'google' OR
            location_refreshed_at IS NULL OR
            location_refreshed_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
          )
        ORDER BY location_refreshed_at ASC NULLS FIRST, premise_id ASC
        LIMIT $2
      `,
      [staleDays, requestedLimit, districtFilter ? `%${districtFilter}%` : null],
    );

    const premiseCount = result.rowCount ?? result.rows.length;
    console.log(
      `Refreshing ${premiseCount} premise location(s) at up to ${requestsPerMinute} request(s)/minute...`,
    );
    for (const premise of result.rows) {
      try {
        const location = await resolveCoordinatesWithRetry(
          apiKey,
          premise.google_place_id,
          waitForRequestSlot,
        );
        await pool.query(
          `
            UPDATE premise
            SET latitude = $1,
                longitude = $2,
                location_provider = 'google',
                location_refreshed_at = CURRENT_TIMESTAMP
            WHERE premise_id = $3
          `,
          [location.latitude, location.longitude, premise.premise_id],
        );
        updated += 1;
        if (updated % 100 === 0 || updated + failed === premiseCount) {
          console.log(`Progress: ${updated + failed}/${premiseCount}; updated: ${updated}; failed: ${failed}.`);
        }
      } catch (error) {
        failed += 1;
        console.error(`Premise ${premise.premise_code}: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }
  }
} finally {
  await pool.end();
}

console.log(`Premise locations refreshed: ${updated}; failed: ${failed}.`);
if (failed > 0) process.exitCode = 1;
