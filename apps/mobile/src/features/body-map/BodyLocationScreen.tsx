import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { REGIONS, intakeSchema, regionLabel, summarizeSurfaceMarks, type Intake, type Mark, type RegionId, type SurfaceMark } from '@intake/shared';
import { Action, ErrorMessage, Field, Screen, ui } from '@/components/IntakeUI';
import { getDraft, setDraft } from '@/lib/draft';
import { colors } from '@/theme';
import { BodyViewer } from './BodyViewer';

export function BodyLocationScreen() {
  const initial = getDraft();
  const [sex, setSex] = useState<Intake['sex']>(initial?.sex || 'male');
  const [pose, setPose] = useState<Intake['pose']>(initial?.pose || 'neutral');
  const [height, setHeight] = useState(String(initial?.heightCm || 170));
  const [weight, setWeight] = useState(String(initial?.weightKg || 70));
  const [symptoms, setSymptoms] = useState(initial?.symptoms || '');
  const [surface, setSurface] = useState<SurfaceMark[]>(initial?.surfaceMarks || []);
  const [manual, setManual] = useState<Mark[]>(initial?.surfaceMarks?.length ? [] : initial?.regions || []);
  const [undo, setUndo] = useState<{surface:SurfaceMark[];manual:Mark[]}[]>([]);
  const [tool, setTool] = useState<'paint' | 'rotate'>('paint');
  const [accessible, setAccessible] = useState(false);
  const [error, setError] = useState('');
  const summaries = summarizeSurfaceMarks(surface);
  const regions = REGIONS.flatMap(r => {
    const intensity = Math.max(summaries.find(m => m.regionId === r.id)?.intensity || 0, manual.find(m => m.regionId === r.id)?.intensity || 0);
    return intensity ? [{ regionId: r.id, intensity }] : [];
  });
  function commit(next: SurfaceMark[]) { setUndo(current => [...current.slice(-19), {surface,manual}]); setSurface(next); }
  function adjust(regionId: RegionId, delta: number) {
    setUndo(current=>[...current.slice(-19),{surface,manual}]);
    if(surface.some(m=>m.regionId===regionId)) {
      setSurface(current=>current.map(m=>m.regionId===regionId?{...m,intensity:Math.min(10,m.intensity+delta)}:m).filter(m=>m.intensity>=1));
      setManual(current=>current.filter(m=>m.regionId!==regionId));return;
    }
    setManual(current => {
      const level = Math.max(0, Math.min(10, (current.find(r => r.regionId === regionId)?.intensity || 0) + delta));
      return [...current.filter(r => r.regionId !== regionId), ...(level ? [{ regionId, intensity: level }] : [])];
    });
  }
  function next() {
    const result = intakeSchema.safeParse({ sex, pose, heightCm: Number(height.replace(',', '.')), weightKg: Number(weight.replace(',', '.')), regions, surfaceMarks: surface, symptoms });
    if (!result.success) { setError(result.error.issues.map(i => i.path[0] === 'regions' ? 'Paint a symptom area, or use the accessible area controls.' : i.message).join(' ')); return; }
    setDraft(result.data); router.push('/photos');
  }
  return <Screen title="Where does it hurt?" subtitle="Paint the spots that bother you. Hold a spot longer to make it more intense." footer={<Action title="Continue" onPress={next} />}>
    <View style={ui.row} accessibilityRole="radiogroup">{(['male', 'female'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: sex === value }} aria-checked={sex === value} onPress={() => setSex(value)} style={[ui.chip, { flex: 1, alignItems: 'center' }, sex === value && ui.chipSelected]}><Text style={ui.chipText}>{value === 'male' ? 'Male body' : 'Female body'}</Text></Pressable>)}</View>
    <View style={ui.row} accessibilityRole="radiogroup">{(['paint', 'rotate'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: tool === value }} aria-checked={tool === value} onPress={() => setTool(value)} style={[ui.chip, { flex: 1, alignItems: 'center' }, tool === value && ui.chipSelected]}><Text style={ui.chipText}>{value === 'paint' ? 'Paint symptoms' : 'Rotate body'}</Text></Pressable>)}</View>
    <View style={{ height: 400, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.stage }}>
      <BodyViewer sex={sex} pose={pose} marks={manual} surfaceMarks={surface} tool={tool} onPaintCommit={commit} background={colors.stage} />
    </View>
    <View style={ui.between}><Text accessibilityLiveRegion="polite" aria-live="polite" style={[ui.small,{flex:1}]}>{regions.length ? `${regions.length} area${regions.length === 1 ? '' : 's'} marked · peak ${Math.max(...regions.map(r=>r.intensity))}/10` : 'Nothing marked yet'}</Text><View style={ui.row}><Pressable accessibilityRole="button" disabled={!undo.length} onPress={() => { setSurface(undo[undo.length-1].surface); setManual(undo[undo.length-1].manual); setUndo(current => current.slice(0,-1)); }} style={{ padding: 10, minHeight: 44, opacity: undo.length ? 1 : .4 }}><Text style={ui.label}>Undo</Text></Pressable><Pressable accessibilityRole="button" disabled={!surface.length && !manual.length} onPress={() => { commit([]); setManual([]); }} style={{ padding: 10, minHeight: 44 }}><Text style={ui.label}>Clear</Text></Pressable></View></View>
    <Text style={ui.small}>Reported intensity is separate from AI urgency. Switch to Rotate to turn the body; pinch to zoom.</Text>
    <View style={ui.row}>{([{ id: 'neutral', label: 'Front' }, { id: 'turned', label: 'Back' }, { id: 'arms-raised', label: 'Arms up' }] as const).map(p => <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: pose === p.id }} aria-checked={pose === p.id} onPress={() => setPose(p.id)} style={[ui.chip, { flex: 1, alignItems: 'center' }, pose === p.id && ui.chipSelected]}><Text style={ui.chipText}>{p.label}</Text></Pressable>)}</View>
    <Field label="Describe your symptoms" value={symptoms} onChange={setSymptoms} multiline placeholder="What do you feel, and when did it start?" />
    <View style={ui.row}><Field label="Height (cm)" value={height} onChange={setHeight} numeric /><Field label="Weight (kg)" value={weight} onChange={setWeight} numeric /></View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: accessible }} aria-expanded={accessible} onPress={() => setAccessible(!accessible)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>{accessible ? 'Hide' : 'Use'} accessible area controls</Text></Pressable>
    {accessible && <View style={{ gap: 12 }}><Text style={ui.muted}>You can report an area and intensity without using a gesture.</Text>{REGIONS.map(r => <View key={r.id} style={ui.between}><Text style={[ui.text, { flex: 1 }]}>{regionLabel(r.id)}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${r.label} intensity`} style={ui.chip} onPress={() => adjust(r.id, -1)}><Text style={ui.text}>−</Text></Pressable><Text style={ui.text}>{regions.find(m => m.regionId === r.id)?.intensity || 0}/10</Text><Pressable accessibilityRole="button" accessibilityLabel={`Increase ${r.label} intensity`} style={ui.chip} onPress={() => adjust(r.id, 1)}><Text style={ui.text}>+</Text></Pressable></View>)}</View>}
    {!!error && <ErrorMessage message={error} />}
  </Screen>;
}
