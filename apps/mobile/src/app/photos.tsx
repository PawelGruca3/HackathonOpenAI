import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { regionLabel, type CasePacket, type RegionId } from '@intake/shared';
import { Action, Busy, ErrorMessage, Screen, ui } from '@/components/IntakeUI';
import { getDraft } from '@/lib/draft';
import { api, photoSource, uploadPhoto } from '@/lib/api';
import { chooseFromLibrary, takePhoto } from '@/features/photos/picker';
import type { ReportPhoto } from '@/features/photos/photoStore';

export default function Photos() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const savedId = useRef<string | undefined>(id), initializing = useRef(false);
  const [packet, setPacket] = useState<CasePacket | null>(null);
  const [busy, setBusy] = useState(true), [activity, setActivity] = useState('Preparing photo suggestions…');
  const [error, setError] = useState(''), [active, setActive] = useState<RegionId | null>(null);
  const [pending, setPending] = useState<{ photo: ReportPhoto; regionId: RegionId }[]>([]);
  async function initialize() {
    if (initializing.current) return; initializing.current = true; setBusy(true); setError('');
    try {
      let p: CasePacket;
      if (savedId.current) p = await api.case(savedId.current);
      else {
        const draft = getDraft(); if (!draft) throw new Error('Complete the symptom map before adding photos.');
        p = await api.create(draft); savedId.current = p.id; router.setParams({ id: p.id });
      }
      setPacket(p);
      if (p.status === 'complete') { router.replace({ pathname: '/summary', params: { id: p.id } }); return; }
      if (!p.photoRequests) p = await api.phase1(p.id);
      setPacket(p); setActive(p.photoRequests?.requests[0]?.regionId || p.regions[0]?.regionId || null);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); initializing.current = false; }
  }
  useEffect(() => { void initialize(); }, []);
  async function upload(queue: typeof pending) {
    if (!savedId.current) return;
    setBusy(true); setError(''); setActivity('Uploading your photos…');
    try {
      for (let i=0; i<queue.length; i++) {
        setPacket(await uploadPhoto(savedId.current, queue[i].regionId, queue[i].photo));
        setPending(queue.slice(i+1));
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function pick(camera: boolean) {
    if (!packet || !active || busy || pending.length) return;
    setBusy(true); setError(''); setActivity('Opening your camera or library…');
    try {
      const result = await (camera ? takePhoto() : chooseFromLibrary(6-packet.photos.length));
      if (result.status === 'denied') throw new Error('Allow camera access in Settings, or choose a photo from your library.');
      if (result.status === 'picked') {
        const queue = result.photos.map(photo => ({ photo, regionId: active })); setPending(queue); await upload(queue);
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (busy) return; setBusy(true); setError(''); setActivity('Removing photo…');
    try { setPacket(await api.removePhoto(id)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function submit() {
    if (!packet || busy || pending.length) return;
    if (packet.photos.length) { router.push({ pathname: '/photo-questions', params: { id: packet.id } }); return; }
    setBusy(true); setError(''); setActivity('Preparing your summary…');
    try { const updated = await api.phase2(packet.id); router.replace({ pathname: '/summary', params: { id: updated.id } }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const reason = packet?.photoRequests?.requests.find(r => r.regionId === active)?.reason;
  return <Screen title="Add photos" subtitle="Optional photos help your clinician understand visible symptoms." footer={packet?.photoRequests && <Action title={busy ? 'Please wait…' : packet.photos.length ? 'Review photos & continue' : 'Continue without photos'} disabled={busy || !!pending.length} onPress={() => void submit()} />}>
    {busy && <Busy label={activity} />}
    {!!error && <ErrorMessage message={error} retry={pending.length ? () => void upload(pending) : !packet?.photoRequests ? () => void initialize() : undefined} />}
    {!!pending.length && <View style={{gap:12}}><Text style={ui.label}>Waiting to upload · {pending.length}</Text><View style={[ui.row,{flexWrap:'wrap'}]}>{pending.map(({photo}) => <Image key={photo.id} source={{uri:photo.uri}} style={{width:72,height:72,borderRadius:8}} />)}</View><Pressable accessibilityRole="button" onPress={() => {setPending([]);setError('');}} disabled={busy} style={{minHeight:44,justifyContent:'center'}}><Text style={ui.muted}>Discard pending photos</Text></Pressable></View>}
    {packet?.photoRequests && <>
      {packet.photoRequests.source === 'demo' && <Text style={ui.small}>Demo suggestions · no AI analysis performed.</Text>}
      <View style={{gap:12}}><Text style={ui.label}>Choose an area</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{packet.regions.map(r => <Pressable key={r.regionId} accessibilityRole="radio" accessibilityState={{checked:active===r.regionId}} aria-checked={active===r.regionId} onPress={() => setActive(r.regionId)} style={[ui.chip,active===r.regionId&&ui.chipSelected]}><Text style={ui.chipText}>{regionLabel(r.regionId)}</Text></Pressable>)}</View>{!!reason&&<Text style={ui.muted}>{reason}</Text>}</View>
      <View style={{gap:10}}><Action title="Take a photo" secondary disabled={busy||packet.photos.length>=6||!!pending.length} onPress={() => void pick(true)} /><Action title="Choose from library" secondary disabled={busy||packet.photos.length>=6||!!pending.length} onPress={() => void pick(false)} /></View>
      <View style={{gap:14}}><Text style={ui.heading}>Photos · {packet.photos.length}/6</Text>{!packet.photos.length&&<Text style={ui.muted}>No photos attached.</Text>}<View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{packet.photos.map(p=><View key={p.id} style={{width:'46%',gap:6}}><Image source={photoSource(p.id)} style={{width:'100%',height:150,borderRadius:10}} /><Text style={ui.small}>{regionLabel(p.regionId)}</Text><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Remove photo of ${regionLabel(p.regionId)}`} onPress={()=>void remove(p.id)} style={{minHeight:44,justifyContent:'center'}}><Text style={ui.muted}>Remove</Text></Pressable></View>)}</View></View>
      <Text style={ui.small}>JPEG, PNG or WebP · up to 8 MB each.</Text>
    </>}
  </Screen>;
}
