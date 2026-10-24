import type { Doctor } from '@intake/shared';
export default function DoctorMap({ doctors, selected }: { doctors: Doctor[]; selected: Doctor | null; onSelect: (doctor: Doctor) => void }) {
  const center = selected || doctors[0]; if (!center) return null;
  const { latitude: lat, longitude: lon } = center;
  const bbox = `${lon - .08},${lat - .05},${lon + .08},${lat + .05}`;
  return <iframe title="Map of selected demo doctor location" src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lon}`} style={{ height: 260, width: '100%', border: 0, borderRadius: 14 }} loading="lazy" />;
}
