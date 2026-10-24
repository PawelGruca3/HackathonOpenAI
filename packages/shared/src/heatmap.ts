import type { Mark, SurfaceMark } from './index';

export const BRUSH_RADIUS = .055;
export const MAX_SURFACE_MARKS = 600;
export function addSurfaceMark(marks: SurfaceMark[], point: Omit<SurfaceMark, 'intensity' | 'radius'>, amount = .6): SurfaceMark[] {
  const index = marks.findIndex(m => (m.x-point.x)**2 + (m.y-point.y)**2 + (m.z-point.z)**2 < .018**2 && m.nx*point.nx + m.ny*point.ny + m.nz*point.nz > .7);
  if (index >= 0) return marks.map((m, i) => i === index ? { ...m, intensity: Math.min(10, m.intensity + amount) } : m);
  if (marks.length >= MAX_SURFACE_MARKS) return marks;
  return [...marks, { ...point, radius: BRUSH_RADIUS, intensity: 1 }];
}
export function summarizeSurfaceMarks(marks: SurfaceMark[]): Mark[] {
  const regions = new Map<Mark['regionId'], number>();
  marks.forEach(m => regions.set(m.regionId, Math.max(regions.get(m.regionId) || 0, Math.ceil(m.intensity))));
  return [...regions].map(([regionId, intensity]) => ({ regionId, intensity }));
}
export function createHeatSampler(marks: SurfaceMark[]) {
  const size = .12;
  const grid = new Map<string, SurfaceMark[]>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  for (const m of marks) {
    const k = key(Math.floor(m.x/size), Math.floor(m.y/size), Math.floor(m.z/size));
    const bucket = grid.get(k) || []; bucket.push(m); grid.set(k, bucket);
  }
  return (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    let intensity = 0;
    const cx = Math.floor(x/size), cy = Math.floor(y/size), cz = Math.floor(z/size);
    for (let dx=-1; dx<=1; dx++) for (let dy=-1; dy<=1; dy++) for (let dz=-1; dz<=1; dz++) {
      const points = grid.get(key(cx+dx, cy+dy, cz+dz));
      if (!points) continue;
      for (const m of points) {
        if (nx*m.nx + ny*m.ny + nz*m.nz < .25) continue;
        const distance = Math.hypot(x-m.x, y-m.y, z-m.z);
        if (distance < m.radius) intensity = Math.max(intensity, m.intensity * Math.pow(1-distance/m.radius, .6));
      }
    }
    return intensity;
  };
}
/** White to soft coral to deep red, with numeric labels supplied separately. */
export function heatColor(value: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, value / 10));
  return [1 - .28*t, 1 - .94*t, 1 - .9*t];
}
