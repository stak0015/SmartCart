function withoutTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

const explicitBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const legacyHost = process.env.NEXT_PUBLIC_API_BASE?.trim();

// NEXT_PUBLIC_API_BASE_URL should include /api. Keep the teammate's earlier
// host-only variable working during the transition.
export const API_BASE_URL = explicitBaseUrl
  ? withoutTrailingSlash(explicitBaseUrl)
  : legacyHost
    ? `${withoutTrailingSlash(legacyHost)}/api`
    : "http://localhost:8000/api";
