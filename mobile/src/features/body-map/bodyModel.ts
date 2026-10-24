import * as THREE from 'three';

/**
 * A stylised, procedurally built human body. Every mesh is tagged with the
 * body part it represents so taps can be resolved to a readable name.
 *
 * Coordinates: metres, feet at y = 0, the body faces +z, and +x is the
 * patient's LEFT side (they face the viewer).
 */

export const LAYERS = ['Skin', 'Muscles', 'Organs', 'Bones'] as const;
/** Machine-readable layer names, used in route params. */
export const LAYER_KEYS = ['skin', 'muscle', 'organs', 'bones'] as const;
export type LayerIndex = 0 | 1 | 2 | 3;
export const DEEPEST_LAYER: LayerIndex = 3;
export const BODY_HEIGHT = 1.8;

export type BodyPart = {
  id: string;
  name: string;
  /** Name to use when the back of the part is tapped (e.g. "Lower back"). */
  backName?: string;
  side?: 'left' | 'right';
  layer: LayerIndex;
};

export type BodyModel = {
  root: THREE.Group;
  pickables: THREE.Mesh[];
  setDepth(depth: number): void;
  opacityOf(layer: LayerIndex): number;
  dispose(): void;
};

// A layer is only drawn once the layer covering it starts to fade, so inner
// parts never poke through the outer shell. Bones appear together with the
// organs so the limbs aren't empty on the organ layer.
const REVEAL_AFTER_DEPTH = [-1, 0, 1, 1];

/** How opaque a layer is at a given depth (0 = skin, 3 = bones). Bones never fade. */
export function layerOpacityAt(layer: LayerIndex, depth: number): number {
  if (depth <= REVEAL_AFTER_DEPTH[layer] + 0.001) return 0;
  if (layer === DEEPEST_LAYER) return 1;
  return THREE.MathUtils.clamp(layer + 1 - depth, 0, 1);
}

