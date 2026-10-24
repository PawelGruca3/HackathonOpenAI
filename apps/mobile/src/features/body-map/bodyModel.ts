import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import * as THREE from 'three';
import { createHeatSampler, heatColor, regionAtPoint, type Intake, type Mark, type SurfaceMark } from '@intake/shared';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type BodySex = 'male' | 'female';

/** Height the models are scaled to, in scene units (metres). */
export const BODY_HEIGHT = 1.8;

const MODEL_FILES: Record<BodySex, number> = {
  male: require('../../../assets/models/male.glb'),
  female: require('../../../assets/models/female.glb'),
};

export type BodyModel = {
  root: THREE.Group;
  /** The body meshes only (no shadow), for hit-testing taps. */
  surface: THREE.Object3D;
  /** Widest horizontal reach from the centre (e.g. fingertips), after scaling. */
  radius: number;
  dispose(): void;
};

async function readAsset(moduleId: number): Promise<ArrayBuffer> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}

/**
 * Loads a body model, gives it a plain skin material and normalises it:
 * BODY_HEIGHT tall, feet on y = 0, centred, facing +z. The group is then
 * shifted down by half its height so it rotates around its middle.
 */
export async function loadBodyModel(sex: BodySex, pose: Intake['pose'] = 'neutral'): Promise<BodyModel> {
  const buffer = await readAsset(MODEL_FILES[sex]);
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  const body = gltf.scene;

  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0, vertexColors: true });
  const geometries: THREE.BufferGeometry[] = [];
  body.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      (child.material as THREE.Material).dispose();
      child.material = material;
      geometries.push(child.geometry);
    }
  });

  const box = new THREE.Box3().setFromObject(body);
  const size = box.getSize(new THREE.Vector3());
  const scale = BODY_HEIGHT / size.y;
  body.scale.setScalar(scale);
  const center = box.getCenter(new THREE.Vector3());
  body.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

  const root = new THREE.Group();
  root.add(body);

  // Soft contact shadow under the feet.
  const shadowGeometry = new THREE.CircleGeometry(0.32, 48);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#0f172a', transparent: true, opacity: 0.08, depthWrite: false });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  root.add(shadow);

  root.position.y = -BODY_HEIGHT / 2;
  root.updateMatrixWorld(true);
  body.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const positions = child.geometry.getAttribute('position');
    const labels: string[] = [];
    const rest = new Float32Array(positions.count * 3);
    const restNormals = new Float32Array(positions.count * 3);
    const normal = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(child.matrixWorld);
    const colors = new Float32Array(positions.count * 3).fill(1);
    const vertex = new THREE.Vector3();
    const pivot = new THREE.Vector3();
    const inverse = child.matrixWorld.clone().invert();
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld);
      rest.set([vertex.x, vertex.y, vertex.z], i * 3);
      normal.fromBufferAttribute(child.geometry.getAttribute('normal'), i).applyMatrix3(normalMatrix).normalize();
      restNormals.set([normal.x, normal.y, normal.z], i * 3);
      const region = regionAtPoint(vertex.x, vertex.y, vertex.z);
      labels.push(region);
      // The source meshes are unrigged. A fixed, smoothly blended shoulder rotation
      // exposes the armpits without claiming free-form skeletal posing.
      if (pose === 'arms-raised' && (region.endsWith('-arm') || region.endsWith('-hand') || region.endsWith('-shoulder'))) {
        const side = vertex.x >= 0 ? 1 : -1;
        const weight = THREE.MathUtils.smoothstep(Math.abs(vertex.x), .18, .34);
        pivot.set(side * .18, .46, 0);
        vertex.sub(pivot).applyAxisAngle(new THREE.Vector3(0, 0, 1), side * .55 * weight).add(pivot).applyMatrix4(inverse);
        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
    }
    child.geometry.userData.regionIds = labels;
    child.geometry.setAttribute('restPosition', new THREE.BufferAttribute(rest, 3));
    child.geometry.setAttribute('restNormal', new THREE.BufferAttribute(restNormals, 3));
    child.geometry.userData.heatValues = new Float32Array(positions.count);
    child.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (pose === 'arms-raised') { positions.needsUpdate = true; child.geometry.computeVertexNormals(); child.geometry.computeBoundingSphere(); }
  });

  return {
    root,
    surface: body,
    radius: (Math.max(size.x, size.z) / 2) * scale,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      material.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
    },
  };
}

export function paintBody(model: BodyModel, marks: SurfaceMark[], legacy: Mark[] = []) {
  const paintedRegions = new Set(marks.map(m => m.regionId));
  const selected = new Map(legacy.filter(m => !paintedRegions.has(m.regionId)).map(m => [m.regionId as string, m.intensity]));
  const sample = createHeatSampler(marks);
  model.surface.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const ids = child.geometry.userData.regionIds as string[];
    const colors = child.geometry.getAttribute('color');
    const rest = child.geometry.getAttribute('restPosition');
    const normals = child.geometry.getAttribute('restNormal');
    const values = child.geometry.userData.heatValues as Float32Array;
    if (!ids || !colors) return;
    ids.forEach((id, i) => {
      const intensity = Math.max(selected.get(id) || 0, sample(rest.getX(i), rest.getY(i), rest.getZ(i), normals.getX(i), normals.getY(i), normals.getZ(i)));
      values[i] = intensity;
      colors.setXYZ(i, ...heatColor(intensity));
    });
    colors.needsUpdate = true;
  });
}

/** Only the current brush footprint is evaluated while dragging, without rebuilding the saved map. */
export function paintDab(model: BodyModel, mark: SurfaceMark) {
  const sample = createHeatSampler([mark]);
  model.surface.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const g = child.geometry, rest = g.getAttribute('restPosition'), normal = g.getAttribute('restNormal'), colors = g.getAttribute('color');
    const values = g.userData.heatValues as Float32Array;
    for (let i=0; i<rest.count; i++) {
      if (Math.abs(rest.getX(i)-mark.x) > mark.radius || Math.abs(rest.getY(i)-mark.y) > mark.radius || Math.abs(rest.getZ(i)-mark.z) > mark.radius) continue;
      const value = sample(rest.getX(i), rest.getY(i), rest.getZ(i), normal.getX(i), normal.getY(i), normal.getZ(i));
      if (value > values[i]) { values[i] = value; colors.setXYZ(i, ...heatColor(value)); }
    }
    colors.needsUpdate = true;
  });
}
