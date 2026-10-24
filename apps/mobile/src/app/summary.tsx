import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { DISCLAIMER, EMERGENCY_MESSAGE, regionLabel } from '@intake/shared';
import { Action, Busy, Disclosure, ErrorMessage, Screen, ui } from '@/components/IntakeUI';
import { BodyViewer } from '@/features/body-map/BodyViewer';
import { colors } from '@/theme';
import { usePacket } from '@/hooks/usePacket';
import { photoSource } from '@/lib/api';
export default function Summary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { packet, loading, error, refresh } = usePacket(id);
  const [professional, setProfessional] = useState(false);
  const a = packet?.assessment;
  return <Screen title="Your intake, together." subtitle="A starting point for a conversation with a clinician.">
    {loading ? <Busy /> : error ? <ErrorMessage message={error} retry={() => void refresh()} /> : !packet ? null : !a ? <><Text style={ui.text}>Your intake is not complete yet.</Text><Action title="Continue intake" onPress={() => router.replace({ pathname: '/photos', params: { id } })} /></> : <>
      {a.source === 'demo' && <View style={[ui.card, { backgroundColor: '#fff6e4' }]}><Text style={ui.text}>Demonstration summary</Text><Text style={ui.muted}>No medical or image analysis was performed. The urgency value below is a fixed demo value.</Text></View>}
      {a.source !== 'demo' && a.urgency >= 8 && <View style={[ui.card, { backgroundColor: '#fff0f0', borderColor: '#f0c3c7' }]}><Text style={[ui.heading, { color: '#a02b34' }]}>Contact a doctor promptly</Text><Text style={ui.text}>{a.urgencyReason}</Text><Action title="Contact a doctor" onPress={() => router.push({ pathname: '/doctors', params: { specialty: a.specialty } })} /></View>}
      <View style={ui.card}><Text style={ui.heading}>{a.source === 'demo' ? 'Demo urgency' : 'AI-estimated urgency'} · {a.urgency}/10</Text><Text style={ui.text}>{a.urgencyReason}</Text><Text style={ui.small}>This is separate from your reported intensity. A low estimate does not guarantee safety.</Text></View>
      <View style={{ gap: 12 }}><Text style={ui.heading}>What you shared</Text><Text style={ui.text}>{a.patientSummary}</Text></View>
      <View style={ui.card}><Text style={ui.label}>Recommended specialty</Text><Text style={ui.heading}>{a.specialty}</Text><Action title="Find doctors" onPress={() => router.push({ pathname: '/doctors', params: { specialty: a.specialty } })} /></View>
      <View style={{ gap: 12 }}><Text style={ui.heading}>Suggested next steps</Text>{a.nextSteps.map((step, i) => <Text key={i} style={ui.text}>{i + 1}. {step}</Text>)}</View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: professional }} style={ui.chip} onPress={() => setProfessional(!professional)}><Text style={ui.chipText}>{professional ? 'Hide' : 'Read'} the professional assessment</Text></Pressable>{professional && <Text style={ui.text}>{a.professionalAssessment}</Text>}
      <View style={{ gap: 12 }}><Text style={ui.heading}>Your original intake</Text><Text style={ui.text}>{packet.symptoms}</Text><Text style={ui.muted}>{packet.heightCm} cm · {packet.weightKg} kg · {packet.sex} body</Text>{packet.regions.map(r => <View key={r.regionId} style={ui.between}><Text style={ui.text}>{regionLabel(r.regionId)}</Text><Text style={ui.muted}>Intensity {r.intensity}/10</Text></View>)}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{packet.photos.map(p => <Image key={p.id} source={photoSource(p.id)} accessibilityLabel={regionLabel(p.regionId)} style={{ width: 100, height: 100, borderRadius: 12 }} />)}</View></View>
      {!!packet.photoReview?.questions.length && <Disclosure title="Your photo follow-up">{packet.photoReview.questions.map(q => <View key={q.id} style={{gap:6}}><Text style={ui.label}>{q.prompt}</Text><Text style={ui.text}>{q.answer || 'Not answered'}</Text></View>)}</Disclosure>}
      <View style={{ gap: 12 }}><Text style={ui.heading}>Notes from your clinician</Text>{packet.annotations.length ? packet.annotations.map(n => <View key={n.id} style={ui.card}><Text style={ui.label}>{n.doctor} · {new Date(n.createdAt).toLocaleDateString()}</Text><Text style={ui.text}>{n.text}</Text></View>) : <Text style={ui.muted}>Your clinician’s notes will appear here after review.</Text>}</View>
      {!!packet.surfaceMarks?.length&&<Disclosure title="View your symptom map"><View style={{height:340,borderRadius:12,overflow:'hidden',backgroundColor:colors.stage}}><BodyViewer sex={packet.sex} surfaceMarks={packet.surfaceMarks} marks={packet.regions} background={colors.stage}/></View></Disclosure>}
      <Text style={ui.small}>{DISCLAIMER}</Text><Disclosure title="Limitations">{a.limitations.filter(l => l !== DISCLAIMER).map(l => <Text style={ui.small} key={l}>{l}</Text>)}</Disclosure><Text style={ui.small}>{EMERGENCY_MESSAGE}</Text><Action title="Back to home" secondary onPress={() => router.replace('/')} />
    </>}
  </Screen>;
}
