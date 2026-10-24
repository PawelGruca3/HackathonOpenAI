import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';
import { BodyViewer } from './BodyViewer';
import { type BodySex } from './bodyModel';
import { SeveritySlider } from './SeveritySlider';

const SEX_OPTIONS: { value: BodySex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export function BodyLocationScreen() {
  const insets = useSafeAreaInsets();
  const [sex, setSex] = useState<BodySex>('male');
  const [severity, setSeverity] = useState(5);

  const onContinue = () => {
    router.push({ pathname: '/photos', params: { severity: String(severity) } });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Where is the problem?</Text>
        <Text style={styles.subtitle}>Turn the body to find the spot that bothers you.</Text>
      </View>

      <View style={styles.segmented} accessibilityRole="radiogroup">
        {SEX_OPTIONS.map((option) => {
          const selected = option.value === sex;
          return (
            <Pressable
              key={option.value}
              onPress={() => setSex(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.stage}>
        <View style={styles.leftRail}>
          <Text style={styles.railTitle}>Pain</Text>
          <SeveritySlider level={severity} onChange={setSeverity} />
        </View>

        <View style={styles.viewer}>
          <BodyViewer sex={sex} background={colors.stage} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.hint}>Drag to rotate · pinch to zoom · double-tap a spot to zoom in</Text>
        <Pressable onPress={onContinue} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
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
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.stage,
  },
  segment: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.surface,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  segmentTextSelected: {
    color: colors.text,
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
  railTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 6,
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
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
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
