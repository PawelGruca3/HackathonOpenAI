import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';
import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';
import type { CasePacket, Doctor, Intake, RegionId, Specialty } from '@intake/shared';
import type { ReportPhoto } from '@/features/photos/photoStore';

const host = Constants.expoConfig?.hostUri?.split(':')[0];
export const API_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3000` : `http://${host || 'localhost'}:3000`);
export const patientHeaders = { 'x-demo-patient': process.env.EXPO_PUBLIC_DEMO_PATIENT_TOKEN || 'demo-patient' };
export async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { ...patientHeaders, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(90000),
  }).catch(() => { throw new Error('Unable to reach the intake service. Check your connection and try again.'); });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to save your intake. Please retry.');
  return data;
}
export const api = {
  cases: () => request<CasePacket[]>('cases'), case: (id: string) => request<CasePacket>(`cases/${id}`),
  create: (input: Intake) => request<CasePacket>('cases', input),
  phase1: (id: string) => request<CasePacket>(`cases/${id}/phase1`, {}),
  reviewPhotos: (id: string) => request<CasePacket>(`cases/${id}/photo-review`, {}),
  answerPhotos: (id: string, reviewId: string, answers: {questionId: string; answer: string}[]) => request<CasePacket>(`cases/${id}/photo-answers`, {reviewId, answers}),
  phase2: (id: string) => request<CasePacket>(`cases/${id}/phase2`, {}),
  removePhoto: async (id: string) => {
    const response = await fetch(`${API_URL}/api/photos/${id}`, { method: 'DELETE', headers: patientHeaders });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to remove the photo. Please retry.');
    return data as CasePacket;
  },
  doctors: (specialty?: Specialty) => request<Doctor[]>(`doctors${specialty ? `?specialty=${encodeURIComponent(specialty)}` : ''}`),
};
export function photoSource(id: string) { return { uri: `${API_URL}/api/photos/${id}`, headers: patientHeaders }; }
export async function uploadPhoto(caseId: string, regionId: RegionId, photo: ReportPhoto): Promise<CasePacket> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(photo.uri)).blob();
    form.append('file', blob, `photo.${blob.type === 'image/png' ? 'png' : 'jpg'}`);
  } else {
    form.append('file', new ExpoFile(photo.uri));
  }
  form.append('regionId', regionId);
  const response = await expoFetch(`${API_URL}/api/cases/${caseId}/photos`, { method: 'POST', headers: patientHeaders, body: form, signal: AbortSignal.timeout(60000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Photo upload failed. Please retry.');
  return data;
}
