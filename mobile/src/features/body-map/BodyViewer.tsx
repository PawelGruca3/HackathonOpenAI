import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, PanResponder, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import * as THREE from 'three';

import { BODY_HEIGHT, loadBodyModel, type BodyModel, type BodySex } from './bodyModel';

type Props = {
  sex: BodySex;
  background: string;
};

const FOV = 30;
const ROTATE_PER_PX = 0.01;
const MAX_PITCH = THREE.MathUtils.degToRad(85);
/** Zoom is the camera distance as a fraction of the "whole body fits" distance. */
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 1.25;
/** Zoom level a double-tap jumps to. */
const FOCUS_ZOOM = 0.35;
const TAP_SLOP_PX = 8;
const TAP_MAX_MS = 250;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 30;

const clamp = THREE.MathUtils.clamp;

type Facing = 'front' | 'back' | 'top' | 'bottom';

const FACING_LABELS: Record<Facing, string> = {
  front: 'Front view',
  back: 'Back view',
  top: 'Top view',
  bottom: 'Bottom view',
};

/**
 * Orbit camera around a target point. Gestures write the *goal* values (and,
 * for direct finger tracking, the current ones too); each frame eases the
 * current values toward the goals so buttons and double-taps animate.
 */
type ViewState = {
  yaw: number;
  pitch: number;
  spinYaw: number;
  spinPitch: number;
  /** Remaining yaw of a Turn-button animation. */
  turn: number;
  /** Ease pitch back to level (after Reset). */
  levelling: boolean;
  zoom: number;
  zoomGoal: number;
  target: THREE.Vector3;
  targetGoal: THREE.Vector3;
  touching: boolean;
  /** Layout of the view in points; pageX/pageY are its window position. */
  width: number;
  height: number;
  pageX: number;
  pageY: number;
  fitDistance: number;
  /** Horizontal reach of the current model; the camera backs off to keep it in view. */
  bodyRadius: number;
  needsFit: boolean;
  /** Camera's screen-right and screen-up directions in world space. */
  right: THREE.Vector3;
  up: THREE.Vector3;
};

