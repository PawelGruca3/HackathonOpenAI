import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';
import type { CasePacket } from '@intake/shared';
import { Action, Busy, ErrorMessage, Screen, ui } from '@/components/IntakeUI';
import { api } from '@/lib/api';
export default function History() {
  const [cases, setCases] = useState<CasePacket[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setCases(await api.cases()); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const complete = cases.filter(c => c.status === 'complete');
  return <Screen title="Your care, over time." subtitle="Past cases, your vitals, and notes from your clinician.">
    {loading ? <Busy /> : error ? <ErrorMessage message={error} retry={() => void load()} /> : !cases.length ? <View style={ui.card}><Text style={ui.heading}>Your history starts here</Text><Text style={ui.muted}>Once you save an intake, you can revisit it here.</Text><Action title="Start a new case" onPress={() => router.push('/intake')} /></View> : <>
      <Text style={ui.heading}>Height & weight</Text>{complete.length ? <View style={ui.card}>{complete.map(p => <View style={ui.between} key={p.id}><Text style={ui.small}>{new Date(p.createdAt).toLocaleDateString()}</Text><Text style={ui.text}>{p.heightCm} cm</Text><Text style={ui.text}>{p.weightKg} kg</Text></View>)}</View> : <Text style={ui.muted}>Complete a case to begin your vitals timeline.</Text>}
      <Text style={ui.heading}>Case timeline</Text>{cases.map(p => <View key={p.id} style={ui.card}><Text style={ui.label}>{new Date(p.createdAt).toLocaleString()}</Text><Text style={ui.heading}>{p.assessment?.specialty || 'Intake in progress'}</Text><Text style={ui.text} numberOfLines={3}>{p.assessment?.patientSummary || p.symptoms}</Text><Text style={ui.small}>{p.regions.length} reported areas · {p.assessment ? `${p.assessment.source === 'demo' ? 'Demo' : 'AI-estimated'} urgency ${p.assessment.urgency}/10` : 'No urgency estimate yet'}</Text>{p.annotations.map(n => <View key={n.id} style={{ gap: 4 }}><Text style={ui.label}>{n.doctor} · {new Date(n.createdAt).toLocaleDateString()}</Text><Text style={ui.text}>{n.text}</Text></View>)}<Action title={p.status === 'complete' ? 'Open case' : 'Continue intake'} secondary onPress={() => router.push({ pathname: p.status === 'complete' ? '/summary' : '/photos', params: { id: p.id } })} /></View>)}
    </>}
  </Screen>;
}
