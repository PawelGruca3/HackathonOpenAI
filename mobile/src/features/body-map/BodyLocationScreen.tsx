import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { BodyViewer, type BodySelection } from './BodyViewer';
import { LAYER_KEYS, LAYERS } from './bodyModel';
import { LayerSlider } from './LayerSlider';
import { SeveritySlider } from './SeveritySlider';
import { SEVERITY_MAX, severityColor, severityLabel } from './severity';

export function BodyLocationScreen() {
  const insets = useSafeAreaInsets();
  const [depth, setDepth] = useState(0);
  const [severity, setSeverity] = useState(5);
  const [selection, setSelection] = useState<BodySelection | null>(null);
  const color = severityColor(severity);

  const onContinue = () => {
    if (!selection) return;
    router.push({
      pathname: '/photos',
      params: { part: selection.label, layer: LAYER_KEYS[selection.layer], severity: String(severity) },
    });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Where is the problem?</Text>
        <Text style={styles.subtitle}>Turn the body and tap the spot that bothers you.</Text>
      </View>

      <View style={styles.stage}>
        <View style={styles.leftRail}>
          <Text style={styles.railTitle}>Pain</Text>
          <SeveritySlider level={severity} onChange={setSeverity} />
        </View>

        <View style={styles.viewer}>
          <BodyViewer
            depth={depth}
            highlightColor={color}
            selection={selection}
            onSelect={setSelection}
            background={colors.stage}
          />
        </View>

        <View style={styles.rightRail}>
          <Text style={[styles.railTitle, styles.railTitleRight]}>Layer</Text>
          <LayerSlider depth={depth} onChange={setDepth} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardContent}>
          {selection ? (
            <View style={styles.selectionRow}>
              <View style={[styles.selectionDot, { backgroundColor: color }]} />
              <View style={styles.selectionText}>
                <Text style={styles.selectionLabel} numberOfLines={1}>
                  {selection.label}
                </Text>
                <Text style={styles.selectionMeta}>{LAYERS[selection.layer]}</Text>
              </View>
              <View style={[styles.severityChip, { backgroundColor: color }]}>
                <Text style={styles.severityChipText}>
                  {severity}/{SEVERITY_MAX} · {severityLabel(severity)}
                </Text>
              </View>
              <Pressable onPress={() => setSelection(null)} accessibilityRole="button" accessibilityLabel="Clear selection" hitSlop={8}>
                <Text style={styles.clear}>✕</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.placeholder}>Tap on the body to mark where it hurts</Text>
              <Text style={styles.hint}>Drag to rotate · pinch to zoom · use Layer to look inside</Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={onContinue}
          disabled={!selection}
          accessibilityRole="button"
          accessibilityState={{ disabled: !selection }}
          style={({ pressed }) => [styles.button, !selection && styles.buttonDisabled, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    gap: 12,
  },
  header: {
    paddingHorizontal: 4,
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  stage: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  leftRail: {
    width: 60,
    paddingVertical: 8,
  },
  rightRail: {
    width: 92,
    paddingVertical: 8,
  },
  railTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 6,
  },
  railTitleRight: {
    textAlign: 'right',
    paddingRight: 8,
  },
  viewer: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.stage,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardContent: {
    // Same height with or without a selection, so the 3D view doesn't jump.
    minHeight: 58,
    justifyContent: 'center',
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectionDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  selectionText: {
    flex: 1,
  },
  selectionLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  selectionMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  severityChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  severityChipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  clear: {
    fontSize: 16,
    color: colors.textMuted,
    paddingHorizontal: 2,
  },
  placeholder: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
  },
  button: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  buttonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
