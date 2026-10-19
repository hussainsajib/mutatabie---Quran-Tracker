import type { MushafEdition, MushafIndex, PageData } from "./types";

// Base URL for static assets (mushaf JSON + page fonts). Empty in dev so the
// Vite dev server serves them from /public; set to the GCS bucket in production
// via VITE_ASSETS_URL (frontend/.env.production).
const ASSETS_BASE = import.meta.env.VITE_ASSETS_URL ?? "";

const indexCache: Partial<Record<MushafEdition, MushafIndex>> = {};

export async function loadIndex(edition: MushafEdition): Promise<MushafIndex> {
  const cached = indexCache[edition];
  if (cached) return cached;
  const res = await fetch(`${ASSETS_BASE}/mushaf/${edition}/index.json`);
  if (!res.ok) throw new Error(`Failed to load mushaf index: HTTP ${res.status}`);
  const index = (await res.json()) as MushafIndex;
  indexCache[edition] = index;
  return index;
}

export async function loadPage(edition: MushafEdition, page: number): Promise<PageData> {
  const res = await fetch(`${ASSETS_BASE}/mushaf/${edition}/pages/${page}.json`);
  if (!res.ok) throw new Error(`Failed to load page ${page}: HTTP ${res.status}`);
  return (await res.json()) as PageData;
}

/** Font families required to render a page of the given edition. */
export function fontsForPage(edition: MushafEdition, data: PageData): string[] {
  const fams = [`${edition}-p${data.page}`];
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

  // Page fonts are namespaced by edition: "v1-p42" -> /fonts/qpcv1/p42.woff2.
  // The basmalah font file carries a `_W` suffix on disk, unlike its family name.
  const pageMatch = /^(v[124])-p(\d+)$/.exec(name);
  const url = pageMatch
    ? `${ASSETS_BASE}/fonts/qpc${pageMatch[1]}/p${pageMatch[2]}.woff2`
    : name === "QCF4_Hafs_01"
      ? `${ASSETS_BASE}/fonts/QCF4_Hafs_01_W.woff2`
      : `${ASSETS_BASE}/fonts/${name}.woff2`;

  const style = document.createElement("style");
  style.setAttribute("data-face", name);
  style.textContent =
    `@font-face{font-family:'${name}';src:url('${url}') format('woff2');font-display:swap}`;
  document.head.appendChild(style);
}
