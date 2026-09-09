import type { DetectedLanguage } from "@ecorione/shared-schema";

const INDONESIAN = new Set([
  "yang",
  "dan",
  "di",
  "ke",
  "dari",
  "untuk",
  "dengan",
  "ini",
  "itu",
  "adalah",
  "tidak",
  "saya",
  "kamu",
  "pada",
  "dalam",
  "atau",
  "karena",
  "juga",
  "bisa",
  "akan",
]);
const ENGLISH = new Set([
  "the",
  "and",
  "to",
  "of",
  "in",
  "for",
  "with",
  "this",
  "that",
  "is",
  "not",
  "you",
  "from",
  "on",
  "or",
  "because",
  "also",
  "can",
  "will",
  "are",
]);

export function detectIdEnLanguage(text: string): DetectedLanguage {
  const tokens = text
    .toLowerCase()
    .normalize("NFKC")
    .match(/[a-z]+/g);
  if (tokens === null || tokens.length < 2) return "unknown";
  let id = 0;
  let en = 0;
  for (const token of tokens) {
    if (INDONESIAN.has(token)) id += 1;
    if (ENGLISH.has(token)) en += 1;
  }
  if (id === 0 && en === 0) return "unknown";
  if (id === en) return "unknown";
  return id > en ? "id" : "en";
}
