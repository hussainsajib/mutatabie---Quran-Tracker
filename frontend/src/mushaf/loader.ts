import type { MushafIndex, PageData } from "./types";

let cachedIndex: MushafIndex | null = null;

export async function loadIndex(): Promise<MushafIndex> {
  if (cachedIndex) return cachedIndex;
  const res = await fetch("/mushaf/index.json");
  if (!res.ok) throw new Error(`Failed to load mushaf index: HTTP ${res.status}`);
  cachedIndex = (await res.json()) as MushafIndex;
  return cachedIndex;
}

export async function loadPage(page: number): Promise<PageData> {
  const res = await fetch(`/mushaf/pages/${page}.json`);
  if (!res.ok) throw new Error(`Failed to load page ${page}: HTTP ${res.status}`);
  return (await res.json()) as PageData;
}

/** Font families required to render a page. */
export function fontsForPage(data: PageData): string[] {
  const fams = [`p${data.page}`];
  for (const line of data.lines) {
    if (line.type === "surah_name") fams.push("surah-name-v4");
    if (line.type === "basmallah") fams.push("QCF4_Hafs_01");
  }
  return fams;
}

const injected = new Set<string>();

/** Idempotently inject an @font-face for a mushaf font family. */
export function injectFontFace(name: string): void {
  if (injected.has(name)) return;
  injected.add(name);

  // The basmalah font file carries a `_W` suffix on disk, unlike its family name.
  const url = /^p\d+$/.test(name)
    ? `/fonts/qpcv4/${name}.woff2`
    : name === "QCF4_Hafs_01"
      ? `/fonts/QCF4_Hafs_01_W.woff2`
      : `/fonts/${name}.woff2`;

  const style = document.createElement("style");
  style.setAttribute("data-face", name);
  style.textContent =
    `@font-face{font-family:'${name}';src:url('${url}') format('woff2');font-display:swap}`;
  document.head.appendChild(style);
}
