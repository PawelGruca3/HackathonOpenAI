import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { PanResponder, View, type StyleProp, type ViewStyle } from 'react-native';

type SliderLayout = {
  /** Height of the slider area in points. */
  height: number;
  /** Distance from the top of the area to the top of the thumb. */
  thumbTop: number;
};

type Props = {
  /** 0 = bottom, 1 = top. */
  value: number;
  onChange: (value: number) => void;
  onRelease?: (value: number) => void;
  thumbSize: number;
  /** Fraction moved per accessibility increment/decrement. */
  step?: number;
  accessibilityLabel: string;
  accessibilityValueText?: string;
  style?: StyleProp<ViewStyle>;
  /** Draws the track, labels and thumb. The whole area responds to drags. */
  children: (layout: SliderLayout) => ReactNode;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function VerticalSlider({
  value,
  onChange,
  onRelease,
  thumbSize,
  step = 0.1,
  accessibilityLabel,
  accessibilityValueText,
  style,
  children,
}: Props) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [height, setHeight] = useState(0);
  const geometry = useRef({ top: 0, height: 0 });
  const callbacks = useRef({ onChange, onRelease });
  callbacks.current = { onChange, onRelease };
  const lastValue = useRef(value);

  const valueAt = (pageY: number) => {
    const { top, height: h } = geometry.current;
    const travel = Math.max(1, h - thumbSize);
    return clamp01(1 - (pageY - top - thumbSize / 2) / travel);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        // Re-measure in case the slider moved without resizing; applies from the next move.
        ref.current?.measureInWindow((_x, y, _w, h) => {
          geometry.current = { top: y, height: h };
        });
        lastValue.current = valueAt(evt.nativeEvent.pageY);
        callbacks.current.onChange(lastValue.current);
      },
      onPanResponderMove: (_, gesture) => {
        lastValue.current = valueAt(gesture.moveY);
        callbacks.current.onChange(lastValue.current);
      },
      onPanResponderRelease: () => callbacks.current.onRelease?.(lastValue.current),
      onPanResponderTerminate: () => callbacks.current.onRelease?.(lastValue.current),
    }),
  ).current;

  const measure = () => {
    ref.current?.measureInWindow((_x, y, _w, h) => {
      geometry.current = { top: y, height: h };
    });
  };

  const nudge = (delta: number) => {
    const next = clamp01(value + delta);
    onChange(next);
    onRelease?.(next);
  };

  return (
    <View
      ref={ref}
      // userSelect: stop drags from selecting label text on web.
      style={[{ userSelect: 'none' }, style]}
      onLayout={(e) => {
        setHeight(e.nativeEvent.layout.height);
        measure();
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={accessibilityValueText ? { text: accessibilityValueText } : undefined}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? step : -step)}
      {...responder.panHandlers}
    >
      {height > 0 && children({ height, thumbTop: (1 - value) * Math.max(0, height - thumbSize) })}
    </View>
  );
}
