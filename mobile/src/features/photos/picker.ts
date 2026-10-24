import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import type { ReportPhoto } from './photoStore';

export type PickResult =
  | { status: 'picked'; photos: ReportPhoto[] }
  | { status: 'canceled' }
  | { status: 'denied' };

const QUALITY = 0.7;

let nextId = 0;

function toPhotos(assets: ImagePicker.ImagePickerAsset[]): ReportPhoto[] {
  return assets.map((asset) => ({
    id: `photo-${Date.now()}-${nextId++}`,
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  }));
}

export async function takePhoto(): Promise<PickResult> {
  // Permission requests are no-ops on web; the browser asks when the camera opens.
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: QUALITY });
  if (result.canceled) return { status: 'canceled' };
  return { status: 'picked', photos: toPhotos(result.assets) };
}

export async function chooseFromLibrary(limit: number): Promise<PickResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: QUALITY,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
  });
  if (result.canceled) return { status: 'canceled' };
  // Web ignores selectionLimit, so trim here as well.
  return { status: 'picked', photos: toPhotos(result.assets.slice(0, limit)) };
}
