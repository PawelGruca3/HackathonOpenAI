'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createHeatSampler, heatColor, regionAtPoint, type CasePacket } from '@intake/shared';

export default function CaseHeatmap({ packet }: { packet: CasePacket }) {
  const container = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const renderRef = useRef<() => void>(() => {});
  const [back, setBack] = useState(false), [failed, setFailed] = useState(false);
  const signature = JSON.stringify({ sex: packet.sex, surface: packet.surfaceMarks || [], regions: packet.regions });
  useEffect(() => {
    const target = canvas.current, frame = container.current;
    if (!target || !frame) return;
    const data = JSON.parse(signature) as { sex: string; surface: NonNullable<CasePacket['surfaceMarks']>; regions: CasePacket['regions'] };
    let disposed = false, model: THREE.Object3D | null = null, renderer: THREE.WebGLRenderer | null = null;
    setBack(false);
    setFailed(false);
    try { renderer = new THREE.WebGLRenderer({canvas:target,antialias:true,alpha:true}); }
    catch { setFailed(true); return; }
    const activeRenderer = renderer;
    activeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30,1,.02,30);
    camera.position.set(0,0,4); camera.lookAt(0,0,0); cameraRef.current=camera;
    scene.add(new THREE.HemisphereLight('#ffffff','#aaaaaa',2));
    const light=new THREE.DirectionalLight('#ffffff',2); light.position.set(1,2,4); scene.add(light);
    const render=()=>activeRenderer.render(scene,camera); renderRef.current=render;
    const resize=()=>{const w=frame.clientWidth,h=frame.clientHeight;activeRenderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();};
    const observer=new ResizeObserver(resize);observer.observe(frame);resize();
    new GLTFLoader().loadAsync(`/models/${data.sex}.glb`).then(gltf=>{
      model=gltf.scene;
      if(disposed){model.traverse(child=>{if(child instanceof THREE.Mesh){child.geometry.dispose();(Array.isArray(child.material)?child.material:[child.material]).forEach(m=>m.dispose());}});return;}
      const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=1.8/size.y;
      model.scale.setScalar(scale);model.position.set(-center.x*scale,-box.min.y*scale-.9,-center.z*scale);model.updateMatrixWorld(true);
      const sample=createHeatSampler(data.surface),painted=new Set(data.surface.map(m=>m.regionId));
      model.traverse(child=>{
        if(!(child instanceof THREE.Mesh))return;
        (Array.isArray(child.material)?child.material:[child.material]).forEach(m=>m.dispose());
        child.material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.8,vertexColors:true});
        const p=child.geometry.getAttribute('position'),n=child.geometry.getAttribute('normal'),values=new Float32Array(p.count*3),v=new THREE.Vector3(),normal=new THREE.Vector3(),matrix=new THREE.Matrix3().getNormalMatrix(child.matrixWorld);
        for(let i=0;i<p.count;i++){
          v.fromBufferAttribute(p,i).applyMatrix4(child.matrixWorld);normal.fromBufferAttribute(n,i).applyMatrix3(matrix).normalize();
          const region=regionAtPoint(v.x,v.y,v.z),legacy=painted.has(region)?0:data.regions.find(r=>r.regionId===region)?.intensity||0;
          values.set(heatColor(Math.max(legacy,sample(v.x,v.y,v.z,normal.x,normal.y,normal.z))),i*3);
        }
        child.geometry.setAttribute('color',new THREE.BufferAttribute(values,3));
      });
      scene.add(model);render();
    }).catch(()=>{if(!disposed)setFailed(true);});
    return()=>{disposed=true;observer.disconnect();cameraRef.current=null;renderRef.current=()=>{};if(model)model.traverse(child=>{if(child instanceof THREE.Mesh){child.geometry.dispose();(Array.isArray(child.material)?child.material:[child.material]).forEach(m=>m.dispose());}});activeRenderer.dispose();};
  },[signature]);
  function turn(){const next=!back;setBack(next);const camera=cameraRef.current;if(camera){camera.position.z=next?-4:4;camera.lookAt(0,0,0);renderRef.current();}}
  return <div className="heatmap"><div ref={container} className="heatmap-canvas"><canvas ref={canvas} role="img" aria-label={`Patient-painted symptom intensity, ${back?'back':'front'} view. Numeric area intensities follow below.`} />{failed&&<p className="muted">The 3D view is unavailable. Use the reported areas below.</p>}</div><div className="heatmap-controls"><span>Patient-painted intensity</span><button type="button" className="quiet" onClick={turn}>{back?'Show front':'Show back'}</button></div></div>;
}
