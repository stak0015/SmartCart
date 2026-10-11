// Owner: Shun
import Image from "next/image";
import svgPathsCompare from "./icons/compare";

export function StorePlaceholder() {
  return <svg aria-hidden="true" width={18} height={16} viewBox="0 0 18 16" fill="none" className="store-placeholder"><path d={svgPathsCompare.p2a93db80} fill="currentColor"/></svg>;
}

const CHAIN_LOGOS: Array<{ file: string; aliases: string[] }> = [
  { file: "99-speedmart", aliases: ["99 SPEEDMART", "99 SPEED MART", "SPEEDMART"] },
  { file: "econsave", aliases: ["ECONSAVE"] },
  { file: "lotus", aliases: ["LOTUS", "LOTUS'S", "TESCO"] },
  { file: "aeon", aliases: ["AEON"] },
  { file: "giant", aliases: ["GIANT"] },
  { file: "tmg", aliases: ["TMG", "T M G"] },
  { file: "tf-value-mart", aliases: ["TF VALUE MART"] },
  { file: "mydin", aliases: ["MYDIN"] },
  { file: "segi-fresh", aliases: ["SEGI FRESH", "SEGI"] },
  { file: "servay", aliases: ["SERVAY"] },
  { file: "bataras", aliases: ["BATARAS"] },
  { file: "billion", aliases: ["BILLION"] },
  { file: "everwin", aliases: ["EVERWIN"] },
  { file: "pkt", aliases: ["PKT WHOLESALE", "PKT"] },
  { file: "hero", aliases: ["HERO"] },
  { file: "pantai-timor", aliases: ["PANTAI TIMOR"] },
  { file: "maslee", aliases: ["MASLEE"] },
  { file: "village-grocer", aliases: ["VILLAGE GROCER"] },
  { file: "nsk", aliases: ["NSK"] },
  { file: "the-store", aliases: ["THE STORE"] },
  { file: "jaya-grocer", aliases: ["JAYA GROCER"] },
  { file: "pasaraya-bs", aliases: ["PASARAYA BS", "BS FRESHMART"] },
  { file: "doremart", aliases: ["DOREMART"] },
  { file: "pacific", aliases: ["PACIFIC"] },
  { file: "emart", aliases: ["EMART", "E MART"] },
];

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function resolveChainLogo(name: string): string | null {
  const normalizedName = ` ${normalize(name)} `;
  // Food courts are separate premises, even when named after their host chain.
  if (/\b(?:MEDAN SELERA|FOOD\s*COURT)\b/.test(normalizedName)) return null;
  const chain = CHAIN_LOGOS.find(({ aliases }) =>
    aliases.some((alias) => normalizedName.includes(` ${normalize(alias)} `)),
  );
  return chain ? `/chain-logos-v1/${chain.file}.webp` : null;
}

export function StoreChainLogo({
  name,
}: {
  name: string;
}) {
  const src = resolveChainLogo(name);
  if (!src) return <StorePlaceholder/>;

  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="(max-width: 640px) 48px, 70px"
      className="store-chain-logo"
      unoptimized
    />
  );
}
