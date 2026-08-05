export const PRECISION_DIGITS = 6;

export function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function roundNumber(value: number, digits = PRECISION_DIGITS): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  const factor = 10 ** digits;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function normalizeRotation(rotationDeg: number): number {
  return roundNumber(((rotationDeg % 360) + 360) % 360);
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value as Readonly<T>;
  }

  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return value as Readonly<T>;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
