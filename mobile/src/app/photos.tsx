import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { SEVERITY_MAX, SEVERITY_MIN } from '@/features/body-map/severity';
import { PhotoUploadScreen } from '@/features/photos/PhotoUploadScreen';

type Params = {
  part?: string;
  layer?: string;
  severity?: string;
};

export default function PhotosRoute() {
  const { part, layer, severity } = useLocalSearchParams<Params>();
  const level = Number(severity);
  const validSeverity = Number.isInteger(level) && level >= SEVERITY_MIN && level <= SEVERITY_MAX;

  // The router throws if asked during the first render, so check once mounted.
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => {
    setCanGoBack(router.canGoBack());
  }, []);

  return (
    <PhotoUploadScreen
      part={part}
      layer={layer}
      severity={validSeverity ? level : undefined}
      onBack={canGoBack ? () => router.back() : undefined}
      onContinue={() => {
        // The next step of the report isn't built yet; photos stay available via getPhotos().
      }}
    />
  );
}
