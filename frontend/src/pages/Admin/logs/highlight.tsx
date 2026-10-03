import type { ReactNode } from "react";

// A busca ignora acentos e maiúsculas; o destaque também.
const ACCENTS: Record<string, string> = {
  a: "aàáâãä",
  e: "eèéêë",
  i: "iìíîï",
  o: "oòóôõö",
  u: "uùúûü",
  c: "cç",
  n: "nñ",
};

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Mesmo parsing do backend: palavras soltas ou "frases exatas" entre aspas. */
export function parseTerms(input?: string): string[] {
  if (!input) return [];
  const terms: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) && terms.length < 8) {
    let t = normalize(m[1] ?? m[2]);
    if (m[1] === undefined) t = t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (t) terms.push(t);
  }
  return terms;
}

function termPattern(term: string): string {
  return [...term]
    .map((ch) => {
      const cls = ACCENTS[ch];
      if (cls) return `[${cls}]`;
      return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
}

export function highlight(text: string, terms: string[]): ReactNode {
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map(termPattern).join("|")})`, "gi");
  const parts = text.split(re);
  if (parts.length === 1) return text;

  // Com um único grupo de captura, os índices ímpares são os trechos que casaram.
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-[var(--accent-soft)] px-0.5 text-[var(--accent)]">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
