import React from 'react';
import {Video} from '@remotion/media';
import {AbsoluteFill, Composition, Series, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {BasicCaptions} from './basic-captions';

type FootageProps = {src:string;zoom?:number;centerX?:number;centerY?:number};
const Footage: React.FC<FootageProps> = ({src,zoom=1.4,centerX=800,centerY=430}) => {
  const {fps}=useVideoConfig();
  return <AbsoluteFill style={{height:930,bottom:"auto",overflow:'hidden',background:'white'}}><Video src={staticFile(src)} muted premountFor={fps} style={{position:'absolute',width:1600*zoom,height:900*zoom,left:960-centerX*zoom,top:480-centerY*zoom}}/></AbsoluteFill>;
};
const captionStyle:React.CSSProperties={position:'absolute',left:160,bottom:40};
export const DemoFilm:React.FC=()=>{
  const {fps,durationInFrames}=useVideoConfig(); const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:'#121212',fontFamily:'Arial, Helvetica, sans-serif'}}>
    <Series>
      <Series.Sequence name="Start a real case" durationInFrames={8*fps} premountFor={fps}>
        <Footage src="footage/01-start.mp4" zoom={1.3} centerY={390}/>
        <BasicCaptions name="Problem" width={1600} premountFor={fps} style={captionStyle} captions={[
          {text:'Knee pain is more than a text box.',startMs:0,endMs:3500,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'Show where it hurts, then tell the story once.',startMs:3500,endMs:8000,timestampMs:null,confidence:null,pageBreakAfter:true},
        ]}/>
      </Series.Sequence>
      <Series.Sequence name="Rotate and paint the body" durationInFrames={18*fps} premountFor={fps}>
        <Footage src="footage/02-body-knee.mp4" zoom={1.8} centerY={470}/>
        <BasicCaptions name="Body interaction" width={1600} premountFor={fps} style={captionStyle} captions={[
          {text:'Rotate the 3D body to reach the right spot.',startMs:0,endMs:6500,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'Paint the affected area directly on the body.',startMs:6500,endMs:12500,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'The mark becomes part of the patient’s intake.',startMs:12500,endMs:18000,timestampMs:null,confidence:null,pageBreakAfter:true},
        ]}/>
      </Series.Sequence>
      <Series.Sequence name="Symptoms and vitals" durationInFrames={16*fps} premountFor={fps}>
        <Footage src="footage/03-symptoms.mp4" zoom={1.1} centerY={470}/>
        <BasicCaptions name="Patient report" width={1600} premountFor={fps} style={captionStyle} captions={[
          {text:'Set the knee intensity to 5 out of 10.',startMs:0,endMs:5500,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'Add the original symptoms, height and weight.',startMs:5500,endMs:11000,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'Continue: OpenAI requests a relevant photo area.',startMs:11000,endMs:16000,timestampMs:null,confidence:null,pageBreakAfter:true},
        ]}/>
      </Series.Sequence>
      <Series.Sequence name="Upload the supplied case photo" durationInFrames={14*fps} premountFor={fps}>
        <Footage src="footage/04-photo.mp4" zoom={1.1} centerY={470}/>
        <BasicCaptions name="Photo evidence" width={1600} premountFor={fps} style={captionStyle} captions={[
          {text:'The app asks for a photo of the left knee.',startMs:0,endMs:5000,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'Attach the supplied case photo to that area.',startMs:5000,endMs:10000,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'Text, body location and photo stay together.',startMs:10000,endMs:14000,timestampMs:null,confidence:null,pageBreakAfter:true},
        ]}/>
      </Series.Sequence>
      <Series.Sequence name="Real OpenAI request" durationInFrames={4*fps} premountFor={fps}>
        <Footage src="footage/05-analysis-padded.mp4" zoom={1.25} centerY={430}/>
        <BasicCaptions name="Analysis" width={1600} premountFor={fps} style={captionStyle} captions={[
          {text:'Run the real OpenAI text-and-image analysis.',startMs:0,endMs:4000,timestampMs:null,confidence:null,pageBreakAfter:true},
        ]}/>
      </Series.Sequence>
      <Series.Sequence name="Patient and clinician summaries" durationInFrames={18*fps} premountFor={fps}>
        <Footage src="footage/05-result.mp4" zoom={1.4} centerY={420}/>
        <BasicCaptions name="Actual AI result" width={1600} premountFor={fps} style={captionStyle} captions={[
          {text:'Reported intensity: 5. AI-estimated urgency: 3.',startMs:0,endMs:5500,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'A patient summary and a clinician-facing brief.',startMs:5500,endMs:11500,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'Uncertainty stays explicit. This is not a diagnosis.',startMs:11500,endMs:18000,timestampMs:null,confidence:null,pageBreakAfter:true},
        ]}/>
      </Series.Sequence>
      <Series.Sequence name="Specialty discovery" durationInFrames={10*fps} premountFor={fps}>
        <Footage src="footage/06-discovery.mp4" zoom={1.4} centerY={435}/>
        <BasicCaptions name="Find care" width={1600} premountFor={fps} style={captionStyle} captions={[
          {text:'Orthopedics is carried into doctor discovery.',startMs:0,endMs:5000,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'Map and filters, using a demo directory.',startMs:5000,endMs:10000,timestampMs:null,confidence:null,pageBreakAfter:true},
        ]}/>
      </Series.Sequence>
      <Series.Sequence name="Clinician opens the same case" durationInFrames={12*fps} premountFor={fps}>
        <Footage src="footage/07-clinician-review.mp4" zoom={1.35} centerX={990} centerY={430}/>
        <BasicCaptions name="Clinician packet" width={1600} premountFor={fps} style={captionStyle} captions={[
          {text:'The same case arrives in the clinician workspace.',startMs:0,endMs:5500,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'The original inputs and AI brief, together.',startMs:5500,endMs:12000,timestampMs:null,confidence:null,pageBreakAfter:true},
        ]}/>
      </Series.Sequence>
      <Series.Sequence name="Review the photo and save a note" durationInFrames={10*fps} premountFor={fps}>
        <Footage src="footage/08-clinician-note.mp4" zoom={1.15} centerX={990} centerY={470}/>
        <BasicCaptions name="Clinician action" width={1600} premountFor={fps} style={captionStyle} captions={[
          {text:'Inspect the photo. Add a demo clinician note.',startMs:0,endMs:5500,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'Save it directly onto the patient’s case.',startMs:5500,endMs:10000,timestampMs:null,confidence:null,pageBreakAfter:true},
        ]}/>
      </Series.Sequence>
      <Series.Sequence name="Patient sees the saved note" durationInFrames={10*fps} premountFor={fps}>
        <Footage src="footage/09-patient-handoff.mp4" zoom={1.45} centerY={445}/>
        <BasicCaptions name="Visible outcome" width={1600} premountFor={fps} style={captionStyle} captions={[
          {text:'The saved note is now in the patient app.',startMs:0,endMs:5500,timestampMs:null,confidence:null,pageBreakAfter:true},
          {text:'One intake. The same context on both sides.',startMs:5500,endMs:10000,timestampMs:null,confidence:null,pageBreakAfter:true},
        ]}/>
      </Series.Sequence>
    </Series>
    <div style={{position:'absolute',top:0,left:0,right:0,height:44,background:'#171717',color:'#fff',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 34px',fontSize:20}}><span style={{fontWeight:700}}>intake · working app demo</span><span>Recorded replay of the supplied case · AI decision support</span></div>
    <div style={{position:'absolute',bottom:0,left:0,height:4,width:`${frame/(durationInFrames-1)*100}%`,background:'#80aaff'}}/>
  </AbsoluteFill>;
};
export const MyComposition:React.FC=()=> <Composition id="IntakeHackathonDemo" component={DemoFilm} durationInFrames={3600} fps={30} width={1920} height={1080}/>;
