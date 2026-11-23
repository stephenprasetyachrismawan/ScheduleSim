// Numbers in Indonesian notation (decimal comma), the same convention as the thesis.

const cache = new Map<number, Intl.NumberFormat>();

export function angka(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  let f = cache.get(digits);
  if (!f) {
    f = new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits,
                                          maximumFractionDigits: digits });
    cache.set(digits, f);
  }
  return f.format(value);
}

/** Model time in hours, as the thesis keeps it ("jam ke-12,5"). */
export function jamKe(value: number | null | undefined, digits = 1): string {
  return `jam ke-${angka(value, digits)}`;
}

export function jam(value: number | null | undefined, digits = 1): string {
  return `${angka(value, digits)} j`;
}

export function persen(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  const s = angka(Math.abs(value), digits);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${s}%`;
}

export function lambdaLabel(value: number): string {
  return angka(value, value < 1 ? 1 : 0);
}
