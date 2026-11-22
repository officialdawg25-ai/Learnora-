import { useEffect, useMemo, useState } from 'react'
import { Activity, Bell, BookOpen, CalendarDays, ChevronDown, FileText, GraduationCap, HeartHandshake, LockKeyhole, MessageCircle, Wallet, UserRound, Users, ShieldCheck, ArrowUpRight, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import FamilyWorkspace from './FamilyWorkspace'
import Parent360Workspace from './Parent360Workspace'
import CreateLearnerAccount from './CreateLearnerAccountSecure'
import ParentSettingsWorkspace from './ParentSettingsWorkspace'
import './ParentSettingsWorkspace.css'
import './Parent360Workspace.css'
import './CreateLearnerAccount.css'

type Subject = { course_id:string; title:string; subject:string|null; educator_name:string|null }
type Assessment = { assessment_id:string; title:string; subject:string|null; score:number|null; graded_at:string; feedback:unknown }
type Child = { relationship_id:string; learner_id:string; display_name:string|null; avatar_path:string|null; consent_scopes:string[]; connected_at:string|null; progress:{record_count:number;average_percent:number|null;completed_count:number;subjects:Subject[]}|null; assessments:{record_count:number;average_score:number|null;recent:Assessment[]}|null; grade_label?:string|null; class_label?:string|null; academic_year?:number|null; institution_name?:string|null; attendance_summary?:{total:number;present:number;absent:number;late:number;excused:number}|null; outstanding_minor?:number }
type Notice = {id:string;title:string;body:string;notification_type:string;created_at:string;read_at:string|null}
type ParentProfile = {display_name:string|null;preferred_language:string}
type Tab = 'overview'|'children'|'academics'|'attendance'|'educators'|'messages'|'finance'|'calendar'|'documents'|'notifications'|'profile'|'privacy'|'support'
const tabs:{id:Tab;label:string;icon:typeof Users}[]=[
 {id:'overview',label:'Overview',icon:Activity},{id:'children',label:'My children',icon:Users},
 {id:'academics',label:'Academics',icon:BookOpen},{id:'attendance',label:'Attendance',icon:CalendarDays},
 {id:'educators',label:'Educators',icon:GraduationCap},{id:'messages',label:'Messages',icon:MessageCircle},
 {id:'finance',label:'Financial centre',icon:Wallet},{id:'calendar',label:'Calendar',icon:CalendarDays},
 {id:'documents',label:'Documents & reports',icon:FileText},{id:'notifications',label:'Notifications',icon:Bell},
 {id:'profile',label:'My profile',icon:UserRound},{id:'privacy',label:'Privacy & security',icon:ShieldCheck},
 {id:'support',label:'Help & support',icon:HeartHandshake}
]
const dateLabel=(value:string|null|undefined)=>value?new Date(value).toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'}):'—'
const moneyLabel=(minor:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(minor/100)
function EmptyFeature({title,description}:{title:string;description:string}){return <section className="parent-feature-empty"><div className="parent-empty-icon"><LockKeyhole size={20}/></div><p className="eyebrow">PLATFORM INTEGRATION REQUIRED</p><h2>{title}</h2><p>{description}</p><small>Learnora will only display this information once the relevant institution or platform workflow is configured. No sample or invented records are shown.</small></section>}
export default function ParentPortal({userId,onNotice}:{userId:string;onNotice:(message:string)=>void}){
 const [tab,setTab]=useState<Tab>('overview'),[children,setChildren]=useState<Child[]>([]),[selectedId,setSelectedId]=useState(''),[notifications,setNotifications]=useState<Notice[]>([]),[profile,setProfile]=useState<ParentProfile>({display_name:'',preferred_language:'en'}),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const selected=children.find(child=>child.learner_id===selectedId)??children[0]??null
 const unread=notifications.filter(item=>!item.read_at).length
 const parentName=profile.display_name?.trim()||'Parent'
 async function load(){
  const client=supabase;if(!client||!userId){setLoading(false);return}
  setLoading(true);setError('')
  const [snapshot,profileResult,notificationResult]=await Promise.all([
   client.rpc('guardian_portal_snapshot'),
   client.from('profiles').select('display_name,preferred_language').eq('id',userId).maybeSingle(),
   client.from('user_notifications').select('id,title,body,notification_type,created_at,read_at').eq('recipient_user_id',userId).order('created_at',{ascending:false}).limit(30)
  ])
  if(snapshot.error){setError(snapshot.error.message);setChildren([])}
  else{const rows=((snapshot.data as {children?:Child[]}|null)?.children??[]) as Child[];const enriched=await Promise.all(rows.map(async row=>{const {data,error}=await client.rpc('guardian_parent_workspace',{p_learner_id:row.learner_id});if(error||!data)return row;const invoices=(data.invoices??[]) as {balance_minor:number}[];return {...row,grade_label:data.learner?.grade_label??null,class_label:data.learner?.class_label??null,academic_year:data.learner?.academic_year??null,institution_name:data.institution?.name??null,attendance_summary:data.attendance_summary??null,outstanding_minor:invoices.reduce((sum,item)=>sum+Number(item.balance_minor||0),0)}}));setChildren(enriched);setSelectedId(current=>enriched.some(row=>row.learner_id===current)?current:enriched[0]?.learner_id??'')}
  if(profileResult.error)onNotice('Your profile could not be loaded: '+profileResult.error.message)
  else if(profileResult.data)setProfile({display_name:profileResult.data.display_name??'',preferred_language:profileResult.data.preferred_language??'en'})
  if(notificationResult.error)onNotice('Notifications could not be loaded: '+notificationResult.error.message)
  else setNotifications((notificationResult.data??[]) as Notice[])
  setLoading(false)
 }
 useEffect(()=>{void load()},[userId])

 async function markRead(id:string){if(!supabase)return;const {error}=await supabase.rpc('mark_user_notification_read',{p_notification_id:id});if(error){onNotice('Notification could not be updated: '+error.message);return}setNotifications(rows=>rows.map(item=>item.id===id?{...item,read_at:new Date().toISOString()}:item))}
 const academicSummary=useMemo(()=>({progress:children.reduce((sum,child)=>sum+(child.progress?.record_count??0),0),assessments:children.reduce((sum,child)=>sum+(child.assessments?.record_count??0),0),outstanding:children.reduce((sum,child)=>sum+(child.outstanding_minor??0),0),attendance:children.reduce((sum,child)=>sum+(child.attendance_summary?.total??0),0),present:children.reduce((sum,child)=>sum+(child.attendance_summary?.present??0),0)}),[children])
 if(!supabase)return <div className="parent-portal"><EmptyFeature title="Connect Learnora" description="The secure Learnora data connection is not configured in this environment."/></div>
 return <section className="parent-portal">
  <header className="parent-hero"><div><p className="eyebrow">LEARNORA · PARENT & FAMILY</p><h1>Stay close to <em>their progress.</em></h1><p>Your family's learning, relationships and important updates — brought together in one secure place.</p></div><div className="parent-hero-actions"><span><ShieldCheck size={15}/> Verified access only</span><button className="button button-outline small" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button></div></header>
  <nav className="parent-tabs" aria-label="Parent portal sections">{tabs.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} className={tab===item.id?'selected':''} onClick={()=>setTab(item.id)}><Icon size={15}/>{item.label}{item.id==='notifications'&&unread>0?<span className="parent-tab-count">{unread}</span>:null}</button>})}</nav>
  {!loading&&children.length>0&&tab!=='children'&&tab!=='overview'&&<label className="parent-child-select parent-global-child"><span>FAMILY MEMBER</span><select value={selected?.learner_id??''} onChange={e=>setSelectedId(e.target.value)}>{children.map(child=><option key={child.learner_id} value={child.learner_id}>{child.display_name||'Learner account'}</option>)}</select></label>}
  {error&&<div className="parent-inline-error" role="alert"><strong>Family information could not be loaded.</strong><span>{error}</span><small>Only independently verified relationships are returned. Try refreshing or contact Learnora support if this continues.</small></div>}
  {loading?<div className="parent-loading"><span className="parent-spinner"/><p>Loading your family workspace…</p></div>:null}
  {!loading&&tab==='overview'&&<>
   <div className="parent-welcome"><div><span className="eyebrow">YOUR FAMILY WORKSPACE</span><h2>Welcome back, {parentName}.</h2><p>{children.length?'You are connected to '+children.length+' learner '+(children.length===1?'account.':'accounts.'):'Connect a learner account to begin seeing their learning journey here.'}</p></div><button className="button button-dark small" onClick={()=>setTab('children')}>Manage children <ArrowUpRight size={14}/></button></div>
   <div className="parent-metrics"><article><span>CONNECTED LEARNERS</span><strong>{children.length.toString().padStart(2,'0')}</strong><small>Verified family relationships</small></article><article><span>LEARNING RECORDS</span><strong>{academicSummary.progress.toString().padStart(2,'0')}</strong><small>Learner-approved access</small></article><article><span>ASSESSED RESULTS</span><strong>{academicSummary.assessments.toString().padStart(2,'0')}</strong><small>Graded records</small></article><article><span>ATTENDANCE RECORDS</span><strong>{academicSummary.attendance.toString().padStart(2,'0')}</strong><small>{academicSummary.present} recorded present</small></article><article><span>FAMILY BALANCE</span><strong>{moneyLabel(academicSummary.outstanding)}</strong><small>Verified invoice balances</small></article><article><span>UNREAD UPDATES</span><strong>{unread.toString().padStart(2,'0')}</strong><small>Parent account notifications</small></article></div>
   <div className="parent-section-heading"><div><p className="eyebrow">FAMILY OVERVIEW</p><h2>Connected learners.</h2></div><button className="text-button" onClick={()=>setTab('children')}>Manage connections <ArrowUpRight size={14}/></button></div>
   {children.length===0?<div className="parent-empty-state"><Users size={23}/><h3>Your family space starts here.</h3><p>Connect to a learner using their invitation code. The learner must acknowledge the request and Learnora must independently verify guardian authority before academic information is available.</p><button className="button button-dark" onClick={()=>setTab('children')}>Connect a learner <ArrowUpRight size={14}/></button></div>:<div className="parent-child-grid">{children.map(child=><button type="button" className={'parent-child-card '+(selected?.learner_id===child.learner_id?'active':'')} key={child.learner_id} onClick={()=>{setSelectedId(child.learner_id);setTab('academics')}}><span className="parent-child-avatar">{child.display_name?.slice(0,1).toUpperCase()||'L'}</span><span className="parent-child-copy"><strong>{child.display_name||'Learner account'}</strong><small>{child.grade_label||'Grade not listed'}{child.class_label?' · '+child.class_label:''} · {child.institution_name||'Institution not listed'}</small><small>{child.progress?.record_count??0} learning records · {child.assessments?.record_count??0} graded assessments</small><small>{child.attendance_summary?child.attendance_summary.present+' present of '+child.attendance_summary.total+' attendance records':'Attendance not published'} · {moneyLabel(child.outstanding_minor??0)} outstanding</small></span><ChevronDown size={16}/></button>)}</div>}
   <div className="parent-bottom-grid"><article><div><p className="eyebrow">ACADEMIC VISIBILITY</p><h3>Information shared with your family.</h3><p>Academic details are shown only when the learner has approved the relevant access and the guardian relationship has passed independent verification.</p></div><ShieldCheck size={22}/></article><article><div><p className="eyebrow">NEXT STEP</p><h3>Keep the conversation open.</h3><p>Use the family connection area to manage invitations, review access status and revoke a connection when needed.</p></div><Users size={22}/></article></div>
  </>}
  {!loading&&tab==='children'&&<><div className="parent-section-heading"><div><p className="eyebrow">FAMILY MANAGEMENT</p><h2>Children & connected accounts.</h2></div></div><CreateLearnerAccount onNotice={onNotice} onCreated={()=>void load()}/><FamilyWorkspace userId={userId} onNotice={onNotice} mode="guardian"/></>}
  {!loading&&tab==='academics'&&<section className="parent-academics"><div className="parent-section-heading"><div><p className="eyebrow">ACADEMIC INTELLIGENCE</p><h2>Learning and assessment overview.</h2></div>{children.length>0&&<label className="parent-child-select"><span>LEARNER</span><select value={selected?.learner_id??''} onChange={e=>setSelectedId(e.target.value)}>{children.map(child=><option key={child.learner_id} value={child.learner_id}>{child.display_name||'Learner account'}</option>)}</select></label>}</div>
   {!selected?<div className="parent-empty-state"><BookOpen size={22}/><h3>No verified learner yet.</h3><p>Connect a learner and complete the verification process to view authorised academic records.</p></div>:<>
    <div className="parent-metrics compact"><article><span>LEARNING RECORDS</span><strong>{selected.progress?.record_count??'—'}</strong><small>Within approved scope</small></article><article><span>AVERAGE PROGRESS</span><strong>{selected.progress?.average_percent==null?'—':String(selected.progress.average_percent)+'%'}</strong><small>Recorded learning activity</small></article><article><span>GRADED ASSESSMENTS</span><strong>{selected.assessments?.record_count??'—'}</strong><small>Graded results</small></article><article><span>AVERAGE SCORE</span><strong>{selected.assessments?.average_score==null?'—':String(selected.assessments.average_score)+'%'}</strong><small>Where data is available</small></article></div>
    <div className="parent-data-grid"><section className="studio-panel"><div className="panel-heading"><div><p className="eyebrow">SUBJECTS & COURSES</p><h2>Learning areas.</h2></div><BookOpen size={20}/></div>{selected.progress?.subjects?.length?<div className="parent-subject-list">{selected.progress.subjects.map(subject=><article key={subject.course_id}><div><strong>{subject.subject||subject.title}</strong><small>{subject.title}</small></div><span>{subject.educator_name||'Educator not listed'}</span></article>)}</div>:<p className="parent-muted">No subject/course records are available within the learner-approved progress scope yet.</p>}</section>
     <section className="studio-panel"><div className="panel-heading"><div><p className="eyebrow">RECENT ASSESSMENTS</p><h2>Published results.</h2></div><FileText size={20}/></div>{selected.assessments?.recent?.length?<div className="parent-assessment-list">{selected.assessments.recent.map(item=><article key={item.assessment_id}><div><strong>{item.title}</strong><small>{item.subject||'Assessment'} · {dateLabel(item.graded_at)}</small></div><b>{item.score==null?'—':String(item.score)+'%'}</b></article>)}</div>:<p className="parent-muted">No graded assessment results are available within the learner-approved assessment scope yet.</p>}</section></div>
   </>}</section>}
  {!loading&&tab==='notifications'&&<section><div className="parent-section-heading"><div><p className="eyebrow">PARENT UPDATES</p><h2>Notifications.</h2></div></div>{notifications.length===0?<div className="parent-empty-state"><Bell size={22}/><h3>You're up to date.</h3><p>New notices and platform updates addressed to your account will appear here.</p></div>:<div className="parent-notification-list">{notifications.map(item=><article key={item.id} className={item.read_at?'read':''}><div><span>{item.notification_type.replaceAll('_',' ')}</span><strong>{item.title}</strong><p>{item.body}</p><small>{dateLabel(item.created_at)}</small></div>{!item.read_at&&<button className="text-button" onClick={()=>void markRead(item.id)}>Mark as read</button>}</article>)}</div>}</section>}
  {!loading&&tab==='profile'&&<ParentSettingsWorkspace userId={userId} tab="profile" onNotice={onNotice}/>}
  {!loading&&tab==='privacy'&&<ParentSettingsWorkspace userId={userId} tab="privacy" onNotice={onNotice}/>}
  {!loading&&tab==='attendance'&&<Parent360Workspace tab="attendance" userId={userId} learnerId={selected?.learner_id??''} onNotice={onNotice}/>}
  {!loading&&tab==='educators'&&<Parent360Workspace tab="educators" userId={userId} learnerId={selected?.learner_id??''} onNotice={onNotice}/>}
  {!loading&&tab==='messages'&&<Parent360Workspace tab="messages" userId={userId} learnerId={selected?.learner_id??''} onNotice={onNotice}/>}
  {!loading&&tab==='finance'&&<Parent360Workspace tab="finance" userId={userId} learnerId={selected?.learner_id??''} onNotice={onNotice}/>}
  {!loading&&tab==='calendar'&&<Parent360Workspace tab="calendar" userId={userId} learnerId={selected?.learner_id??''} onNotice={onNotice}/>}
  {!loading&&tab==='documents'&&<Parent360Workspace tab="documents" userId={userId} learnerId={selected?.learner_id??''} onNotice={onNotice}/>}
  {!loading&&tab==='support'&&<Parent360Workspace tab="support" userId={userId} learnerId={selected?.learner_id??''} onNotice={onNotice}/>}
 </section>
}
