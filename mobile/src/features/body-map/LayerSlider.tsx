import { StyleSheet, Text, View } from 'react-native';

import { VerticalSlider } from '@/components/VerticalSlider';
import { colors } from '@/theme';
import { COLORS, DEEPEST_LAYER, LAYERS } from './bodyModel';

const THUMB = 28;
const TRACK_WIDTH = 6;
const TRACK_RIGHT = 12;
const LAYER_SWATCHES = [COLORS.skin, COLORS.muscle, COLORS.lung, COLORS.bone];

type Props = {
  /** 0 = skin ... 3 = bones; fractional while dragging. */
  depth: number;
  onChange: (depth: number) => void;
};

/** Top = outermost layer (skin), bottom = deepest (bones). */
export function LayerSlider({ depth, onChange }: Props) {
  const toValue = (d: number) => 1 - d / DEEPEST_LAYER;
  const toDepth = (v: number) => (1 - v) * DEEPEST_LAYER;
  const active = Math.round(depth);

  return (
    <VerticalSlider
      style={styles.slider}
      value={toValue(depth)}
      thumbSize={THUMB}
      step={1 / DEEPEST_LAYER}
      onChange={(v) => onChange(toDepth(v))}
      onRelease={(v) => onChange(Math.round(toDepth(v)))}
      accessibilityLabel="Body layer"
      accessibilityValueText={LAYERS[active]}
    >
      {({ height, thumbTop }) => {
        const travel = height - THUMB;
        return (
          <>
            <View style={styles.track} />
            {LAYERS.map((name, i) => {
              const center = (i / DEEPEST_LAYER) * travel + THUMB / 2;
              const isActive = i === active;
              return (
                <View key={name} pointerEvents="none" style={[styles.stop, { top: center - 12 }]}>
                  <Text style={[styles.label, isActive && styles.labelActive]}>{name}</Text>
                  <View style={styles.dotSlot}>
                    <View style={[styles.dot, { backgroundColor: LAYER_SWATCHES[i] }]} />
                  </View>
                </View>
              );
            })}
            <View pointerEvents="none" style={[styles.thumb, { top: thumbTop }]} />
          </>
        );
      }}
    </VerticalSlider>
  );
}

const styles = StyleSheet.create({
  slider: {
    flex: 1,
    width: '100%',
  },
  track: {
    position: 'absolute',
    top: THUMB / 2,
    bottom: THUMB / 2,
    right: TRACK_RIGHT + (THUMB - TRACK_WIDTH) / 2,
    width: TRACK_WIDTH,
    borderRadius: TRACK_WIDTH / 2,
    backgroundColor: colors.border,
  },
  stop: {
    position: 'absolute',
    right: TRACK_RIGHT,
    left: 0,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    marginRight: 6,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  dotSlot: {
    width: THUMB,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.15)',
  },
  thumb: {
    position: 'absolute',
    right: TRACK_RIGHT,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 4,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
