// Section 4.8's "channel audit" feature: flag content worth revisiting.
// Kept intentionally simple for v1 — relative to the channel's own average,
// not an external benchmark (which would need much more data to be fair).

export function flagUnderperforming<T>(
  items: T[],
  getMetric: (item: T) => number,
  thresholdRatio = 0.5 // flag anything below 50% of the channel's own average
): (T & { underperforming: boolean })[] {
  if (items.length === 0) return [];
  const avg = items.reduce((sum, i) => sum + getMetric(i), 0) / items.length;
  return items.map((item) => ({
    ...item,
    underperforming: getMetric(item) < avg * thresholdRatio,
  }));
}
