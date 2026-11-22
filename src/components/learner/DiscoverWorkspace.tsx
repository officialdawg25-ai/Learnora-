import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowRight, BookOpen, Building2, Check, Compass, GraduationCap, Users } from 'lucide-react'
import { supabase, type Course } from '../../lib/supabase'

type Educator={user_id:string;public_display_name:string|null;professional_bio:string|null;subjects:string[];teaching_languages:string[];teaching_levels:string[];public_region:string|null;verification_status:string}
type Institution={organisation_id:string;display_name:string;description:string|null;region:string|null}
type Learner={user_id:string;display_name:string;bio:string|null;subjects:string[];interests:string[];education_level:string|null}
type ConnectionSignal={user_id:string;shared_class_count:number;shared_course_count:number}
type Space={id:string;space_type:'community'|'study_group';title:string;description:string|null;subject:string|null;education_level:string|null}
const parseList=(v:string)=>v.split(',').map(x=>x.trim()).filter(Boolean).slice(0,20)
const overlap=(a:string[],b:string[])=>a.filter(x=>b.some(y=>y.toLowerCase()===x.toLowerCase()))
function Rail({title,description,count,children}:{title:string;description:string;count:number;children:ReactNode}){
 return <section className="discover-rail"><div className="discover-rail-heading"><div><p className="eyebrow">LEARNORA DISCOVERY</p><h2>{title}</h2><p>{description}</p></div><span>{String(count).padStart(2,'0')} RESULTS</span></div>{count?<div className="discover-rail-track">{children}</div>:<div className="discover-empty">Nothing published here yet. Your discovery space will grow as verified educators, institutions and learning communities join Learnora.</div>}</section>
}
export default function DiscoverWorkspace({userId,courses,onEnrol,onNotice}:{userId:string;courses:Course[];onEnrol:(course:Course)=>void;onNotice:(s:string)=>void}){
 const [educators,setEducators]=useState<Educator[]>([]),[institutions,setInstitutions]=useState<Institution[]>([]),[learners,setLearners]=useState<Learner[]>([]),[spaces,setSpaces]=useState<Space[]>([])
 const [own,setOwn]=useState<Learner|null>(null),[connectionSignals,setConnectionSignals]=useState<Record<string,ConnectionSignal>>({}),[search,setSearch]=useState(''),[category,setCategory]=useState('All'),[loading,setLoading]=useState(true)
 const [name,setName]=useState(''),[subjects,setSubjects]=useState(''),[interests,setInterests]=useState(''),[level,setLevel]=useState(''),[bio,setBio]=useState(''),[discoverable,setDiscoverable]=useState(false),[saving,setSaving]=useState(false),[profileOpen,setProfileOpen]=useState(false)
 async function load(){
  if(!supabase||!userId){setLoading(false);return}
  setLoading(true)
  const [e,i,l,s,m,connections]=await Promise.all([
   supabase.from('educator_profiles').select('user_id,public_display_name,professional_bio,subjects,teaching_languages,teaching_levels,public_region,verification_status').eq('public_profile',true).eq('verification_status','verified').limit(24),
   supabase.from('institution_directory_profiles').select('organisation_id,display_name,description,region').eq('public_listing',true).limit(24),
   supabase.from('learner_discovery_profiles').select('user_id,display_name,bio,subjects,interests,education_level').eq('discoverable',true).limit(40),
   supabase.from('learning_spaces').select('id,space_type,title,description,subject,education_level').eq('status','active').eq('visibility','public').limit(40),
   supabase.from('learner_discovery_profiles').select('user_id,display_name,bio,subjects,interests,education_level,discoverable').eq('user_id',userId).maybeSingle(),
   supabase.rpc('discoverable_learning_connections')
  ])
  if(e.error)onNotice('Educator directory is unavailable: '+e.error.message);else setEducators((e.data??[]) as Educator[])
  if(i.error)onNotice('Institution directory is unavailable: '+i.error.message);else setInstitutions((i.data??[]) as Institution[])
  if(l.error)onNotice('Learner discovery is unavailable: '+l.error.message);else setLearners(((l.data??[]) as Learner[]).filter(x=>x.user_id!==userId))
  if(s.error)onNotice('Learning spaces are unavailable: '+s.error.message);else setSpaces((s.data??[]) as Space[])
  if(connections.error)onNotice('Shared class and course recommendations are unavailable: '+connections.error.message);else setConnectionSignals(Object.fromEntries(((connections.data??[]) as ConnectionSignal[]).map(x=>[x.user_id,x])))
  if(m.error)onNotice('Your discovery profile could not be loaded: '+m.error.message)
  else if(m.data){const row=m.data as Learner & {discoverable:boolean};setOwn(row);setName(row.display_name);setSubjects(row.subjects.join(', '));setInterests(row.interests.join(', '));setLevel(row.education_level??'');setBio(row.bio??'');setDiscoverable(row.discoverable)}
  setLoading(false)
 }
 useEffect(()=>{void load()},[userId])
 const query=search.trim().toLowerCase()
 const visibleCourses=useMemo(()=>courses.filter(c=>(category==='All'||category==='Courses')&&[c.title,c.summary,c.subject,c.education_level].join(' ').toLowerCase().includes(query)),[courses,category,query])
 const visibleEducators=useMemo(()=>educators.filter(x=>(category==='All'||category==='Educators')&&[x.public_display_name,x.professional_bio,...x.subjects].join(' ').toLowerCase().includes(query)),[educators,category,query])
 const visibleInstitutions=useMemo(()=>institutions.filter(x=>(category==='All'||category==='Institutions')&&[x.display_name,x.description,x.region].join(' ').toLowerCase().includes(query)),[institutions,category,query])
 const visibleSpaces=useMemo(()=>spaces.filter(x=>(category==='All'||category===(x.space_type==='community'?'Communities':'Study groups'))&&[x.title,x.description,x.subject].join(' ').toLowerCase().includes(query)),[spaces,category,query])
 const recommendedLearners=useMemo(()=>learners.map(x=>({...x,sharedSubjects:overlap(own?.subjects??[],x.subjects),sharedInterests:overlap(own?.interests??[],x.interests),sharedClassCount:connectionSignals[x.user_id]?.shared_class_count??0,sharedCourseCount:connectionSignals[x.user_id]?.shared_course_count??0})).filter(x=>(category==='All'||category==='Learners')&&[x.display_name,x.bio,...x.subjects,...x.interests].join(' ').toLowerCase().includes(query)).sort((a,b)=>(b.sharedClassCount*5+b.sharedCourseCount*4+b.sharedSubjects.length*3+b.sharedInterests.length)-(a.sharedClassCount*5+a.sharedCourseCount*4+a.sharedSubjects.length*3+a.sharedInterests.length)),[learners,own,connectionSignals,category,query])
 async function saveProfile(e:FormEvent){
  e.preventDefault();if(!supabase||!userId||!name.trim())return
  setSaving(true)
  const payload={user_id:userId,display_name:name.trim(),bio:bio.trim()||null,subjects:parseList(subjects),interests:parseList(interests),education_level:level.trim()||null,discoverable}
  const {error}=await supabase.from('learner_discovery_profiles').upsert(payload,{onConflict:'user_id'})
  setSaving(false)
  if(error){onNotice('Discovery profile was not saved: '+error.message);return}
  onNotice('Your discovery preferences have been saved. Learner visibility is limited to adults who explicitly opt in.')
  await load()
 }
 async function joinSpace(id:string){
  if(!supabase)return
  const {error}=await supabase.from('learning_space_memberships').insert({space_id:id,user_id:userId,role:'member',status:'active'})
  if(error&&!error.message.toLowerCase().includes('duplicate'))onNotice('Could not join this learning space: '+error.message)
  else onNotice('You joined the learning space.')
 }
 return <section className="discover-workspace">
  <header className="discover-intro"><div><p className="eyebrow"><span className="eyebrow-line"/>A MORE CONNECTED WAY TO LEARN</p><h1>Find your <em>people.</em><br/>Follow your curiosity.</h1><p>Discover verified educators, learning programmes, institutions and communities shaped around the subjects that matter to you.</p></div><button className="button button-outline" onClick={()=>setProfileOpen(v=>!v)}>{profileOpen?'Close preferences':'Personalise discovery'} <ArrowRight size={14}/></button></header>
  <div className="discover-controls"><div className="discover-search"><Compass size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search educators, courses, subjects, groups…"/></div><div className="discover-filters">{['All','Educators','Institutions','Courses','Communities','Study groups','Learners'].map(x=><button key={x} className={category===x?'selected':''} onClick={()=>setCategory(x)}>{x}</button>)}</div></div>
  {profileOpen&&<form className="discover-profile-editor" onSubmit={saveProfile}><div><p className="eyebrow">YOUR DISCOVERY PROFILE</p><h2>Make meaningful connections.</h2><p>Choose what you share. Learner discovery uses the date of birth on the account as an age screen and requires explicit opt-in. It displays no private academic records or contact details; age is not independently identity-verified.</p></div><label>Display name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="How other learners should see you"/></label><label>Subjects, comma separated<input value={subjects} onChange={e=>setSubjects(e.target.value)} placeholder="Mathematics, Physical Sciences"/></label><label>Learning interests<input value={interests} onChange={e=>setInterests(e.target.value)} placeholder="Exam preparation, coding, entrepreneurship"/></label><label>Education level<input value={level} onChange={e=>setLevel(e.target.value)} placeholder="Grade 12, undergraduate…"/></label><label>Short introduction<textarea rows={3} maxLength={500} value={bio} onChange={e=>setBio(e.target.value)}/></label><label className="discover-optin"><input type="checkbox" checked={discoverable} onChange={e=>setDiscoverable(e.target.checked)}/> Allow my profile to appear in learner discovery (18+ only)</label><button className="button button-dark" disabled={saving}>{saving?'Saving…':'Save discovery preferences'} <Check size={15}/></button></form>}
  {loading&&<p className="discover-empty">Loading your discovery space…</p>}
  {!loading&&<><Rail title="Educators worth learning from" description="Verified educators who have chosen to make their profiles public." count={visibleEducators.length}>{visibleEducators.map(e=><article className="discover-card educator" key={e.user_id}><span className="discover-card-kicker">VERIFIED EDUCATOR</span><div className="discover-card-icon"><GraduationCap/></div><h3>{e.public_display_name||'Learnora educator'}</h3><p>{e.professional_bio||'A verified educator on Learnora.'}</p><div className="discover-tags">{e.subjects.slice(0,3).map(s=><span key={s}>{s}</span>)}</div><small>{[e.teaching_levels.join(', '),e.public_region].filter(Boolean).join(' · ')||'Public educator profile'}</small></article>)}</Rail>
  <Rail title="Institutions and learning organisations" description="Explore organisations that have enabled public discovery." count={visibleInstitutions.length}>{visibleInstitutions.map(i=><article className="discover-card institution" key={i.organisation_id}><span className="discover-card-kicker">PUBLIC INSTITUTION</span><div className="discover-card-icon"><Building2/></div><h3>{i.display_name}</h3><p>{i.description||'Institution profile on Learnora.'}</p><small>{i.region||'South Africa'}</small></article>)}</Rail>
  <Rail title="Programmes to explore" description="Published courses available in the Learnora catalogue." count={visibleCourses.length}>{visibleCourses.map(c=><article className="discover-card course" key={c.id}><span className="discover-card-kicker">{c.subject||'LEARNING'} · {c.education_level||'OPEN LEVEL'}</span><div className="discover-card-icon"><BookOpen/></div><h3>{c.title}</h3><p>{c.summary||'Explore the programme and its learning outcomes.'}</p><small>{c.academies?.name||'Learnora'}</small><button className="text-button" onClick={()=>onEnrol(c)}>View & enrol <ArrowRight size={14}/></button></article>)}</Rail>
  <Rail title="Communities" description="Subject-led spaces for discussion and shared learning." count={visibleSpaces.filter(x=>x.space_type==='community').length}>{visibleSpaces.filter(x=>x.space_type==='community').map(s=><article className="discover-card space" key={s.id}><span className="discover-card-kicker">COMMUNITY</span><div className="discover-card-icon"><Users/></div><h3>{s.title}</h3><p>{s.description||'A learning community.'}</p><small>{s.subject||'Shared learning'}</small><button className="text-button" onClick={()=>void joinSpace(s.id)}>Join community <ArrowRight size={14}/></button></article>)}</Rail>
  <Rail title="Study groups" description="Find peers working towards similar learning goals." count={visibleSpaces.filter(x=>x.space_type==='study_group').length}>{visibleSpaces.filter(x=>x.space_type==='study_group').map(s=><article className="discover-card space" key={s.id}><span className="discover-card-kicker">STUDY GROUP</span><div className="discover-card-icon"><Users/></div><h3>{s.title}</h3><p>{s.description||'A focused study group.'}</p><small>{[s.subject,s.education_level].filter(Boolean).join(' · ')}</small><button className="text-button" onClick={()=>void joinSpace(s.id)}>Join study group <ArrowRight size={14}/></button></article>)}</Rail>
  <Rail title="Learners with shared interests" description="Discover adult learners who have opted into a public learning profile. Shared classes, enrolled courses, subjects and interests are ranked first. Class and course names are never exposed by the matching signal." count={recommendedLearners.length}>{recommendedLearners.map(l=><article className="discover-card learner" key={l.user_id}><span className="discover-card-kicker">LEARNER PROFILE</span><div className="discover-card-icon"><Users/></div><h3>{l.display_name}</h3><p>{l.bio||'A fellow learner building their next chapter.'}</p><div className="discover-tags">{l.sharedSubjects.slice(0,2).map(s=><span key={s}>Shared: {s}</span>)}{l.sharedInterests.slice(0,2).map(s=><span key={s}>{s}</span>)}{l.sharedClassCount>0&&<span>{l.sharedClassCount} shared class{l.sharedClassCount===1?'':'es'}</span>}{l.sharedCourseCount>0&&<span>{l.sharedCourseCount} shared course{l.sharedCourseCount===1?'':'s'}</span>}</div><small>{l.education_level||'Learning together'}</small></article>)}</Rail></>}
 </section>
}
