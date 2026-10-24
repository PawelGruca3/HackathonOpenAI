import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';

import {
  createBodyModel,
  BODY_HEIGHT,
  layerOpacityAt,
  partLabel,
  type BodyModel,
  type BodyPart,
  type LayerIndex,
} from './bodyModel';

export type BodySelection = {
  /** Stable key for the tapped region, e.g. "skin-knee:left:front". */
  key: string;
  label: string;
  layer: LayerIndex;
};

type Props = {
  /** 0 = skin ... 3 = bones. Fractional values cross-fade between layers. */
  depth: number;
  highlightColor: string;
  selection: BodySelection | null;
  onSelect: (selection: BodySelection) => void;
  background: string;
};

const FOV = 30;
const ROTATE_PER_PX = 0.012;
const MIN_ZOOM = 0.3; // fraction of the "whole body fits" distance
const MAX_ZOOM = 1.25;
const TAP_SLOP_PX = 6;
const TAP_MAX_MS = 400;

const clamp = THREE.MathUtils.clamp;

type ViewState = {
  rotY: number;
  spin: number;
  turn: number;
  zoom: number;
  zoomTarget: number;
  panY: number;
  depth: number;
  dragging: boolean;
  /** Layout size in points (used for picking and panning). */
  width: number;
  height: number;
  fitDistance: number;
};

