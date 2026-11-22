import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ClipboardList, Plus, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
type Course={id:string;title:string;publication_status:string}
type Assessment={id:string;title:string;publication_status:string;assessment_type:string}
type Question={id:string;prompt:string;points:number;question_type:string;options:{id:string;text:string}[]};type Attempt={id:string;learner_id:string;attempt_number:number;answers:Record<string,any>;submitted_at:string}
export default function AssessmentBuilder({academyId,userId,onNotice}:{academyId:string;userId:string;onNotice:(s:string)=>void}){
 const [courses,setCourses]=useState<Course[]>([])
 const [courseId,setCourseId]=useState('')
 const [assessments,setAssessments]=useState<Assessment[]>([])
 const [assessmentId,setAssessmentId]=useState('')
 const [title,setTitle]=useState('')
 const [instructions,setInstructions]=useState('')
 const [question,setQuestion]=useState('')
 const [options,setOptions]=useState(['','','',''])
 const [correct,setCorrect]=useState('A')
 const [questionType,setQuestionType]=useState('multiple_choice')
 const [numericAnswer,setNumericAnswer]=useState('')
 const [pendingAttempts,setPendingAttempts]=useState<Attempt[]>([])
 const [grades,setGrades]=useState<Record<string,{score:string;feedback:string}>>({})
 const [points,setPoints]=useState('1')
 const [questions,setQuestions]=useState<Question[]>([])
 const [busy,setBusy]=useState(false)
 async function loadCourses(){
  if(!supabase||!academyId)return
  const {data,error}=await supabase.from('courses').select('id,title,publication_status').eq('academy_id',academyId).order('created_at',{ascending:false})
  if(error){onNotice('Assessment courses: '+error.message);return}
  const rows=(data??[]) as Course[];setCourses(rows);setCourseId(current=>rows.some(x=>x.id===current)?current:(rows[0]?.id??''))
 }
 async function loadAssessments(){
  if(!supabase||!courseId){setAssessments([]);setAssessmentId('');setQuestions([]);return}
  const {data,error}=await supabase.from('assessments').select('id,title,publication_status,assessment_type').eq('course_id',courseId).order('created_at',{ascending:false})
  if(error){onNotice('Assessments: '+error.message);return}
  const rows=(data??[]) as Assessment[];setAssessments(rows);setAssessmentId(current=>rows.some(x=>x.id===current)?current:(rows[0]?.id??''))
 }
 async function loadQuestions(){
  if(!supabase||!assessmentId){setQuestions([]);return}
  const [q,a]=await Promise.all([
   supabase.from('assessment_questions').select('id,prompt,points,question_type,options').eq('assessment_id',assessmentId).order('position'),
   supabase.from('assessment_attempts').select('id,learner_id,attempt_number,answers,submitted_at').eq('assessment_id',assessmentId).eq('status','submitted').order('submitted_at')
  ])
  if(q.error)onNotice('Assessment questions: '+q.error.message);else setQuestions((q.data??[]) as Question[])
  if(a.error)onNotice('Pending submissions: '+a.error.message);else{const rows=(a.data??[]) as Attempt[];setPendingAttempts(rows);setGrades(current=>{const next={...current};rows.forEach(x=>{if(!next[x.id])next[x.id]={score:'0',feedback:''}});return next})}
 }
 useEffect(()=>{void loadCourses()},[academyId])
 useEffect(()=>{void loadAssessments()},[courseId])
 useEffect(()=>{void loadQuestions()},[assessmentId])
 async function createAssessment(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!supabase||!courseId)return
  setBusy(true)
  const {data,error}=await supabase.from('assessments').insert({course_id:courseId,created_by:userId,title:title.trim(),instructions:instructions.trim()||null,assessment_type:'practice',settings:{attempt_limit:3,marking:'deterministic_objective'},publication_status:'draft'}).select('id,title,publication_status,assessment_type').single()
  setBusy(false);if(error||!data){onNotice('Assessment was not created: '+(error?.message??'Unknown error'));return}
  setAssessments(rows=>[data as Assessment,...rows]);setAssessmentId(data.id);setTitle('');setInstructions('');onNotice('Assessment draft created.')
 }
 async function addQuestion(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!supabase||!assessmentId)return
  if(questionType==='multiple_choice'&&options.some(x=>!x.trim())){onNotice('Complete all four answer options.');return}
  if(questionType==='numeric'&&!Number.isFinite(Number(numericAnswer))){onNotice('Enter a valid numeric answer.');return}
  setBusy(true)
  const questionOptions=questionType==='multiple_choice'?options.map((text,index)=>({id:String.fromCharCode(65+index),text:text.trim()})):[]
  const {data,error}=await supabase.from('assessment_questions').insert({assessment_id:assessmentId,question_type:questionType,prompt:question.trim(),options:questionOptions,points:Number(points),position:questions.length}).select('id,prompt,points,question_type,options').single()
  if(error||!data){setBusy(false);onNotice('Question was not saved: '+(error?.message??'Unknown error'));return}
  let keyError:any=null
  if(questionType==='multiple_choice'||questionType==='numeric'){
   const correctAnswer=questionType==='multiple_choice'?correct:Number(numericAnswer)
   const keyResult=await supabase.from('assessment_question_keys').insert({question_id:data.id,correct_answer:correctAnswer})
   keyError=keyResult.error
  }
  setBusy(false)
  if(keyError){onNotice('Question was saved, but the answer key could not be stored: '+keyError.message);return}
  setQuestions(rows=>[...rows,data as Question]);setQuestion('');setOptions(['','','','']);setNumericAnswer('');onNotice(questionType==='short_answer'||questionType==='long_answer'?'Question saved for educator marking.':'Objective question and private answer key saved.')
 }
 async function publish(){
  if(!supabase||!assessmentId)return
  const course=courses.find(x=>x.id===courseId)
  if(course?.publication_status!=='published'){onNotice('Publish and review the course before publishing its assessment.');return}
  if(questions.length<1){onNotice('Add at least one question before publishing.');return}
  setBusy(true)
  const {error}=await supabase.from('assessments').update({publication_status:'published'}).eq('id',assessmentId)
  setBusy(false);if(error)onNotice('Assessment could not be published: '+error.message);else{onNotice('Assessment published. Objective questions are marked deterministically; subjective question types require educator review.');await loadAssessments()}
 }
 if(!academyId)return null
 return <section className="studio-panel assessment-builder">
  <div className="panel-heading"><div><p className="eyebrow">ASSESSMENT STUDIO</p><h2>Check understanding.</h2></div><ClipboardList size={22}/></div>
  {courses.length===0?<p className="form-hint">Create a course first.</p>:<>
   <label className="builder-select">Course<select value={courseId} onChange={e=>setCourseId(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.title} · {c.publication_status}</option>)}</select></label>
   <form className="form-stack builder-form" onSubmit={createAssessment}><label>Assessment title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Module knowledge check"/></label><label>Instructions<textarea rows={2} maxLength={2000} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="Instructions for learners"/></label><button className="button button-dark" disabled={busy}>Create assessment draft <Plus size={15}/></button></form>
   {assessments.length>0&&<label className="builder-select">Assessment<select value={assessmentId} onChange={e=>setAssessmentId(e.target.value)}>{assessments.map(a=><option key={a.id} value={a.id}>{a.title} · {a.publication_status}</option>)}</select></label>}
   {assessmentId&&<><div className="builder-subheading"><strong>Multiple-choice questions</strong><span>{questions.length}</span></div>{questions.map((q,i)=><div className="builder-list-item static" key={q.id}><span className="builder-index">{String(i+1).padStart(2,'0')}</span><span>{q.prompt}<small>{q.points} point(s) · answer key private</small></span></div>)}
    {assessments.find(a=>a.id===assessmentId)?.publication_status==='draft'&&<form className="form-stack builder-form" onSubmit={addQuestion}>
     <label>Question prompt<textarea required rows={3} maxLength={3000} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Write a clear question…"/></label>
     <div className="assessment-options">{options.map((value,index)=><label key={index}>Option {String.fromCharCode(65+index)}<input required value={value} onChange={e=>setOptions(old=>old.map((x,i)=>i===index?e.target.value:x))}/></label>)}</div>
     <div className="form-row"><label>Correct answer<select value={correct} onChange={e=>setCorrect(e.target.value)}>{['A','B','C','D'].map(x=><option key={x}>{x}</option>)}</select></label><label>Points<input type="number" min="0.1" max="100" step="0.1" value={points} onChange={e=>setPoints(e.target.value)}/></label></div>
     <button className="button button-outline" disabled={busy}>Add question <Plus size={15}/></button>
    </form>}
    {assessments.find(a=>a.id===assessmentId)?.publication_status==='draft'&&<button className="button button-dark" disabled={busy||questions.length===0||courses.find(x=>x.id===courseId)?.publication_status!=='published'} onClick={()=>void publish()}>Publish assessment <Send size={15}/></button>}
   </>}
  </>}
  <p className="form-hint">Current authoring supports deterministic multiple-choice questions. Essay, file and rubric-based assessments require educator marking workflows before publication.</p>
 </section>
}
