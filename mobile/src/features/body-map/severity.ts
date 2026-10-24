export const SEVERITY_MIN = 1;
export const SEVERITY_MAX = 10;

// Green -> yellow -> orange -> red, positioned along the 0..1 slider range.
export const SEVERITY_STOPS: { at: number; color: string }[] = [
  { at: 0, color: '#22c55e' },
  { at: 0.4, color: '#eab308' },
  { at: 0.7, color: '#f97316' },
  { at: 1, color: '#dc2626' },
];

export function severityFromValue(value: number): number {
  return SEVERITY_MIN + Math.round(value * (SEVERITY_MAX - SEVERITY_MIN));
}

export function valueFromSeverity(level: number): number {
  return (level - SEVERITY_MIN) / (SEVERITY_MAX - SEVERITY_MIN);
}

export function severityColor(level: number): string {
  const t = valueFromSeverity(level);
  const upper = SEVERITY_STOPS.findIndex((s) => s.at >= t);
  if (upper <= 0) return SEVERITY_STOPS[0].color;
  const a = SEVERITY_STOPS[upper - 1];
  const b = SEVERITY_STOPS[upper];
  return mixHex(a.color, b.color, (t - a.at) / (b.at - a.at));
}

export function severityLabel(level: number): string {
  if (level <= 3) return 'Mild';
  if (level <= 6) return 'Moderate';
  if (level <= 8) return 'Severe';
  return 'Very severe';
}

function mixHex(from: string, to: string, t: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const channel = (shift: number) => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t);
  };
  const rgb = (channel(16) << 16) | (channel(8) << 8) | channel(0);
  return `#${rgb.toString(16).padStart(6, '0')}`;
}
