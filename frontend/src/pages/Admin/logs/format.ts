const TZ = "America/Fortaleza";

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
}

export function formatDayLabel(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}

export function formatLatency(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1).replace(".", ",")} s` : `${ms} ms`;
}

export function percent(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}
