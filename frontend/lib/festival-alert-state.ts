export const MALAYSIA_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Perak",
  "Perlis",
  "Pulau Pinang",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "W.P. Kuala Lumpur",
  "W.P. Labuan",
  "W.P. Putrajaya",
] as const;

export type MalaysiaState = (typeof MALAYSIA_STATES)[number];

export const ALERT_STATE_STORAGE_KEY = "smartcart.festival-alert-state";
export const ALERT_DATE_STORAGE_KEY = "smartcart.festival-alert-date";

const ALIASES: Array<[RegExp, MalaysiaState]> = [
  [/kuala lumpur/i, "W.P. Kuala Lumpur"],
  [/putrajaya/i, "W.P. Putrajaya"],
  [/labuan/i, "W.P. Labuan"],
  [/\bpenang\b/i, "Pulau Pinang"],
  [/pulau pinang/i, "Pulau Pinang"],
  [/negeri sembilan/i, "Negeri Sembilan"],
  [/johor/i, "Johor"],
  [/kedah/i, "Kedah"],
  [/kelantan/i, "Kelantan"],
  [/melaka|malacca/i, "Melaka"],
  [/pahang/i, "Pahang"],
  [/perak/i, "Perak"],
  [/perlis/i, "Perlis"],
  [/sabah/i, "Sabah"],
  [/sarawak/i, "Sarawak"],
  [/selangor/i, "Selangor"],
  [/terengganu/i, "Terengganu"],
];

export function inferStateFromLabel(label: string | null | undefined): MalaysiaState | null {
  if (!label) return null;
  for (const [pattern, state] of ALIASES) {
    if (pattern.test(label)) return state;
  }
  return null;
}

export function isMalaysiaState(value: string | null | undefined): value is MalaysiaState {
  return value != null && (MALAYSIA_STATES as readonly string[]).includes(value);
}
