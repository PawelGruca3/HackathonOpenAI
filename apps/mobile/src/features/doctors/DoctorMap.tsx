import MapView, { Marker } from 'react-native-maps';
import type { Doctor } from '@intake/shared';
export default function DoctorMap({ doctors, selected, onSelect }: { doctors: Doctor[]; selected: Doctor | null; onSelect: (doctor: Doctor) => void }) {
  const center = selected || doctors[0];
  if (!center) return null;
  return <MapView style={{ height: 260, borderRadius: 14 }} region={{ latitude: center.latitude, longitude: center.longitude, latitudeDelta: .12, longitudeDelta: .12 }} accessibilityLabel="Map of demo doctor locations">{doctors.map(d => <Marker key={d.id} coordinate={{ latitude: d.latitude, longitude: d.longitude }} title={d.name} description={d.specialty} onPress={() => onSelect(d)} pinColor={selected?.id === d.id ? '#2463dc' : '#6a8198'} />)}</MapView>;
}
