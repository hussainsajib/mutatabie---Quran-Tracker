export interface Word {
  id: number;
  s: number; // surah
  a: number; // ayah
  n: number; // word number within ayah
  loc: string; // "surah:ayah:word"
  text: string;
  codes: number[];
}

export type LineType = "surah_name" | "basmallah" | "ayah";

export interface Line {
  type: LineType;
  centered: boolean;
  surah?: number;
  words?: Word[];
}

export interface PageData {
  page: number;
  surah: number | null;
  lines: Line[];
}

export interface MushafIndex {
  numPages: number;
  surahNames: Record<string, string>;
  surahStartPage: Record<string, number>;
  juzStartPage: Record<string, number>;
}

export type MistakeType = "hifdh" | "tajweed";

export type MushafEdition = "v1" | "v2" | "v4";

export interface Mark {
  id: string;
  word_id: number;
  location: string;
  surah: number;
  ayah: number;
  word_number: number;
  mistake_type: MistakeType;
  note: string | null;
  repeat_count: number;
  created_at: string;
  updated_at: string;
}
