/** Seven authored prisms recede one by one, with a partial prism between stages. */
export function crystalStage(fraction: number, index: number, count: number) {
  const remaining = Math.max(0, Math.min(1, fraction)) * count - index
  return {
    visible: remaining > 0,
    scale: 0.1 + 0.9 * Math.max(0, Math.min(1, remaining)),
  }
}
export function mineralGrade(fraction: number): string {
  return fraction <= 0
    ? 'DEPLETED'
    : fraction <= 0.25
      ? 'TRACE'
      : fraction <= 0.5
        ? 'LOW'
        : fraction <= 0.75
          ? 'WORKED'
          : 'RICH'
}
