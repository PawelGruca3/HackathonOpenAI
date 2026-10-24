import { useSyncExternalStore } from 'react';

export const MAX_PHOTOS = 6;

export type ReportPhoto = {
  id: string;
  uri: string;
  width: number;
  height: number;
};

// Module-level so the photos survive navigating back to the body map and returning.
let photos: ReportPhoto[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPhotos(): ReportPhoto[] {
  return photos;
}

export function addPhotos(next: ReportPhoto[]) {
  if (next.length === 0) return;
  photos = [...photos, ...next].slice(0, MAX_PHOTOS);
  emit();
}

export function removePhoto(id: string) {
  photos = photos.filter((photo) => photo.id !== id);
  emit();
}

export function clearPhotos() {
  photos = [];
  emit();
}

export function usePhotos(): ReportPhoto[] {
  return useSyncExternalStore(subscribe, getPhotos, getPhotos);
}