export function BodyViewer({ sex, background }: Props) {
  const view = useRef<ViewState>({
    yaw: 0,
    pitch: 0,
    spinYaw: 0,
    spinPitch: 0,
    turn: 0,
    levelling: false,
    zoom: 1,
    zoomGoal: 1,
    target: new THREE.Vector3(),
    targetGoal: new THREE.Vector3(),
    touching: false,
    width: 0,
    height: 0,
    pageX: 0,
    pageY: 0,
    fitDistance: 4,
    bodyRadius: 0.45,
    needsFit: true,
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
  }).current;

  // The GL scene and the model load independently; whichever finishes last
  // puts the model into the scene.
  const sceneRef = useRef<THREE.Scene | null>(null);
  const bodyRef = useRef<BodyModel | null>(null);
  const pickRef = useRef<(x: number, y: number) => THREE.Vector3 | null>(() => null);
  const cleanupRef = useRef<() => void>(() => {});
  const containerRef = useRef<ComponentRef<typeof View>>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [facing, setFacing] = useState<Facing>('front');

  const showBody = (next: BodyModel) => {
    const scene = sceneRef.current;
    const previous = bodyRef.current;
    if (previous && previous !== next) {
      scene?.remove(previous.root);
      previous.dispose();
    }
    bodyRef.current = next;
    view.bodyRadius = next.radius;
    view.needsFit = true;
    if (scene && next.root.parent !== scene) scene.add(next.root);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    loadBodyModel(sex)
      .then((model) => {
        if (cancelled) return model.dispose();
        showBody(model);
        setLoading(false);
      })
      .catch((error) => {
        console.warn('Failed to load body model', error);
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sex]);

  useEffect(
    () => () => {
      cleanupRef.current();
      bodyRef.current?.dispose();
    },
    [],
  );

  // --- Camera moves -------------------------------------------------------

  const worldPerPx = (zoom: number) =>
    (2 * view.fitDistance * zoom * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / Math.max(view.height, 1);

  /** Zoom by `factor` while keeping the point under (x, y) fixed on screen. */
  const zoomAt = (x: number, y: number, factor: number, immediate: boolean) => {
    const from = view.zoomGoal;
    const to = clamp(from * factor, MIN_ZOOM, MAX_ZOOM);
    const perPx = worldPerPx(from);
    const offset = new THREE.Vector3()
      .addScaledVector(view.right, (x - view.width / 2) * perPx)
      .addScaledVector(view.up, -(y - view.height / 2) * perPx);
    view.targetGoal.addScaledVector(offset, 1 - to / from);
    view.zoomGoal = to;
    if (immediate) {
      view.zoom = view.zoomGoal;
      view.target.copy(view.targetGoal);
    }
  };

  /** Move the view with the fingers (screen-space drag in points). */
  const pan = (dx: number, dy: number) => {
    const perPx = worldPerPx(view.zoomGoal);
    view.targetGoal.addScaledVector(view.right, -dx * perPx).addScaledVector(view.up, dy * perPx);
    view.target.copy(view.targetGoal);
  };

  const zoomCentre = (factor: number) => zoomAt(view.width / 2, view.height / 2, factor, false);

  const reset = () => {
    view.zoomGoal = 1;
    view.targetGoal.set(0, 0, 0);
    view.levelling = true;
  };

  const onDoubleTap = (x: number, y: number) => {
    if (view.zoomGoal < 0.6) return reset();
    const hit = pickRef.current(x, y);
    if (hit) {
      view.targetGoal.copy(hit);
      view.zoomGoal = FOCUS_ZOOM;
    } else {
      zoomAt(x, y, FOCUS_ZOOM / view.zoomGoal, false);
    }
  };

  // --- Gestures -----------------------------------------------------------

  const gesture = useRef({
    mode: 'none' as 'none' | 'rotate' | 'pinch',
    startX: 0,
    startY: 0,
    startTime: 0,
    moved: false,
    multiTouch: false,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    velocityX: 0,
    velocityY: 0,
    pinchDist: 0,
    midX: 0,
    midY: 0,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
  }).current;

  // Movement is tracked from page coordinates rather than gestureState, whose
  // shared touch history can be stale on web.
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const { pageX, pageY, touches } = evt.nativeEvent;
        Object.assign(gesture, {
          mode: 'none',
          startX: pageX,
          startY: pageY,
          startTime: Date.now(),
          moved: false,
          multiTouch: (touches?.length ?? 1) > 1,
        });
        view.touching = true;
        view.spinYaw = 0;
        view.spinPitch = 0;
        view.turn = 0;
        view.levelling = false;
        // Finish any running animation where it is, so fingers take over smoothly.
        view.zoomGoal = view.zoom;
        view.targetGoal.copy(view.target);
        track(evt);
      },
      onPanResponderMove: (evt) => track(evt),
      onPanResponderRelease: () => {
        view.touching = false;
        const now = Date.now();
        if (!gesture.moved && !gesture.multiTouch && now - gesture.startTime < TAP_MAX_MS) {
          onTap(gesture.startX - view.pageX, gesture.startY - view.pageY);
        } else if (gesture.mode === 'rotate' && now - gesture.lastTime < 80) {
          view.spinYaw = -gesture.velocityX * ROTATE_PER_PX * 16; // px/ms -> radians per 60fps frame
          view.spinPitch = gesture.velocityY * ROTATE_PER_PX * 16;
        }
      },
      onPanResponderTerminate: () => {
        view.touching = false;
      },
    }),
  ).current;

  function track(evt: GestureResponderEvent) {
    const touches = evt.nativeEvent.touches ?? [];
    const now = Date.now();

    if (touches.length >= 2) {
      gesture.multiTouch = true;
      gesture.moved = true;
      const [a, b] = touches;
      const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
      const midX = (a.pageX + b.pageX) / 2;
      const midY = (a.pageY + b.pageY) / 2;
      if (gesture.mode === 'pinch') {
        // Zoom toward the point between the fingers, and follow them as they move.
        zoomAt(midX - view.pageX, midY - view.pageY, gesture.pinchDist / Math.max(dist, 1), true);
        pan(midX - gesture.midX, midY - gesture.midY);
      }
      Object.assign(gesture, { mode: 'pinch', pinchDist: dist, midX, midY });
      return;
    }

    const { pageX, pageY } = evt.nativeEvent;
    if (gesture.mode !== 'rotate') {
      // First finger down, or one finger left over after a pinch.
      Object.assign(gesture, { mode: 'rotate', lastX: pageX, lastY: pageY, lastTime: now, velocityX: 0, velocityY: 0 });
      return;
    }
    if (Math.abs(pageX - gesture.startX) > TAP_SLOP_PX || Math.abs(pageY - gesture.startY) > TAP_SLOP_PX) gesture.moved = true;
    if (!gesture.moved) return;

    const dx = pageX - gesture.lastX;
    const dy = pageY - gesture.lastY;
    const dt = Math.max(now - gesture.lastTime, 1);
    view.yaw -= dx * ROTATE_PER_PX;
    view.pitch = clamp(view.pitch + dy * ROTATE_PER_PX, -MAX_PITCH, MAX_PITCH);
    Object.assign(gesture, { lastX: pageX, lastY: pageY, lastTime: now, velocityX: dx / dt, velocityY: dy / dt });
  }

  function onTap(x: number, y: number) {
    const now = Date.now();
    const isDouble =
      now - gesture.lastTapTime < DOUBLE_TAP_MS && Math.hypot(x - gesture.lastTapX, y - gesture.lastTapY) < DOUBLE_TAP_PX;
    if (isDouble) {
      gesture.lastTapTime = 0;
      onDoubleTap(x, y);
    } else {
      Object.assign(gesture, { lastTapTime: now, lastTapX: x, lastTapY: y });
    }
  }

  // --- Rendering ----------------------------------------------------------

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    let width = gl.drawingBufferWidth;
    let height = gl.drawingBufferHeight;

    // On native there is no DOM canvas, so three.js gets a minimal stand-in.
    const canvas =
      Platform.OS === 'web'
        ? (gl.canvas as HTMLCanvasElement)
        : ({
            width,
            height,
            style: {},
            addEventListener: () => {},
            removeEventListener: () => {},
            clientWidth: width,
            clientHeight: height,
            getContext: () => gl,
          } as unknown as HTMLCanvasElement);

    const renderer = createRenderer(canvas, gl);
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.setClearColor(background, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.02, 50);

    // Lights travel with the camera so whatever you look at is lit.
    scene.add(new THREE.HemisphereLight('#ffffff', '#9aa7b8', 1.4));
    scene.add(camera);
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(1.5, 2, 0);
    camera.add(key);
    const fill = new THREE.DirectionalLight('#dbe7ff', 0.6);
    fill.position.set(-2, -0.5, 0);
    camera.add(fill);

    sceneRef.current = scene;
    if (bodyRef.current) showBody(bodyRef.current);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    pickRef.current = (x, y) => {
      const body = bodyRef.current;
      if (!body || !view.width || !view.height) return null;
      pointer.set((x / view.width) * 2 - 1, -(y / view.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObject(body.surface, true);
      return hit ? hit.point.clone() : null;
    };

    let removeWheel = () => {};
    if (Platform.OS === 'web') {
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        // offsetX/Y are unreliable under browser device emulation; use the rect.
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * view.width;
        const y = ((e.clientY - rect.top) / rect.height) * view.height;
        zoomAt(x, y, 1 + e.deltaY * 0.0015, false);
      };
      canvas.addEventListener('wheel', onWheel, { passive: false });
      removeWheel = () => canvas.removeEventListener('wheel', onWheel);
    }

    const fitBody = () => {
      const aspect = width / height;
      const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const byHeight = (BODY_HEIGHT * 0.56) / halfTan;
      // Small margin so outstretched hands don't touch the edges.
      const byWidth = (view.bodyRadius * 1.08) / (halfTan * aspect);
      view.fitDistance = Math.max(byHeight, byWidth);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      view.needsFit = false;
    };
    fitBody();

    const offset = new THREE.Vector3();
    let lastFacing: Facing = 'front';
    let frame = 0;
    let lastTime = performance.now();

    const render = () => {
      frame = requestAnimationFrame(render);

      // Animation rates are tuned per 60fps frame and scaled by the real frame
      // time, so slow devices finish transitions just as quickly.
      const now = performance.now();
      const frames = Math.min(now - lastTime, 100) / (1000 / 60);
      lastTime = now;
      const ease = (rate: number) => 1 - Math.pow(1 - rate, frames);

      if (gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height) {
        width = gl.drawingBufferWidth;
        height = gl.drawingBufferHeight;
        renderer.setSize(width, height, false);
        view.needsFit = true;
      }
      if (view.needsFit) fitBody();

      if (!view.touching) {
        view.yaw += view.spinYaw * frames;
        view.pitch += view.spinPitch * frames;
        const decay = Math.pow(0.92, frames);
        view.spinYaw *= decay;
        view.spinPitch *= decay;
        if (Math.abs(view.spinYaw) < 1e-4) view.spinYaw = 0;
        if (Math.abs(view.spinPitch) < 1e-4) view.spinPitch = 0;
      }
      if (view.turn !== 0) {
        const step = Math.abs(view.turn) < 0.002 ? view.turn : view.turn * ease(0.14);
        view.yaw += step;
        view.turn -= step;
      }
      if (view.levelling) {
        view.pitch += (0 - view.pitch) * ease(0.15);
        if (Math.abs(view.pitch) < 1e-3) view.levelling = false;
      }
      view.pitch = clamp(view.pitch, -MAX_PITCH, MAX_PITCH);

      // Keep the body in view: the further out, the closer to the centre the
      // camera has to look (fully centred at the default zoom).
      const freedom = clamp(((1 - view.zoomGoal) / (1 - MIN_ZOOM)) * 1.6, 0, 1);
      const limitX = view.touching ? view.bodyRadius : view.bodyRadius * freedom;
      const limitY = (view.touching ? 1 : freedom) * (BODY_HEIGHT / 2);
      const limitZ = (view.touching ? 1 : freedom) * 0.3;
      view.targetGoal.set(
        clamp(view.targetGoal.x, -limitX, limitX),
        clamp(view.targetGoal.y, -limitY, limitY),
        clamp(view.targetGoal.z, -limitZ, limitZ),
      );

      view.zoom += (view.zoomGoal - view.zoom) * ease(0.2);
      view.target.lerp(view.targetGoal, ease(0.2));

      const distance = view.fitDistance * view.zoom;
      offset.set(
        Math.sin(view.yaw) * Math.cos(view.pitch),
        Math.sin(view.pitch),
        Math.cos(view.yaw) * Math.cos(view.pitch),
      );
      camera.position.copy(view.target).addScaledVector(offset, distance);
      camera.lookAt(view.target);
      camera.updateMatrixWorld();
      view.right.setFromMatrixColumn(camera.matrixWorld, 0);
      view.up.setFromMatrixColumn(camera.matrixWorld, 1);

      const nowFacing: Facing =
        view.pitch > THREE.MathUtils.degToRad(55)
          ? 'top'
          : view.pitch < -THREE.MathUtils.degToRad(55)
            ? 'bottom'
            : Math.cos(view.yaw) >= 0
              ? 'front'
              : 'back';
      if (nowFacing !== lastFacing) {
        lastFacing = nowFacing;
        setFacing(nowFacing);
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();

    cleanupRef.current = () => {
      cancelAnimationFrame(frame);
      removeWheel();
      sceneRef.current = null;
      try {
        renderer.dispose();
      } catch {
        // expo-gl may not support every extension three.js uses on teardown.
      }
    };
  };

  const measure = () => {
    containerRef.current?.measureInWindow((x, y, w, h) => {
      Object.assign(view, { pageX: x, pageY: y, width: w, height: h });
    });
  };

  return (
    <View
      ref={containerRef}
      style={[styles.container, { backgroundColor: background }]}
      onLayout={(e) => {
        view.width = e.nativeEvent.layout.width;
        view.height = e.nativeEvent.layout.height;
        measure();
      }}
    >
      <View style={StyleSheet.absoluteFill} {...responder.panHandlers} onTouchStart={measure}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      </View>

      {(loading || failed) && (
        <View pointerEvents="none" style={styles.status}>
          {loading ? <ActivityIndicator color="#64748b" /> : <Text style={styles.statusText}>Couldn't load the 3D body.</Text>}
        </View>
      )}

      <View pointerEvents="none" style={styles.facingChip}>
        <Text style={styles.facingText}>{FACING_LABELS[facing]}</Text>
      </View>

      <View style={styles.controls}>
        <ControlButton label="−" accessibilityLabel="Zoom out" onPress={() => zoomCentre(1.4)} />
        <ControlButton label="⟲ Turn" accessibilityLabel="Turn the body around" onPress={() => (view.turn += Math.PI)} wide />
        <ControlButton label="+" accessibilityLabel="Zoom in" onPress={() => zoomCentre(1 / 1.4)} />
        <ControlButton label="Reset" accessibilityLabel="Reset the view" onPress={reset} wide />
      </View>
    </View>
  );
}

/**
 * three.js rejects any context that is `instanceof WebGLRenderingContext`
 * (WebGL 1). expo-gl's native WebGL2 context deliberately inherits from that
 * class, so hide the global while the renderer checks it.
 */
function createRenderer(canvas: HTMLCanvasElement, gl: ExpoWebGLRenderingContext): THREE.WebGLRenderer {
  if (Platform.OS === 'web') return new THREE.WebGLRenderer({ canvas, context: gl });
  if (!(gl as unknown as { supportsWebGL2?: boolean }).supportsWebGL2) {
    throw new Error('This device does not support WebGL2, which the 3D body needs.');
  }
  const scope = globalThis as { WebGLRenderingContext?: unknown };
  const original = scope.WebGLRenderingContext;
  scope.WebGLRenderingContext = undefined;
  try {
    return new THREE.WebGLRenderer({ canvas, context: gl });
  } finally {
    scope.WebGLRenderingContext = original;
  }
}

function ControlButton({ label, accessibilityLabel, onPress, wide }: { label: string; accessibilityLabel: string; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [styles.control, wide && styles.controlWide, pressed && styles.controlPressed]}
    >
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  status: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#64748b',
  },
  facingChip: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  facingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  controls: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  control: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cbd5e1',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  controlWide: {
    paddingHorizontal: 12,
  },
  controlPressed: {
    backgroundColor: '#eef2f7',
  },
  controlText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
});
