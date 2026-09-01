import type { UtilityPoint } from "../schemas/preferences";
export function piecewiseUtility(value: number, points: readonly UtilityPoint[]): number {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (sorted.length < 2) throw new Error("A utility curve needs at least two points.");
  if (value <= sorted[0].x) return sorted[0].score;
  if (value >= sorted.at(-1)!.x) return sorted.at(-1)!.score;
  const right = sorted.find(point => point.x >= value)!; const left = sorted[sorted.indexOf(right) - 1];
  return left.score + ((value - left.x) / (right.x - left.x)) * (right.score - left.score);
}
