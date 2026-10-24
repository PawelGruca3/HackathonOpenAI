import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Action, Screen, ui } from '@/components/IntakeUI';
import { setDraft } from '@/lib/draft';
import { clearPhotos } from '@/features/photos/photoStore';
import { EMERGENCY_MESSAGE } from '@intake/shared';
export default function Home() {
  return <Screen title="Let's get the full picture." subtitle="A clearer picture before the first hello." back={false}>
    <View style={[ui.card, { paddingVertical: 30, gap: 20 }]}><Text style={[ui.heading, { fontSize: 23 }]}>What’s bothering you?</Text><Text style={ui.text}>Mark the areas on your body, describe how you feel, and add photos if there’s something to see.</Text><Action title="Start a new case" onPress={() => { setDraft(null); clearPhotos(); router.push('/intake'); }} /></View>
    <View style={{ gap: 14 }}><Text style={ui.heading}>Your care, over time</Text><Text style={ui.muted}>Revisit past intakes, height and weight, and notes from your clinician.</Text><Action title="View case history" secondary onPress={() => router.push('/history')} /></View>
    <View style={ui.divider} /><Text style={ui.small}>Demo patient account · Use sample information only. AI helps organize your intake; a licensed clinician makes care decisions.</Text><Text style={ui.small}>{EMERGENCY_MESSAGE}</Text>
  </Screen>;
}
