import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { VerticalSlider } from '@/components/VerticalSlider';
import { colors } from '@/theme';
import {
  SEVERITY_MAX,
  SEVERITY_MIN,
  SEVERITY_STOPS,
  severityColor,
  severityFromValue,
  severityLabel,
  valueFromSeverity,
} from './severity';

const THUMB = 42;
const TRACK_WIDTH = 14;

// Top of the track is the most severe.
const GRADIENT_COLORS = [...SEVERITY_STOPS].reverse().map((s) => s.color) as [string, string, ...string[]];
const GRADIENT_LOCATIONS = [...SEVERITY_STOPS].reverse().map((s) => 1 - s.at) as [number, number, ...number[]];

type Props = {
  level: number;
  onChange: (level: number) => void;
};

export function SeveritySlider({ level, onChange }: Props) {
  // While dragging the thumb follows the finger; it snaps to a whole level on release.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const value = dragValue ?? valueFromSeverity(level);
  const color = severityColor(level);

  return (
    <View style={styles.root}>
      <Text style={styles.endLabel}>{SEVERITY_MAX}</Text>
      <VerticalSlider
        style={styles.slider}
        value={value}
        thumbSize={THUMB}
        step={1 / (SEVERITY_MAX - SEVERITY_MIN)}
        onChange={(v) => {
          setDragValue(v);
          const next = severityFromValue(v);
          if (next !== level) onChange(next);
        }}
        onRelease={(v) => {
          setDragValue(null);
          onChange(severityFromValue(v));
        }}
        accessibilityLabel="How bad is it"
        accessibilityValueText={`${level} out of ${SEVERITY_MAX}, ${severityLabel(level)}`}
      >
        {({ thumbTop }) => (
          <>
            <LinearGradient
              colors={GRADIENT_COLORS}
              locations={GRADIENT_LOCATIONS}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.track}
            />
            <View style={[styles.thumb, { top: thumbTop, backgroundColor: color }]}>
              <Text style={[styles.thumbText, { color: level === 10 ? '#ffffff' : '#000000' }]}>{level}</Text>
            </View>
          </>
        )}
      </VerticalSlider>
      <Text style={styles.endLabel}>{SEVERITY_MIN}</Text>
      <Text style={[styles.word, { color: colors.text }]} numberOfLines={2}>
        {severityLabel(level)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  track: {
    position: 'absolute',
    top: THUMB / 2,
    bottom: THUMB / 2,
    width: TRACK_WIDTH,
    borderRadius: TRACK_WIDTH / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  thumbText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  endLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginVertical: 2,
  },
  word: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
