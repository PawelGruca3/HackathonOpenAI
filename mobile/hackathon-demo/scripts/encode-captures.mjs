import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const project = path.resolve(import.meta.dirname, '..');
const root = path.join(project, 'capture-source');
const clips = ['01-start','02-body-knee','03-symptoms','04-photo','05-ai-summary','05-result','06-discovery','07-clinician-review','08-clinician-note','09-patient-handoff'];
fs.mkdirSync(path.join(project,'public/footage'),{recursive:true});
const metadata = {};
for (const clip of clips) {
  const directory = path.join(root,clip);
  const {duration,frames} = JSON.parse(fs.readFileSync(path.join(directory,'frames.json'),'utf8'));
  const lines = ['ffconcat version 1.0'];
  frames.forEach((frame,i)=> {
    lines.push(`file '${frame.file}'`);
    lines.push(`duration ${Math.max(.001,(frames[i+1]?.time ?? duration)-frame.time).toFixed(6)}`);
  });
  lines.push(`file '${frames.at(-1).file}'`);
  const list = path.join(directory,'capture.ffconcat');
  fs.writeFileSync(list,lines.join('\n')+'\n');
  const output = path.join(project,'public/footage',clip+'.mp4');
  const process = spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-safe','0','-i',list,'-vf','fps=30,scale=1600:900:force_original_aspect_ratio=decrease,pad=1600:900:(ow-iw)/2:(oh-ih)/2:white','-t',String(duration),'-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output],{stdio:'inherit'});
  if(process.status!==0)throw new Error('Encoding failed: '+clip);
  metadata[clip] = {duration,frames:frames.length,source:'Actual app screen capture, with original wall-clock frame timing'};
  console.log(clip,frames.length,'frames,',duration.toFixed(2),'seconds');
}
fs.writeFileSync(path.join(project,'public/footage/manifest.json'),JSON.stringify(metadata,null,2)+'\n');
