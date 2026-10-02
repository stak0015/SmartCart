import type { CSSProperties } from "react";

const paths: Record<string, string> = {
  close: "M6 6l12 12M6 18 18 6",
  plus: "M12 5v14M5 12h14",
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  checklist: "M9 4H5v17h14V4h-4M9 3h6v4H9zM8 12l2 2 5-5M8 18h7",
  history: "M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9ZM12 7v5l4 3",
  reports: "M4 21V11h4v10M10 21V7h4v14M16 21V3h4v18",
  basket: "M2 3h2l2.2 11h12.2l2-8H5M8 17h9M9 20h.01M16 20h.01",
  chevronDown: "M4 9l8 6 8-6",
  wallet: "M3 6h16a2 2 0 0 1 2 2v13H5a3 3 0 0 1-3-3V6Zm0 0V4h14a2 2 0 0 1 2 2m-3 7h.01",
  bag: "M5 7h14l1 14H4L5 7ZM9 8V5a3 3 0 0 1 6 0v3",
  savings: "M20 3C8 2 2 7 6 15c8 4 13-2 14-12ZM4 21 16 9",
  warning: "m12 3 10 18H2L12 3ZM12 9v5M12 17h.01",
  document: "M6 2h8l5 5v15H6V2ZM14 2v6h5M9 12h7M9 16h7",
  settings: "M10 3h4l.5 2.1 1.8.8 1.8-1.2 2.8 2.8-1.2 1.8.8 1.8L21 14l-2.1.5-.8 1.8 1.2 1.8-2.8 2.8-1.8-1.2-1.8.8L14 21h-4l-.5-2.1-1.8-.8-1.8 1.2-2.8-2.8 1.2-1.8-.8-1.8L3 10l2.1-.5.8-1.8-1.2-1.8 2.8-2.8 1.8 1.2 1.8-.8L10 3ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  route: "M4 19h4a3 3 0 0 0 0-6H7a3 3 0 0 1 0-6h10M17 4l3 3-3 3M4 16l-2 3 2 3",
};

/** Small shared line icons; decorative by default because controls carry labels. */
export function UIIcon({ name, size = 22, style }: { name: string; size?: number; style?: CSSProperties }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d={paths[name] ?? paths.document}/>
  </svg>;
}

/** Fixed-size dropdown indicator; CSS rotates this wrapper around its center. */
export function DropdownChevron({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`dropdown-chevron ${className}`}><UIIcon name="chevronDown" size={24}/></span>;
}