export function BodyViewer({ depth, highlightColor, selection, onSelect, background }: Props) {
  const view = useRef<ViewState>({
    rotY: 0,
    spin: 0,
    turn: 0,
    zoom: 1,
    zoomTarget: 1,
    panY: 0,
    depth,
    dragging: false,
    width: 0,
    height: 0,
    fitDistance: 4,
  }).current;
  const props = useRef({ depth, highlightColor, selection, onSelect });
  props.current = { depth, highlightColor, selection, onSelect };

  const pickRef = useRef<(x: number, y: number) => void>(() => {});
  const cleanupRef = useRef<() => void>(() => {});
  const [facing, setFacing] = useState<'front' | 'back'>('front');

  useEffect(() => () => cleanupRef.current(), []);

  const gesture = useRef({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastMoveTime: 0,
    velocityX: 0,
    startTime: 0,
    tapX: 0,
    tapY: 0,
    moved: false,
    pinching: false,
    pinchDist: 0,
    pinchZoom: 1,
  }).current;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        // Movement is tracked from this event's own page coordinates rather than
        // gestureState, whose shared touch history can be stale on web.
        Object.assign(gesture, {
          startX: evt.nativeEvent.pageX,
          startY: evt.nativeEvent.pageY,
          lastX: evt.nativeEvent.pageX,
          lastY: evt.nativeEvent.pageY,
          lastMoveTime: Date.now(),
          velocityX: 0,
          startTime: Date.now(),
          tapX: evt.nativeEvent.locationX,
          tapY: evt.nativeEvent.locationY,
          moved: false,
          pinching: false,
        });
        view.dragging = true;
        view.spin = 0;
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches ?? [];
        if (touches.length >= 2) {
          const d = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
          if (!gesture.pinching) {
            gesture.pinching = true;
            gesture.pinchDist = d;
            gesture.pinchZoom = view.zoomTarget;
          }
          view.zoomTarget = clamp((gesture.pinchZoom * gesture.pinchDist) / Math.max(d, 1), MIN_ZOOM, MAX_ZOOM);
          gesture.moved = true;
          return;
        }
        if (gesture.pinching) return; // ignore the leftover finger after a pinch
        const { pageX, pageY } = evt.nativeEvent;
        if (Math.abs(pageX - gesture.startX) > TAP_SLOP_PX || Math.abs(pageY - gesture.startY) > TAP_SLOP_PX) gesture.moved = true;
        const ddx = pageX - gesture.lastX;
        const ddy = pageY - gesture.lastY;
        const now = Date.now();
        gesture.velocityX = ddx / Math.max(now - gesture.lastMoveTime, 1);
        gesture.lastX = pageX;
        gesture.lastY = pageY;
        gesture.lastMoveTime = now;
        view.rotY += ddx * ROTATE_PER_PX;
        const worldPerPx = (2 * view.fitDistance * view.zoom * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / Math.max(view.height, 1);
        view.panY += ddy * worldPerPx;
      },
      onPanResponderRelease: () => {
        view.dragging = false;
        if (!gesture.moved && Date.now() - gesture.startTime < TAP_MAX_MS) {
          pickRef.current(gesture.tapX, gesture.tapY);
        } else if (!gesture.pinching && Date.now() - gesture.lastMoveTime < 80) {
          view.spin = gesture.velocityX * ROTATE_PER_PX * 16; // px/ms -> radians per 60fps frame
        }
      },
      onPanResponderTerminate: () => {
        view.dragging = false;
      },
    }),
  ).current;

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

    const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.setClearColor(background, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.05, 50);

    scene.add(new THREE.HemisphereLight('#ffffff', '#9aa7b8', 1.6));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(1.5, 2.5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#dbe7ff', 0.9);
    rim.position.set(-2, 1.5, -3);
    scene.add(rim);

    const body: BodyModel = createBodyModel();
    scene.add(body.root);

    // Selection: tint the tapped mesh and drop a pulsing pin at the tap point.
    const highlight = new THREE.MeshStandardMaterial({ roughness: 0.5, emissiveIntensity: 0.45 });
    // White pin so it stands out against the tinted part; the halo carries the severity colour.
    const pinMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true });
    const haloMaterial = new THREE.MeshBasicMaterial({ depthTest: false, transparent: true, depthWrite: false });
    const pinGeometry = new THREE.SphereGeometry(0.014, 16, 12);
    const pin = new THREE.Mesh(pinGeometry, pinMaterial);
    const halo = new THREE.Mesh(pinGeometry, haloMaterial);
    pin.renderOrder = 11;
    halo.renderOrder = 10;
    const marker = new THREE.Group();
    marker.add(halo, pin);
    marker.visible = false;
    body.root.add(marker);

    let selected: { mesh: THREE.Mesh; original: THREE.Material; part: BodyPart } | null = null;
    let appliedColor = '';

    const clearSelection = () => {
      if (selected) selected.mesh.material = selected.original;
      selected = null;
      marker.visible = false;
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const partOf = (hit: THREE.Intersection) => hit.object.userData.part as BodyPart;

    pickRef.current = (x, y) => {
      if (!view.width || !view.height) return;
      pointer.set((x / view.width) * 2 - 1, -(y / view.height) * 2 + 1);
      scene.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      // Judge visibility by where the layer slider is heading, so a tap made
      // mid-fade lands on what the patient is about to see.
      const targetDepth = props.current.depth;
      const hits = raycaster
        .intersectObjects(body.pickables, false)
        .filter((h) => layerOpacityAt(partOf(h).layer, targetDepth) >= 0.5);
      if (hits.length === 0) return;

      // Prefer the layer the slider is on, so e.g. organs win over ribs.
      const currentLayer = Math.round(targetDepth);
      const hit = hits.find((h) => partOf(h).layer === currentLayer) ?? hits[0];
      const mesh = hit.object as THREE.Mesh;
      const part = partOf(hit);
      const local = body.root.worldToLocal(hit.point.clone());
      const back = local.z < mesh.position.z;

      clearSelection();
      selected = { mesh, original: mesh.material as THREE.Material, part };
      mesh.material = highlight;
      marker.position.copy(local);
      marker.visible = true;

      props.current.onSelect({
        key: `${part.id}:${part.side ?? 'center'}:${back && part.backName ? 'back' : 'front'}`,
        label: partLabel(part, back),
        layer: part.layer,
      });
    };

    let removeWheel = () => {};
    if (Platform.OS === 'web') {
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        view.zoomTarget = clamp(view.zoomTarget * (1 + e.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM);
      };
      canvas.addEventListener('wheel', onWheel, { passive: false });
      removeWheel = () => canvas.removeEventListener('wheel', onWheel);
    }

    const fitBody = () => {
      const aspect = width / height;
      const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const byHeight = (BODY_HEIGHT * 0.56) / halfTan;
      const byWidth = 0.38 / (halfTan * aspect);
      view.fitDistance = Math.max(byHeight, byWidth);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    };
    fitBody();

    let lastFacing: 'front' | 'back' = 'front';
    let frame = 0;
    const startTime = performance.now();
    let lastTime = startTime;

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
        fitBody();
      }

      if (!view.dragging) {
        view.rotY += view.spin * frames;
        view.spin *= Math.pow(0.92, frames);
        if (Math.abs(view.spin) < 1e-4) view.spin = 0;
      }
      if (view.turn !== 0) {
        const step = Math.abs(view.turn) < 0.002 ? view.turn : view.turn * ease(0.14);
        view.rotY += step;
        view.turn -= step;
      }

      view.zoom += (view.zoomTarget - view.zoom) * ease(0.18);
      // Panning only makes sense when zoomed in; the allowed range grows with zoom.
      const maxPan = (BODY_HEIGHT / 2) * 0.9 * clamp((1 - view.zoom) / (1 - MIN_ZOOM), 0, 1);
      const clampedPan = clamp(view.panY, -maxPan, maxPan);
      view.panY = view.dragging ? clampedPan : view.panY + (clampedPan - view.panY) * ease(0.25);

      view.depth += (props.current.depth - view.depth) * ease(0.2);
      body.setDepth(view.depth);
      body.root.rotation.y = view.rotY;

      const distance = view.fitDistance * view.zoom;
      camera.position.set(0, view.panY, distance);
      camera.lookAt(0, view.panY, 0);

      if (selected && !props.current.selection) clearSelection();
      if (selected) {
        if (appliedColor !== props.current.highlightColor) {
          appliedColor = props.current.highlightColor;
          highlight.color.set(appliedColor);
          highlight.emissive.set(appliedColor);
          haloMaterial.color.set(appliedColor);
        }
        const opacity = body.opacityOf(selected.part.layer);
        highlight.opacity = opacity;
        highlight.transparent = opacity < 0.999;
        highlight.depthWrite = opacity >= 0.999;
        highlight.visible = opacity > 0.01;

        const pulse = (((now - startTime) / 1000) % 1.4) / 1.4;
        halo.scale.setScalar(1.3 + pulse * 2.4);
        haloMaterial.opacity = 0.8 * (1 - pulse);
        // Keep the pin a similar size on screen when zoomed in.
        marker.scale.setScalar(0.6 + 0.4 * view.zoom);
      }

      const nowFacing = Math.cos(view.rotY) >= 0 ? 'front' : 'back';
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
      body.dispose();
      highlight.dispose();
      pinMaterial.dispose();
      haloMaterial.dispose();
      pinGeometry.dispose();
      try {
        renderer.dispose();
      } catch {
        // expo-gl may not support every extension three.js uses on teardown.
      }
    };
  };

  const zoomBy = (factor: number) => {
    view.zoomTarget = clamp(view.zoomTarget * factor, MIN_ZOOM, MAX_ZOOM);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: background }]}
      onLayout={(e) => {
        view.width = e.nativeEvent.layout.width;
        view.height = e.nativeEvent.layout.height;
      }}
    >
      <View style={StyleSheet.absoluteFill} {...responder.panHandlers}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      </View>

      <View pointerEvents="none" style={styles.facingChip}>
        <Text style={styles.facingText}>{facing === 'front' ? 'Front view' : 'Back view'}</Text>
      </View>

      <View style={styles.controls}>
        <ControlButton label="−" accessibilityLabel="Zoom out" onPress={() => zoomBy(1.25)} />
        <ControlButton label="⟲ Turn" accessibilityLabel="Turn the body around" onPress={() => (view.turn += Math.PI)} wide />
        <ControlButton label="+" accessibilityLabel="Zoom in" onPress={() => zoomBy(0.8)} />
      </View>
    </View>
  );
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
    gap: 8,
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
    paddingHorizontal: 14,
  },
  controlPressed: {
    backgroundColor: '#eef2f7',
  },
  controlText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
});
