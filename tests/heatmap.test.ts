import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSurfaceMark, createHeatSampler, heatColor, intakeSchema, summarizeSurfaceMarks, type SurfaceMark } from '@intake/shared';

const point = {x:.06,y:.32,z:.12,nx:0,ny:0,nz:1,regionId:'chest' as const};
test('holding increases a precise point to a capped intensity without filling its whole region',()=>{
  let marks:SurfaceMark[]=[];
  for(let i=0;i<30;i++)marks=addSurfaceMark(marks,point);
  assert.equal(marks.length,1);assert.equal(marks[0].intensity,10);
  const sample=createHeatSampler(marks);
  assert.equal(sample(point.x,point.y,point.z,0,0,1),10);
  assert.equal(sample(point.x,point.y,point.z,0,0,-1),0);
  assert.equal(sample(.3,.32,.12,0,0,1),0);
  assert.ok(sample(.08,.32,.12,0,0,1)>0);
  assert.ok(sample(.08,.32,.12,0,0,1)<10);
  assert.deepEqual(summarizeSurfaceMarks(marks),[{regionId:'chest',intensity:10}]);
});
test('free points remain distinct, preserve data through validation, and have a numeric intensity alternative',()=>{
  let marks=addSurfaceMark([],point);
  marks=addSurfaceMark(marks,{...point,x:.13});
  assert.equal(marks.length,2);assert.deepEqual(summarizeSurfaceMarks(marks),[{regionId:'chest',intensity:1}]);
  const result=intakeSchema.parse({sex:'female',heightCm:170,weightKg:65,pose:'neutral',regions:summarizeSurfaceMarks(marks),surfaceMarks:marks,symptoms:'Sample symptoms for a painted area.'});
  assert.deepEqual(result.surfaceMarks,marks);
  assert.deepEqual(heatColor(0),[1,1,1]);assert.ok(heatColor(10)[1]<heatColor(1)[1]);
  assert.equal(intakeSchema.safeParse({...result,surfaceMarks:[{...marks[0],intensity:99}]}).success,false);
  assert.equal(intakeSchema.safeParse({...result,surfaceMarks:Array(601).fill(marks[0])}).success,false);
});
