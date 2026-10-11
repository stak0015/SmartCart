// Owner: Shun
function withoutTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

const explicitBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const legacyHost = process.env.NEXT_PUBLIC_API_BASE?.trim();

// NEXT_PUBLIC_API_BASE_URL should include /api. The older host-only
// NEXT_PUBLIC_API_BASE is still accepted and gets /api appended.
export const API_BASE_URL = explicitBaseUrl
  ? withoutTrailingSlash(explicitBaseUrl)
  : legacyHost
    ? `${withoutTrailingSlash(legacyHost)}/api`
    : "http://localhost:8000/api";