export function partLabel(part: BodyPart, back: boolean): string {
  const name = back && part.backName ? part.backName : part.name;
  if (!part.side) return name;
  const side = part.side === 'left' ? 'Left' : 'Right';
  return `${side} ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

type V3 = [number, number, number];

type Shape =
  | { kind: 'ellipsoid'; radii: V3; at: V3; rotation?: V3 }
  | { kind: 'limb'; from: V3; to: V3; radius: number }
  | { kind: 'ring'; rx: number; rz: number; thickness: number; at: V3 }
  | { kind: 'knot'; size: V3; at: V3 }
  /** Surface of revolution around the y axis, flattened front-to-back by `depth`. */
  | { kind: 'lathe'; profile: [r: number, y: number][]; depth: number };

// Torso outline (radius, height). Sliced into chest / abdomen / pelvis so each
// region is its own tappable mesh while the surface stays seamless.
const TORSO_PROFILE: [number, number][] = [
  [0, 0.86],
  [0.1, 0.875],
  [0.152, 0.92],
  [0.163, 0.98],
  [0.153, 1.05],
  [0.14, 1.12],
  [0.146, 1.19],
  [0.165, 1.26],
  [0.175, 1.33],
  [0.168, 1.39],
  [0.135, 1.435],
  [0.07, 1.465],
  [0, 1.475],
];
const TORSO_DEPTH = 0.62;

function torso(fromY: number, toY: number): Shape {
  const radiusAt = (y: number) => {
    const i = TORSO_PROFILE.findIndex(([, py]) => py >= y);
    if (i <= 0) return TORSO_PROFILE[Math.max(i, 0)][0];
    const [r0, y0] = TORSO_PROFILE[i - 1];
    const [r1, y1] = TORSO_PROFILE[i];
    return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  };
  const inner = TORSO_PROFILE.filter(([, y]) => y > fromY && y < toY);
  return {
    kind: 'lathe',
    profile: [[radiusAt(fromY), fromY], ...inner, [radiusAt(toY), toY]],
    depth: TORSO_DEPTH,
  };
}

const E = (radii: V3 | number, at: V3, rotation?: V3): Shape => ({
  kind: 'ellipsoid',
  radii: typeof radii === 'number' ? [radii, radii, radii] : radii,
  at,
  rotation,
});
const L = (from: V3, to: V3, radius: number): Shape => ({ kind: 'limb', from, to, radius });

export const COLORS = {
  skin: '#e2b996',
  muscle: '#b9473f',
  bone: '#eee5cf',
  brain: '#e9a6b3',
  throat: '#d88c8c',
  lung: '#e8909f',
  heart: '#c0392b',
  liver: '#8c3a2c',
  stomach: '#d9806a',
  intestines: '#e5a582',
  kidney: '#9b2d30',
  bladder: '#e0bb57',
};

// ---------------------------------------------------------------------------
// Outer segments: shared by the skin and muscle layers (muscle is a slightly
// shrunk copy so it sits just under the skin).
// `paired` segments are described for the left side and mirrored.

type Segment = {
  id: string;
  shape: Shape;
  paired?: boolean;
  skin: [name: string, backName?: string];
  muscle: [name: string, backName?: string];
};

const SEGMENTS: Segment[] = [
  { id: 'head', shape: E([0.1, 0.125, 0.11], [0, 1.63, 0]), skin: ['Head', 'Back of head'], muscle: ['Face & scalp muscles', 'Back of head muscles'] },
  { id: 'head', shape: E([0.017, 0.028, 0.025], [0, 1.615, 0.105]), skin: ['Face'], muscle: ['Face muscles'] },
  { id: 'ear', shape: E([0.015, 0.03, 0.022], [0.1, 1.625, 0]), paired: true, skin: ['Ear'], muscle: ['Ear muscles'] },
  { id: 'neck', shape: L([0, 1.45, 0], [0, 1.54, -0.005], 0.05), skin: ['Neck', 'Back of neck'], muscle: ['Neck muscles', 'Back of neck muscles'] },
  { id: 'chest', shape: torso(1.2, 1.475), skin: ['Chest', 'Upper back'], muscle: ['Pectoral muscles', 'Upper back muscles'] },
  { id: 'abdomen', shape: torso(1.03, 1.2), skin: ['Abdomen', 'Lower back'], muscle: ['Abdominal muscles', 'Lower back muscles'] },
  { id: 'pelvis', shape: torso(0.86, 1.03), skin: ['Groin & hips', 'Buttocks'], muscle: ['Hip flexors', 'Gluteal muscles'] },
  { id: 'shoulder', shape: E(0.062, [0.19, 1.4, 0]), paired: true, skin: ['Shoulder'], muscle: ['Deltoid muscle'] },
  { id: 'upper-arm', shape: L([0.215, 1.37, 0], [0.255, 1.12, 0], 0.046), paired: true, skin: ['Upper arm', 'Back of upper arm'], muscle: ['Biceps', 'Triceps'] },
  { id: 'elbow', shape: E(0.043, [0.258, 1.1, 0]), paired: true, skin: ['Elbow'], muscle: ['Elbow tendons'] },
  { id: 'forearm', shape: L([0.26, 1.08, 0], [0.285, 0.87, 0.02], 0.038), paired: true, skin: ['Forearm'], muscle: ['Forearm muscles'] },
  { id: 'hand', shape: E([0.035, 0.07, 0.022], [0.29, 0.79, 0.025]), paired: true, skin: ['Hand'], muscle: ['Hand muscles'] },
  { id: 'thigh', shape: L([0.09, 0.93, 0], [0.1, 0.54, 0], 0.075), paired: true, skin: ['Thigh', 'Back of thigh'], muscle: ['Quadriceps', 'Hamstrings'] },
  { id: 'knee', shape: E(0.056, [0.1, 0.5, 0.005]), paired: true, skin: ['Knee', 'Back of knee'], muscle: ['Knee tendons', 'Back of knee tendons'] },
  { id: 'lower-leg', shape: L([0.1, 0.47, 0], [0.1, 0.1, -0.005], 0.05), paired: true, skin: ['Shin', 'Calf'], muscle: ['Shin muscles', 'Calf muscles'] },
  { id: 'ankle', shape: E(0.04, [0.1, 0.08, 0]), paired: true, skin: ['Ankle'], muscle: ['Ankle tendons', 'Achilles tendon'] },
  { id: 'foot', shape: E([0.045, 0.03, 0.11], [0.1, 0.035, 0.045]), paired: true, skin: ['Foot'], muscle: ['Foot muscles'] },
];

type Piece = { id: string; shape: Shape; name: string; backName?: string; color: string; paired?: boolean };

const ORGANS: Piece[] = [
  { id: 'brain', shape: E([0.085, 0.08, 0.095], [0, 1.66, -0.005]), name: 'Brain', color: COLORS.brain },
  { id: 'throat', shape: L([0, 1.44, 0.015], [0, 1.56, 0.015], 0.017), name: 'Throat', color: COLORS.throat },
  { id: 'lung', shape: E([0.07, 0.115, 0.07], [0.075, 1.31, -0.005]), name: 'Lung', color: COLORS.lung, paired: true },
  { id: 'heart', shape: E([0.045, 0.055, 0.04], [0.02, 1.26, 0.05], [0, 0, -0.4]), name: 'Heart', color: COLORS.heart },
  { id: 'liver', shape: E([0.085, 0.05, 0.06], [-0.05, 1.165, 0.02], [0, 0, 0.15]), name: 'Liver', color: COLORS.liver },
  { id: 'stomach', shape: E([0.055, 0.04, 0.045], [0.065, 1.15, 0.035], [0, 0, -0.3]), name: 'Stomach', color: COLORS.stomach },
  { id: 'intestines', shape: { kind: 'knot', size: [0.085, 0.07, 0.04], at: [0, 1.03, 0.03] }, name: 'Intestines', color: COLORS.intestines },
  { id: 'kidney', shape: E([0.024, 0.045, 0.024], [0.075, 1.1, -0.055]), name: 'Kidney', color: COLORS.kidney, paired: true },
  { id: 'bladder', shape: E(0.035, [0, 0.92, 0.04]), name: 'Bladder', color: COLORS.bladder },
];

function vertebrae(id: string, name: string, from: number, to: number, step: number, z: number, r: number): Piece[] {
  const out: Piece[] = [];
  for (let y = from; y <= to + 1e-6; y += step) {
    out.push({ id, shape: E([r * 1.15, r * 0.6, r], [0, y, z]), name, color: COLORS.bone });
  }
  return out;
}

const RIB_WIDTHS = [0.1, 0.12, 0.13, 0.138, 0.14, 0.135, 0.125];

const BONES: Piece[] = [
  { id: 'skull', shape: E([0.09, 0.105, 0.1], [0, 1.645, -0.005]), name: 'Skull', color: COLORS.bone },
  { id: 'jaw', shape: E([0.06, 0.03, 0.06], [0, 1.55, 0.03]), name: 'Jaw', color: COLORS.bone },
  ...vertebrae('cervical-spine', 'Neck vertebrae (cervical spine)', 1.46, 1.54, 0.027, -0.01, 0.017),
  ...vertebrae('thoracic-spine', 'Upper spine (thoracic)', 1.18, 1.43, 0.031, -0.075, 0.021),
  ...vertebrae('lumbar-spine', 'Lower spine (lumbar)', 0.99, 1.15, 0.035, -0.055, 0.024),
  ...RIB_WIDTHS.map<Piece>((rx, i) => ({
    id: 'ribs',
    shape: { kind: 'ring', rx, rz: rx * 0.66, thickness: 0.009, at: [0, 1.4 - i * 0.035, -0.012] },
    name: 'Ribs',
    color: COLORS.bone,
  })),
  { id: 'sternum', shape: E([0.016, 0.08, 0.008], [0, 1.32, 0.082]), name: 'Breastbone (sternum)', color: COLORS.bone },
  { id: 'collarbone', shape: L([0.02, 1.445, 0.06], [0.17, 1.45, 0.01], 0.01), name: 'Collarbone', color: COLORS.bone, paired: true },
  { id: 'shoulder-blade', shape: E([0.06, 0.075, 0.012], [0.1, 1.36, -0.09], [0, 0.35, 0]), name: 'Shoulder blade', color: COLORS.bone, paired: true },
  { id: 'shoulder-joint', shape: E(0.03, [0.19, 1.4, 0]), name: 'Shoulder joint', color: COLORS.bone, paired: true },
  { id: 'humerus', shape: L([0.205, 1.38, 0], [0.255, 1.12, 0], 0.018), name: 'Upper arm bone (humerus)', color: COLORS.bone, paired: true },
  { id: 'elbow-joint', shape: E(0.024, [0.258, 1.1, 0]), name: 'Elbow joint', color: COLORS.bone, paired: true },
  { id: 'forearm-bones', shape: L([0.26, 1.08, 0.012], [0.285, 0.86, 0.032], 0.01), name: 'Forearm bones', color: COLORS.bone, paired: true },
  { id: 'forearm-bones', shape: L([0.26, 1.08, -0.012], [0.285, 0.86, 0.008], 0.01), name: 'Forearm bones', color: COLORS.bone, paired: true },
  { id: 'hand-bones', shape: E([0.025, 0.06, 0.012], [0.29, 0.79, 0.025]), name: 'Wrist & hand bones', color: COLORS.bone, paired: true },
  { id: 'hip-bone', shape: E([0.065, 0.055, 0.012], [0.075, 0.99, -0.015], [0.2, 1.0, -0.3]), name: 'Hip bone (pelvis)', color: COLORS.bone, paired: true },
  { id: 'pelvis', shape: { kind: 'ring', rx: 0.07, rz: 0.05, thickness: 0.012, at: [0, 0.92, 0] }, name: 'Pelvis', color: COLORS.bone },
  { id: 'sacrum', shape: E([0.032, 0.05, 0.02], [0, 0.95, -0.06], [-0.3, 0, 0]), name: 'Tailbone (sacrum)', color: COLORS.bone },
  { id: 'hip-joint', shape: E(0.03, [0.09, 0.92, 0]), name: 'Hip joint', color: COLORS.bone, paired: true },
  { id: 'femur', shape: L([0.09, 0.91, 0], [0.1, 0.53, 0], 0.022), name: 'Thigh bone (femur)', color: COLORS.bone, paired: true },
  { id: 'knee-joint', shape: E(0.03, [0.1, 0.5, 0]), name: 'Knee joint', color: COLORS.bone, paired: true },
  { id: 'kneecap', shape: E([0.022, 0.026, 0.012], [0.1, 0.5, 0.045]), name: 'Kneecap', color: COLORS.bone, paired: true },
  { id: 'shin-bones', shape: L([0.095, 0.47, 0.01], [0.098, 0.1, 0.005], 0.016), name: 'Shin bones', color: COLORS.bone, paired: true },
  { id: 'shin-bones', shape: L([0.125, 0.46, -0.01], [0.125, 0.11, -0.01], 0.009), name: 'Shin bones', color: COLORS.bone, paired: true },
  { id: 'ankle-joint', shape: E(0.022, [0.1, 0.075, 0]), name: 'Ankle joint', color: COLORS.bone, paired: true },
  { id: 'foot-bones', shape: E([0.03, 0.015, 0.09], [0.1, 0.035, 0.045]), name: 'Foot bones', color: COLORS.bone, paired: true },
];

// ---------------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0);

function mirror(shape: Shape): Shape {
  const m = ([x, y, z]: V3): V3 => [-x, y, z];
  switch (shape.kind) {
    case 'ellipsoid':
      return { ...shape, at: m(shape.at), rotation: shape.rotation && [shape.rotation[0], -shape.rotation[1], -shape.rotation[2]] };
    case 'limb':
      return { ...shape, from: m(shape.from), to: m(shape.to) };
    case 'lathe':
      return shape;
    default:
      return { ...shape, at: m(shape.at) };
  }
}

export function createBodyModel(): BodyModel {
  const root = new THREE.Group();
  root.position.y = -BODY_HEIGHT / 2;

  const pickables: THREE.Mesh[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materialsByLayer: THREE.MeshStandardMaterial[][] = LAYERS.map(() => []);
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const opacities = LAYERS.map(() => 1);

  const unitSphere = new THREE.SphereGeometry(1, 32, 20);
  geometries.push(unitSphere);

  const material = (layer: LayerIndex, color: string) => {
    const key = `${layer}:${color}`;
    let mat = materialCache.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color,
        roughness: layer === 0 ? 0.7 : 0.5,
        metalness: 0,
      });
      materialCache.set(key, mat);
      materialsByLayer[layer].push(mat);
    }
    return mat;
  };

  const buildMesh = (shape: Shape, shrink: number): THREE.Mesh => {
    switch (shape.kind) {
      case 'ellipsoid': {
        const mesh = new THREE.Mesh(unitSphere);
        mesh.scale.set(shape.radii[0] * shrink, shape.radii[1] * shrink, shape.radii[2] * shrink);
        mesh.position.set(...shape.at);
        if (shape.rotation) mesh.rotation.set(...shape.rotation);
        return mesh;
      }
      case 'limb': {
        const from = new THREE.Vector3(...shape.from);
        const to = new THREE.Vector3(...shape.to);
        const dir = to.clone().sub(from);
        const geometry = new THREE.CapsuleGeometry(shape.radius * shrink, dir.length(), 8, 20);
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry);
        mesh.position.copy(from).add(to).multiplyScalar(0.5);
        mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
        return mesh;
      }
      case 'ring': {
        const geometry = new THREE.TorusGeometry(1, shape.thickness / shape.rx, 8, 48);
        geometry.rotateX(Math.PI / 2);
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry);
        mesh.scale.set(shape.rx, shape.rx, shape.rz);
        mesh.position.set(...shape.at);
        return mesh;
      }
      case 'knot': {
        const geometry = new THREE.TorusKnotGeometry(1, 0.3, 120, 12, 3, 5);
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry);
        mesh.scale.set(...shape.size);
        mesh.position.set(...shape.at);
        return mesh;
      }
      case 'lathe': {
        const points = shape.profile.map(([r, y]) => new THREE.Vector2(r, y));
        const geometry = new THREE.LatheGeometry(points, 48);
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry);
        mesh.scale.set(shrink, 1, shape.depth * shrink);
        return mesh;
      }
    }
  };

  const add = (shape: Shape, part: BodyPart, color: string, shrink = 1) => {
    const mesh = buildMesh(shape, shrink);
    mesh.material = material(part.layer, color);
    mesh.userData.part = part;
    root.add(mesh);
    pickables.push(mesh);
  };

  const addMaybePaired = (shape: Shape, paired: boolean | undefined, part: BodyPart, color: string, shrink = 1) => {
    if (!paired) return add(shape, part, color, shrink);
    add(shape, { ...part, side: 'left' }, color, shrink);
    add(mirror(shape), { ...part, side: 'right' }, color, shrink);
  };

  for (const seg of SEGMENTS) {
    const [skinName, skinBack] = seg.skin;
    const [muscleName, muscleBack] = seg.muscle;
    addMaybePaired(seg.shape, seg.paired, { id: `skin-${seg.id}`, name: skinName, backName: skinBack, layer: 0 }, COLORS.skin);
    addMaybePaired(seg.shape, seg.paired, { id: `muscle-${seg.id}`, name: muscleName, backName: muscleBack, layer: 1 }, COLORS.muscle, 0.93);
  }
  for (const organ of ORGANS) {
    addMaybePaired(organ.shape, organ.paired, { id: `organ-${organ.id}`, name: organ.name, backName: organ.backName, layer: 2 }, organ.color);
  }
  for (const bone of BONES) {
    addMaybePaired(bone.shape, bone.paired, { id: `bone-${bone.id}`, name: bone.name, backName: bone.backName, layer: 3 }, bone.color);
  }

  // Soft contact shadow under the feet.
  const shadowGeometry = new THREE.CircleGeometry(0.32, 48);
  geometries.push(shadowGeometry);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#0f172a', transparent: true, opacity: 0.08, depthWrite: false });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  root.add(shadow);

  const setDepth = (depth: number) => {
    LAYERS.forEach((_, i) => {
      const layer = i as LayerIndex;
      const opacity = layerOpacityAt(layer, depth);
      opacities[layer] = opacity;
      for (const mat of materialsByLayer[layer]) {
        mat.opacity = opacity;
        mat.transparent = opacity < 0.999;
        mat.depthWrite = opacity >= 0.999;
        mat.visible = opacity > 0.01;
      }
    });
  };
  setDepth(0);

  return {
    root,
    pickables,
    setDepth,
    opacityOf: (layer) => opacities[layer],
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materialCache.forEach((m) => m.dispose());
      shadowMaterial.dispose();
    },
  };
}
