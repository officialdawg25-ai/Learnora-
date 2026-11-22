import { useEffect, useState } from 'react';

type Props={loading?:boolean;onComplete?:()=>void};

export default function SplashExperience({loading=false,onComplete}:Props){
 const [typed,setTyped]=useState('');
 useEffect(()=>{
  if(loading)return;
  let timer=0;
  let cancelled=false;
  const pause=(ms:number,fn:()=>void)=>{timer=window.setTimeout(()=>{if(!cancelled)fn();},ms);};
  let current='';
  const type=(value:string,index:number,done:()=>void)=>{
   if(cancelled)return;
   if(index>=value.length){done();return;}
   current+=value[index];
   setTyped(current);
   pause(78,()=>type(value,index+1,done));
  };
  const erase=(targetLength:number,done:()=>void)=>{
   if(cancelled)return;
   if(current.length<=targetLength){pause(180,done);return;}
   current=current.slice(0,-1);
   setTyped(current);
   pause(92,()=>erase(targetLength,done));
  };
  type('THE FUTRUE',0,()=>pause(760,()=>erase('THE FUT'.length,()=>type('URE OF LEARNING',0,()=>{}))));
  return()=>{cancelled=true;window.clearTimeout(timer);};
 },[loading]);
 if(loading)return <main className="splash-loading" role="status" aria-label="Loading Learnora"><div className="splash-loading-inner"><div className="splash-loading-mark"><img src="/brand/learnora-mark.svg" alt=""/></div><span className="splash-loading-label">PREPARING YOUR LEARNING SPACE</span><span className="splash-loading-track"/></div></main>;
 return <main className="splash-screen" aria-label="Learnora — The Future of Learning"><div className="splash-center"><div className="splash-brandline">LEARNORA / EDUCATION, INTELLIGENCE &amp; LEARNING</div><div className="splash-mark-wrap"><div className="splash-mark"><img src="/brand/learnora-mark.svg" alt="Learnora symbol"/></div></div><div className="splash-type-wrap" aria-live="polite"><span className="splash-tagline">{typed}</span><span className="splash-caret" aria-hidden="true"/></div><div className="splash-promise">WHERE POTENTIAL BECOMES POSSIBILITY</div></div><button className="splash-skip" onClick={onComplete}>Skip intro</button></main>;
}
