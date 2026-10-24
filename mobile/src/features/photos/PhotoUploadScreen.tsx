import { useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { severityColor, severityLabel } from '@/features/body-map/severity';
import { MAX_PHOTOS, addPhotos, removePhoto, usePhotos, type ReportPhoto } from './photoStore';
import { chooseFromLibrary, takePhoto, type PickResult } from './picker';

const colors = {
  background: '#F6F8FB',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  primary: '#2563EB',
  primarySoft: '#EFF4FF',
  warning: '#B45309',
  warningSoft: '#FFF7ED',
};

const LAYER_LABELS: Record<string, string> = {
  skin: 'Skin',
  muscle: 'Muscle',
  organs: 'Organs',
  bones: 'Bones',
};

const TIPS = [
  'Use daylight or a bright room, without flash glare.',
  'Hold steady so the photo is sharp.',
  'Put a coin or ruler next to it to show the size.',
  'Take one close-up and one from further away.',
];

type Props = {
  part?: string;
  layer?: string;
  severity?: number;
  onBack?: () => void;
  onContinue: (photos: ReportPhoto[]) => void;
};

export function PhotoUploadScreen({ part, layer, severity, onBack, onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const photos = usePhotos();
  const [preview, setPreview] = useState<ReportPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const remaining = MAX_PHOTOS - photos.length;
  const full = remaining <= 0;

  const run = async (pick: () => Promise<PickResult>) => {
    if (busy || full) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await pick();
      if (result.status === 'picked') addPhotos(result.photos);
      if (result.status === 'denied') {
        setNotice('Camera access is turned off. Turn it on in your phone settings, or choose a photo from your gallery instead.');
      }
    } catch {
      setNotice('Something went wrong while adding the photo. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={styles.headerTitle}>Add photos</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Can you see the problem?</Text>
        <Text style={styles.subtitle}>
          If there is something visible, like a rash, swelling or a wound, a photo helps your doctor understand it.
          This step is optional.
        </Text>

        {part ? <SummaryCard part={part} layer={layer} severity={severity} /> : null}

        <View style={styles.actions}>
          <ActionButton
            label="Take a photo"
            icon={<CameraIcon />}
            disabled={busy || full}
            onPress={() => run(takePhoto)}
          />
          <ActionButton
            label="Choose from gallery"
            icon={<GalleryIcon />}
            disabled={busy || full}
            onPress={() => run(() => chooseFromLibrary(remaining))}
          />
        </View>

        {notice ? (
          <View style={styles.notice} accessibilityRole="alert">
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your photos</Text>
          <Text style={styles.counter}>
            {photos.length} / {MAX_PHOTOS}
          </Text>
        </View>

        {photos.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No photos added yet</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {photos.map((photo, index) => (
              <View key={photo.id} style={styles.thumbWrap}>
                <Pressable
                  onPress={() => setPreview(photo)}
                  style={styles.thumbPress}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Photo ${index + 1}, tap to view`}
                >
                  <Image source={{ uri: photo.uri }} style={styles.thumb} />
                </Pressable>
                <Pressable
                  onPress={() => removePhoto(photo.id)}
                  style={styles.removeButton}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                >
                  <Text style={styles.removeIcon}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {full ? <Text style={styles.fullText}>You have added the maximum of {MAX_PHOTOS} photos.</Text> : null}

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Tips for a useful photo</Text>
          {TIPS.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={() => onContinue(photos)}
          style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.continueText}>{photos.length > 0 ? 'Continue' : 'Skip this step'}</Text>
        </Pressable>
      </View>

      <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={styles.previewBackdrop}>
          {preview ? <Image source={{ uri: preview.uri }} style={styles.previewImage} resizeMode="contain" /> : null}
          <View style={[styles.previewActions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              onPress={() => {
                if (preview) removePhoto(preview.id);
                setPreview(null);
              }}
              style={[styles.previewButton, styles.previewRemove]}
              accessibilityRole="button"
            >
              <Text style={styles.previewButtonText}>Remove</Text>
            </Pressable>
            <Pressable onPress={() => setPreview(null)} style={styles.previewButton} accessibilityRole="button">
              <Text style={styles.previewButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryCard({ part, layer, severity }: { part: string; layer?: string; severity?: number }) {
  const layerLabel = layer ? (LAYER_LABELS[layer] ?? layer) : null;
  return (
    <View style={styles.summary}>
      <View style={styles.summaryText}>
        <Text style={styles.summaryLabel}>Selected area</Text>
        <Text style={styles.summaryPart}>{part}</Text>
        {layerLabel ? <Text style={styles.summaryLayer}>{layerLabel}</Text> : null}
      </View>
      {severity !== undefined ? (
        <View style={[styles.severityPill, { backgroundColor: severityColor(severity) }]}>
          <Text style={styles.severityNumber}>{severity}/10</Text>
          <Text style={styles.severityLabel}>{severityLabel(severity)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function CameraIcon() {
  return (
    <View style={icon.cameraWrap}>
      <View style={icon.cameraBump} />
      <View style={icon.cameraBody}>
        <View style={icon.cameraLens} />
      </View>
    </View>
  );
}

function GalleryIcon() {
  return (
    <View style={icon.galleryFrame}>
      <View style={icon.gallerySun} />
      <View style={icon.galleryHill} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 52,
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 34, lineHeight: 36, color: colors.text, marginTop: -4 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 8 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 20,
  },
  summaryText: { flex: 1 },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryPart: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 },
  summaryLayer: { fontSize: 14, color: colors.muted, marginTop: 2 },
  severityPill: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 84 },
  severityNumber: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  severityLabel: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D7FE',
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  actionIcon: { height: 32, justifyContent: 'center', marginBottom: 10 },
  actionLabel: { fontSize: 15, fontWeight: '600', color: colors.primary, textAlign: 'center' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  notice: { backgroundColor: colors.warningSoft, borderRadius: 12, padding: 12, marginTop: 16 },
  noticeText: { fontSize: 14, lineHeight: 20, color: colors.warning },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  counter: { fontSize: 14, color: colors.muted },
  empty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: { fontSize: 15, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { width: '31.5%', aspectRatio: 1 },
  thumbPress: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.border },
  thumb: { width: '100%', height: '100%' },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  fullText: { fontSize: 13, color: colors.muted, marginTop: 10 },
  tips: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 28,
  },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 8, marginRight: 10 },
  tipText: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.muted },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.92)', justifyContent: 'center' },
  previewImage: { flex: 1, width: '100%' },
  previewActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  previewButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRemove: { backgroundColor: '#DC2626' },
  previewButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

const icon = StyleSheet.create({
  cameraWrap: { alignItems: 'center' },
  cameraBump: { width: 12, height: 5, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.primary },
  cameraBody: {
    width: 32,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLens: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: '#FFFFFF' },
  galleryFrame: {
    width: 32,
    height: 26,
    borderRadius: 6,
    borderWidth: 2.5,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  gallerySun: {
    position: 'absolute',
    top: 3,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  galleryHill: {
    position: 'absolute',
    bottom: -10,
    left: -2,
    width: 22,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
});
