import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronRight, ClipboardList, PlayCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
type Module={id:string;title:string;description:string|null;position:number}
type Lesson={id:string;module_id:string;title:string;lesson_type:string;content:any;position:number;estimated_minutes:number|null}
type Progress={lesson_id:string;status:string;progress_percent:number}
type Assessment={id:string;title:string;instructions:string|null;assessment_type:string}
type Question={id:string;question_type:string;prompt:string;options:{id:string;text:string}[];points:number;position:number}
type Result={attempt_id:string;status:string;score:number|null;feedback:any}
export default function LearningPlayer({courseId,userId,onBack,onNotice}:{courseId:string;userId:string;onBack:()=>void;onNotice:(s:string)=>void}){
 const [course,setCourse]=useState<{title:string;summary:string|null}|null>(null)
 const [modules,setModules]=useState<Module[]>([])
 const [lessons,setLessons]=useState<Lesson[]>([])
 const [progress,setProgress]=useState<Progress[]>([])
 const [selectedLesson,setSelectedLesson]=useState('')
 const [assessments,setAssessments]=useState<Assessment[]>([])
 const [selectedAssessment,setSelectedAssessment]=useState('')
 const [questions,setQuestions]=useState<Question[]>([])
 const [answers,setAnswers]=useState<Record<string,string>>({})
 const [result,setResult]=useState<Result|null>(null)
 const [busy,setBusy]=useState(false)
 const completed=new Set(progress.filter(x=>x.status==='completed').map(x=>x.lesson_id))
 const activeLesson=lessons.find(x=>x.id===selectedLesson)
 const progressPercent=lessons.length?Math.round((completed.size/lessons.length)*100):0
 async function load(){
  if(!supabase||!userId)return
  const [courseRes,moduleRes,assessmentRes,progressRes]=await Promise.all([
   supabase.from('courses').select('title,summary').eq('id',courseId).maybeSingle(),
   supabase.from('course_modules').select('id,title,description,position').eq('course_id',courseId).order('position'),
   supabase.from('assessments').select('id,title,instructions,assessment_type').eq('course_id',courseId).eq('publication_status','published').order('created_at'),
   supabase.from('learning_progress').select('lesson_id,status,progress_percent').eq('learner_id',userId)
  ])
  if(courseRes.error||moduleRes.error||assessmentRes.error||progressRes.error){onNotice('Learning content could not be loaded: '+[courseRes.error,moduleRes.error,assessmentRes.error,progressRes.error].filter(Boolean).map(x=>x?.message).join('; '));return}
  setCourse(courseRes.data)
  const moduleRows=(moduleRes.data??[]) as Module[];setModules(moduleRows)
  setAssessments((assessmentRes.data??[]) as Assessment[])
  setProgress((progressRes.data??[]) as Progress[])
  if(moduleRows.length){
   const {data:lessonRows,error}=await supabase.from('lessons').select('id,module_id,title,lesson_type,content,position,estimated_minutes').in('module_id',moduleRows.map(x=>x.id)).order('position')
   if(error){onNotice('Lessons could not be loaded: '+error.message);return}
   const rows=(lessonRows??[]) as Lesson[];setLessons(rows);setSelectedLesson(current=>rows.some(x=>x.id===current)?current:(rows[0]?.id??''))
  }else{setLessons([]);setSelectedLesson('')}
 }
 useEffect(()=>{void load()},[courseId,userId])
 useEffect(()=>{if(!supabase||!selectedAssessment){setQuestions([]);setAnswers({});setResult(null);return}let active=true;supabase.from('assessment_questions').select('id,question_type,prompt,options,points,position').eq('assessment_id',selectedAssessment).order('position').then(({data,error})=>{if(!active)return;if(error)onNotice('Assessment questions could not be loaded: '+error.message);else setQuestions((data??[]) as Question[])});return()=>{active=false}},[selectedAssessment])
 async function markComplete(){
  if(!supabase||!activeLesson)return
  setBusy(true)
  const {error}=await supabase.rpc('record_lesson_progress',{p_lesson_id:activeLesson.id,p_progress_percent:100})
  setBusy(false)
  if(error){onNotice('Lesson progress was not saved: '+error.message);return}
  setProgress(rows=>[...rows.filter(x=>x.lesson_id!==activeLesson.id),{lesson_id:activeLesson.id,status:'completed',progress_percent:100}])
  onNotice('Lesson marked complete. Completion is not the same as demonstrated mastery.')
 }
 async function submitAssessment(){
  if(!supabase||!selectedAssessment)return
  setBusy(true)
  const {data,error}=await supabase.rpc('submit_assessment_attempt',{p_assessment_id:selectedAssessment,p_answers:answers})
  setBusy(false)
  if(error){onNotice('Assessment could not be submitted: '+error.message);return}
  setResult(data as Result)
 }
 const questionReady=questions.length>0&&questions.every(q=>q.question_type==='multiple_choice')
 const lessonContent=useMemo(()=>{const c=activeLesson?.content;if(!c)return '';if(typeof c==='string')return c;if(typeof c.body==='string')return c.body;return JSON.stringify(c,null,2)},[activeLesson])
 return <section className="learning-player">
  <div className="player-top"><button className="text-button" onClick={onBack}><ArrowLeft size={15}/> Back to My Learning</button><span>{progressPercent}% COURSE COMPLETION</span></div>
  <div className="player-progress"><span style={{width:progressPercent+'%'}}/></div>
  <div className="player-heading"><p className="eyebrow">YOUR LEARNING SPACE</p><h1>{course?.title??'Learning programme'}</h1><p>{course?.summary}</p></div>
  <div className="player-layout">
   <aside className="player-sidebar"><div className="builder-subheading"><strong>Course content</strong><span>{completed.size}/{lessons.length}</span></div>
    {modules.map((m,i)=><div className="player-module" key={m.id}><strong>{String(i+1).padStart(2,'0')} · {m.title}</strong>{lessons.filter(l=>l.module_id===m.id).map(l=><button key={l.id} className={selectedLesson===l.id?'player-lesson selected':'player-lesson'} onClick={()=>{setSelectedLesson(l.id);setSelectedAssessment('')}}><span>{completed.has(l.id)?<CheckCircle2 size={14}/>:<PlayCircle size={14}/>}</span>{l.title}</button>)}</div>)}
    {assessments.length>0&&<div className="player-module"><strong>Assessments</strong>{assessments.map(a=><button key={a.id} className={selectedAssessment===a.id?'player-lesson selected':'player-lesson'} onClick={()=>{setSelectedAssessment(a.id);setSelectedLesson('')}}><ClipboardList size={14}/>{a.title}</button>)}</div>}
   </aside>
   <main className="player-main">
    {activeLesson&&<article className="lesson-content"><div className="eyebrow">{activeLesson.lesson_type.replace('_',' ')} {activeLesson.estimated_minutes?' · '+activeLesson.estimated_minutes+' MIN':''}</div><h2>{activeLesson.title}</h2><div className="lesson-body">{lessonContent}</div><div className="lesson-actions">{completed.has(activeLesson.id)?<span className="enrolled"><CheckCircle2 size={15}/>Completed</span>:<button className="button button-dark" disabled={busy} onClick={()=>void markComplete()}>Mark lesson complete <CheckCircle2 size={15}/></button>}</div><p className="form-hint">Marking a lesson complete records learner progress only. Mastery is measured separately through assessment and evidence.</p></article>}
    {selectedAssessment&&<article className="lesson-content"><div className="eyebrow">ASSESSMENT</div><h2>{assessments.find(x=>x.id===selectedAssessment)?.title}</h2><p>{assessments.find(x=>x.id===selectedAssessment)?.instructions}</p>{result?<div className="assessment-result"><strong>{result.status==='graded'?'Assessment marked':'Submission received'}</strong>{result.score!==null&&<span>{result.score}%</span>}<p>{result.status==='graded'?'Objective answers were marked deterministically.':'This assessment requires educator review before a final result is available.'}</p></div>:<>{!questionReady&&questions.length>0?<p className="form-hint">This assessment contains question types that require educator review and are not supported by this learner player yet.</p>:questions.map((q,i)=><div className="learner-question" key={q.id}><strong>{i+1}. {q.prompt}</strong><small>{q.points} point(s)</small>{q.options.map(o=><label key={o.id}><input type="radio" name={q.id} checked={answers[q.id]===o.id} onChange={()=>setAnswers(old=>({...old,[q.id]:o.id}))}/>{o.id}. {o.text}</label>)}</div>)}{questionReady&&<button className="button button-dark" disabled={busy} onClick={()=>void submitAssessment()}>Submit assessment <ChevronRight size={15}/></button>}</>}</article>}
    {!activeLesson&&!selectedAssessment&&<div className="empty-state"><h3>Your learning path starts here.</h3><p>Choose a lesson from the course outline.</p></div>}
   </main>
  </div>
 </section>
}
