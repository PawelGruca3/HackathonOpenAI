import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import * as THREE from 'three';
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
export async function loadBodyModel(sex: BodySex): Promise<BodyModel> {
  const buffer = await readAsset(MODEL_FILES[sex]);
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  const body = gltf.scene;

  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0 });
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
