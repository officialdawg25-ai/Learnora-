import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Building2, GraduationCap, Plus, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Organisation={id:string;name:string;organisation_type:string;status:string}
type ClassRow={id:string;name:string;grade_or_level:string|null;academic_year:number|null}
type Report={class_id:string;name:string;grade_or_level:string|null;academic_year:number|null;active_learners:number;active_educators:number;assigned_courses:number;assessment_attempts:number;average_assessment_score:number|null}
export default function InstitutionWorkspace({userId,onNotice}:{userId:string;onNotice:(s:string)=>void}){
 const [organisations,setOrganisations]=useState<Organisation[]>([])
 const [organisationId,setOrganisationId]=useState('')
 const [organisationName,setOrganisationName]=useState('')
 const [organisationType,setOrganisationType]=useState('school')
 const [className,setClassName]=useState('')
 const [grade,setGrade]=useState('')
 const [year,setYear]=useState(String(new Date().getFullYear()))
 const [memberId,setMemberId]=useState('')
 const [memberRole,setMemberRole]=useState<'learner'|'educator'|'assistant'>('learner')
 const [classId,setClassId]=useState('')
 const [courseId,setCourseId]=useState('')
 const [classes,setClasses]=useState<ClassRow[]>([])
 const [courses,setCourses]=useState<{id:string;title:string}[]>([])
 const [reports,setReports]=useState<Report[]>([])
 const [busy,setBusy]=useState(false)

 async function load(){
  if(!supabase)return
  const {data,error}=await supabase.from('organisations').select('id,name,organisation_type,status').order('created_at',{ascending:false})
  if(error){onNotice('Institution access: '+error.message);return}
  const rows=(data??[]) as Organisation[];setOrganisations(rows)
  const selected=rows.some(x=>x.id===organisationId)?organisationId:(rows[0]?.id??'')
  setOrganisationId(selected)
 }
 async function loadOrganisation(id:string){
  if(!supabase||!id)return
  const [c,r,p]=await Promise.all([
   supabase.from('institution_classes').select('id,name,grade_or_level,academic_year').eq('organisation_id',id).order('created_at',{ascending:false}),
   supabase.from('institution_class_analytics').select('*').eq('organisation_id',id),
   supabase.from('courses').select('id,title').eq('publication_status','published').limit(100)
  ])
  if(c.error)onNotice('Classes: '+c.error.message);else{const rows=(c.data??[]) as ClassRow[];setClasses(rows);setClassId(current=>rows.some(x=>x.id===current)?current:(rows[0]?.id??''))}
  if(r.error)onNotice('Academic reporting: '+r.error.message);else setReports((r.data??[]) as Report[])
  if(p.error)onNotice('Course catalogue: '+p.error.message);else setCourses((p.data??[]) as {id:string;title:string}[])
 }
 useEffect(()=>{void load()},[userId])
 useEffect(()=>{if(organisationId)void loadOrganisation(organisationId);else{setClasses([]);setReports([])}},[organisationId])

 async function createOrganisation(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!supabase)return;setBusy(true)
  const slug=organisationName.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  const {data,error}=await supabase.from('organisations').insert({name:organisationName.trim(),slug,organisation_type:organisationType,created_by:userId,status:'pending'}).select('id,name,organisation_type,status').single()
  if(error||!data){setBusy(false);onNotice('Institution registration failed: '+(error?.message??'Unknown error'));return}
  const membership=await supabase.from('organisation_memberships').insert({organisation_id:data.id,user_id:userId,role:'owner',status:'active'})
  setBusy(false)
  if(membership.error){onNotice('Institution was created but owner membership could not be established: '+membership.error.message);return}
  setOrganisations(rows=>[data as Organisation,...rows]);setOrganisationId(data.id);setOrganisationName('');onNotice('Institution workspace created. Institutional verification remains pending.')
 }
 async function createClass(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!supabase||!organisationId)return;setBusy(true)
  const {data,error}=await supabase.from('institution_classes').insert({organisation_id:organisationId,name:className.trim(),grade_or_level:grade.trim()||null,academic_year:Number(year),created_by:userId}).select('id,name,grade_or_level,academic_year').single()
  setBusy(false);if(error||!data){onNotice('Class was not created: '+(error?.message??'Unknown error'));return}
  setClasses(rows=>[data as ClassRow,...rows]);setClassId(data.id);setClassName('');onNotice('Class created.')
 }
 async function addMember(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!supabase||!classId)return;setBusy(true)
  const {error}=await supabase.from('class_memberships').insert({class_id:classId,user_id:memberId.trim(),role:memberRole,status:'invited',created_by:userId})
  setBusy(false);if(error)onNotice('Class invitation failed: '+error.message);else{setMemberId('');onNotice('Class invitation recorded for the existing Learnora user.')}
 }
 async function assignCourse(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!supabase||!classId||!courseId)return;setBusy(true)
  const {error}=await supabase.from('class_courses').insert({class_id:classId,course_id:courseId,assigned_by:userId})
  setBusy(false);if(error)onNotice('Course assignment failed: '+error.message);else{onNotice('Course assigned to the class.');if(organisationId)await loadOrganisation(organisationId)}
 }
 return <section className="institution-workspace">
  <div className="page-intro"><p className="eyebrow">INSTITUTIONAL INFRASTRUCTURE</p><h1>Education,<br/><em>in context.</em></h1><p>Manage institution membership, classes, course allocation and academic reporting within your authorised organisation.</p></div>
  <div className="institution-grid">
   <section className="studio-panel"><div className="panel-heading"><div><p className="eyebrow">ORGANISATION</p><h2>Institution workspace</h2></div><Building2 size={22}/></div>
    {organisations.length>0&&<label className="builder-select">Your institution<select value={organisationId} onChange={e=>setOrganisationId(e.target.value)}>{organisations.map(o=><option key={o.id} value={o.id}>{o.name} · {o.status}</option>)}</select></label>}
    <form className="form-stack builder-form" onSubmit={createOrganisation}><label>Institution name<input required maxLength={160} value={organisationName} onChange={e=>setOrganisationName(e.target.value)} placeholder="School, college or organisation"/></label><label>Institution type<select value={organisationType} onChange={e=>setOrganisationType(e.target.value)}><option value="school">School</option><option value="university">University</option><option value="college">College</option><option value="training_provider">Training provider</option><option value="academy">Independent academy</option><option value="corporate">Corporate learning</option><option value="non_profit">Non-profit education</option></select></label><button className="button button-dark" disabled={busy}>Create institution <Plus size={15}/></button><p className="form-hint">New organisations start pending verification. Creating a workspace does not imply accreditation or official institutional recognition.</p></form>
   </section>
   <section className="studio-panel"><div className="panel-heading"><div><p className="eyebrow">ACADEMIC DELIVERY</p><h2>Classes and courses</h2></div><GraduationCap size={22}/></div>
    {!organisationId?<p className="form-hint">Create or select an institution first.</p>:<>
     <form className="form-stack builder-form" onSubmit={createClass}><label>Class name<input required maxLength={120} value={className} onChange={e=>setClassName(e.target.value)} placeholder="Grade 12 Mathematics A"/></label><div className="form-row"><label>Grade / level<input value={grade} onChange={e=>setGrade(e.target.value)} placeholder="Grade 12"/></label><label>Academic year<input type="number" min="2000" max="2100" value={year} onChange={e=>setYear(e.target.value)}/></label></div><button className="button button-dark" disabled={busy}>Create class</button></form>
     {classes.length>0&&<><label className="builder-select">Selected class<select value={classId} onChange={e=>setClassId(e.target.value)}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <form className="team-invite-form institution-form" onSubmit={addMember}><label>Existing Learnora user ID<input required value={memberId} onChange={e=>setMemberId(e.target.value)} placeholder="User UUID"/></label><label>Class role<select value={memberRole} onChange={e=>setMemberRole(e.target.value as typeof memberRole)}><option value="learner">Learner</option><option value="educator">Educator</option><option value="assistant">Assistant</option></select></label><button className="button button-outline">Invite member</button></form>
      <form className="team-invite-form institution-form" onSubmit={assignCourse}><label>Published course<select required value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="">Select course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><span/><button className="button button-outline">Assign course</button></form>
     </>}
    </>}
   </section>
  </div>
  <section className="studio-panel institution-reports"><div className="panel-heading"><div><p className="eyebrow">ACADEMIC INTELLIGENCE</p><h2>Institution reporting</h2></div><Users size={22}/></div>
   {reports.length===0?<p className="form-hint">Class-level reporting appears when classes and academic activity exist. No sample statistics are displayed.</p>:<div className="analytics-table"><div className="analytics-head institution-report-head"><span>CLASS</span><span>LEARNERS</span><span>EDUCATORS</span><span>COURSES</span><span>ATTEMPTS</span><span>AVG SCORE</span></div>{reports.map(r=><div className="analytics-row institution-report-row" key={r.class_id}><span>{r.name}<small>{r.grade_or_level??'—'} · {r.academic_year??'—'}</small></span><span>{r.active_learners}</span><span>{r.active_educators}</span><span>{r.assigned_courses}</span><span>{r.assessment_attempts}</span><span>{r.average_assessment_score??'—'}</span></div>)}</div>}
  </section>
 </section>
}
