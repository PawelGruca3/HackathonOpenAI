import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { SPECIALTIES, type Doctor, type Specialty } from '@intake/shared';
import { Action, Busy, ErrorMessage, Screen, ui } from '@/components/IntakeUI';
import DoctorMap from '@/features/doctors/DoctorMap';
import { api } from '@/lib/api';
export default function Doctors() {
  const params = useLocalSearchParams<{ specialty?: string }>();
  const [specialty, setSpecialty] = useState<Specialty>(SPECIALTIES.find(s => s === params.specialty) || 'Primary Care');
  const [doctors, setDoctors] = useState<Doctor[]>([]); const [selected, setSelected] = useState<Doctor | null>(null); const [city, setCity] = useState('New York, NY');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; setLoading(true); setError(''); api.doctors(specialty).then(ds => { if (active) { setDoctors(ds); setSelected(null); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [specialty, retry]);
  const local = doctors.filter(d => d.city === city);
  async function openDoctor(d: Doctor) { try { await Linking.openURL(d.website); } catch { setError('Could not open the website. Please try again.'); } }
  return <Screen title="Find your next step." subtitle="Explore doctors by the recommended specialty.">
    <Text style={ui.label}>Specialty</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{SPECIALTIES.map(s => <Pressable key={s} accessibilityRole="radio" accessibilityState={{ checked: specialty === s }} aria-checked={specialty === s} onPress={() => setSpecialty(s)} style={[ui.chip, s === specialty && ui.chipSelected]}><Text style={ui.chipText}>{s}</Text></Pressable>)}</View>
    <View style={ui.row}>{['New York, NY', 'San Francisco, CA'].map(c => <Pressable key={c} accessibilityRole="radio" accessibilityState={{ checked: city === c }} aria-checked={city === c} style={[ui.chip, { flex: 1 }, city === c && ui.chipSelected]} onPress={() => { setCity(c); setSelected(null); }}><Text style={ui.chipText}>{c}</Text></Pressable>)}</View>
    {loading ? <Busy label="Finding doctors…" /> : <><DoctorMap doctors={local} selected={selected} onSelect={setSelected} /><Text style={ui.small}>Illustrative directory: clinician names and pin locations are fictional. Websites open real health-system homepages; these are not verified provider affiliations or appointments.</Text>{local.map(d => <View key={d.id} style={[ui.card, selected?.id === d.id && { borderColor: '#2463dc' }]}><Pressable accessibilityRole="button" onPress={() => setSelected(d)}><Text style={ui.heading}>{d.name}</Text><Text style={ui.muted}>{d.specialty}</Text><Text style={ui.small}>{d.address}</Text></Pressable><Action title="Open health-system website" onPress={() => void openDoctor(d)} secondary /></View>)}{!local.length && <Text style={ui.muted}>No demo doctors found for this specialty and city. Try another specialty.</Text>}</>}
    {!!error && <ErrorMessage message={error} retry={() => setRetry(v => v + 1)} />}
  </Screen>;
}
