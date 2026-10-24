import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EMERGENCY_MESSAGE, type CasePacket } from '@intake/shared';
import { Action, Busy, ErrorMessage, Screen, ui } from '@/components/IntakeUI';
import { api } from '@/lib/api';

export default function PhotoQuestions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [packet, setPacket] = useState<CasePacket | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(true);
  const [activity, setActivity] = useState('Reviewing your photos…');
  const [error, setError] = useState('');
  const initializing = useRef(false), answerInput = useRef<ComponentRef<typeof TextInput>>(null);
  async function initialize() {
    if (!id || initializing.current) return;
    initializing.current = true; setBusy(true); setError('');
    setActivity('Reviewing your photos…');
    try {
      const current = await api.case(id);
      if (current.status === 'complete') { router.replace({pathname:'/summary',params:{id}}); return; }
      if (!current.photos.length) { router.replace({pathname:'/photos',params:{id}}); return; }
      const reviewed = await api.reviewPhotos(id);
      setPacket(reviewed);
      setAnswers(Object.fromEntries(reviewed.photoReview!.questions.map(q => [q.id, q.answer || ''])));
      setIndex(0);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); initializing.current = false; }
  }
  useEffect(() => { void initialize(); }, [id]);
  useEffect(() => { if (!busy && packet?.photoReview?.questions.length) answerInput.current?.focus(); }, [index, busy, packet?.photoReview?.id]);
  const review = packet?.photoReview, question = review?.questions[index];
  const last = !review || index >= review.questions.length - 1;
  async function finish(nextAnswers: typeof answers) {
    if (!review || busy) return;
    setBusy(true); setError(''); setActivity('Saving your answers and preparing your summary…');
    try {
      await api.answerPhotos(id, review.id, review.questions.map(q => ({questionId:q.id,answer:nextAnswers[q.id] || ''})));
      await api.phase2(id);
      router.replace({pathname:'/summary',params:{id}});
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function advance(skip = false) {
    if (busy) return;
    const next = question && skip ? {...answers,[question.id]:''} : answers;
    setAnswers(next); setError('');
    if (last) void finish(next); else setIndex(index+1);
  }
  return <Screen title="A few details" subtitle="These questions help clarify what your photos cannot show. Answer what you can." footer={review && <>
    <Action title={busy ? 'Please wait…' : last ? 'Create summary' : 'Next question'} disabled={busy} onPress={() => advance()} />
    {!!question && <Action title={last ? 'Skip & create summary' : 'Skip this question'} secondary disabled={busy} onPress={() => advance(true)} />}
  </>}>
    {busy && <Busy label={activity} />}
    {!!error && <ErrorMessage message={error} retry={!review ? () => void initialize() : undefined} />}
    {review && !busy && <>
      {review.source === 'demo' && <Text style={ui.small}>Demo questions · your photos were not analyzed.</Text>}
      {!!review.urgentAdvice && <View accessibilityRole="alert" style={[ui.card,{backgroundColor:'#fff0f0',borderColor:'#f0c3c7'}]}><Text style={ui.heading}>Do not wait for this intake</Text><Text style={ui.text}>{review.urgentAdvice}</Text><Text style={ui.small}>{EMERGENCY_MESSAGE}</Text></View>}
      {question ? <View style={{gap:16}}>
        <Text accessibilityLiveRegion="polite" style={ui.small}>Question {index+1} of {review.questions.length}</Text>
        <Text accessibilityRole="header" style={ui.heading}>{question.prompt}</Text>
        <TextInput ref={answerInput} accessibilityLabel={question.prompt} multiline maxLength={1500} value={answers[question.id] || ''} onChangeText={text => setAnswers({...answers,[question.id]:text})} placeholder="Your answer, in your own words" placeholderTextColor="#737373" style={[ui.input,{minHeight:140,textAlignVertical:'top'}]} />
        {index > 0 && <Action title="Previous question" secondary onPress={() => {setIndex(index-1);setError('');}} />}
      </View> : <Text style={ui.text}>No further questions are needed from these photos. Continue to create your summary.</Text>}
      <Text style={ui.small}>Photos and answers support your clinician’s review. They cannot confirm a diagnosis or rule out a serious problem.</Text>
    </>}
  </Screen>;
}
