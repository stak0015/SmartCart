// Owners: Shun, Zhihao
import type { TransportMode } from "@/lib/contracts";
import svgPathsLocation from "./icons/location";

export function IcoWalkFigma({ color = "#3E494A" }: { color?: string }) {
  return (
    <svg width={17.333} height={28.667} viewBox="0 0 17.3333 28.6667" fill="none">
      <path d={svgPathsLocation.p15f7f100} fill={color} />
    </svg>
  );
}
export function IcoBusFigma({ color = "#3E494A" }: { color?: string }) {
  return (
    <svg width={21.333} height={25.333} viewBox="0 0 21.3333 25.3333" fill="none">
      <path d={svgPathsLocation.p11d2e580} fill={color} />
    </svg>
  );
}
export function IcoMotoFigma({ color = "white" }: { color?: string }) {
  return (
    <svg width={32} height={18.667} viewBox="0 0 32 18.6667" fill="none">
      <path d={svgPathsLocation.p2da71d00} fill={color} />
    </svg>
  );
}
export function IcoCarFigma({ color = "#3E494A" }: { color?: string }) {
  return (
    <svg width={24} height={21.333} viewBox="0 0 24 21.3333" fill="none">
      <path d={svgPathsLocation.p282dfe00} fill={color} />
    </svg>
  );
}
// ── Transport mode icon (iteration1 feedback: transit includes walking) ────
export function TransportModeIcon({ mode, color = "#3E494A" }: { mode: TransportMode; color?: string }) {
  if (mode === "public_transport") {
    return (
      <span className="flex h-5 items-center gap-1 [&_svg]:h-5 [&_svg]:w-auto">
        <IcoWalkFigma color={color} />
        <IcoBusFigma color={color} />
      </span>
    );
  }
  return (
    <span className="flex h-5 items-center [&_svg]:h-5 [&_svg]:w-auto">
      {mode === "walk" ? (
        <IcoWalkFigma color={color} />
      ) : mode === "motorcycle" ? (
        <IcoMotoFigma color={color} />
      ) : (
        <IcoCarFigma color={color} />
      )}
    </span>
  );
}

