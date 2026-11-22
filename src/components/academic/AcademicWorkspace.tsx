import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Award, Compass, Flag, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
type Goal={id:string;title:string;description:string|null;target_date:string|null;status:string}
type Opportunity={id:string;title:string;provider_name:string;opportunity_type:string;description:string|null;source_url:string;application_url:string|null;deadline:string|null;region:string|null}
type Credential={id:string;credential_identifier:string;issuer_name:string;credential_title:string;credential_type:string;issued_at:string;status:string}
type Verified={credential_identifier:string;issuer_name:string;credential_title:string;credential_type:string;issued_at:string;status:string;accreditation_reference:string|null}
export default function AcademicWorkspace({userId,onNotice}:{userId:string;onNotice:(s:string)=>void}){
 const [goals,setGoals]=useState<Goal[]>([])
 const [opportunities,setOpportunities]=useState<Opportunity[]>([])
 const [credentials,setCredentials]=useState<Credential[]>([])
 const [goalTitle,setGoalTitle]=useState('')
 const [goalDate,setGoalDate]=useState('')
 const [credentialQuery,setCredentialQuery]=useState('')
 const [verified,setVerified]=useState<Verified|null>(null)
 const [loading,setLoading]=useState(false)
 async function load(){
  if(!supabase||!userId)return
  setLoading(true)
  const [g,o,c]=await Promise.all([
   supabase.from('learner_learning_goals').select('id,title,description,target_date,status').eq('learner_user_id',userId).order('created_at',{ascending:false}),
   supabase.from('learning_opportunities').select('id,title,provider_name,opportunity_type,description,source_url,application_url,deadline,region').eq('publication_status','published').order('deadline',{ascending:true}).limit(30),
   supabase.from('credentials').select('id,credential_identifier,issuer_name,credential_title,credential_type,issued_at,status').eq('recipient_user_id',userId).order('issued_at',{ascending:false})
  ])
  setLoading(false)
  if(g.error)onNotice('Learning goals: '+g.error.message);else setGoals((g.data??[]) as Goal[])
  if(o.error)onNotice('Opportunity directory: '+o.error.message);else setOpportunities((o.data??[]) as Opportunity[])
  if(c.error)onNotice('Credentials: '+c.error.message);else setCredentials((c.data??[]) as Credential[])
 }
 useEffect(()=>{void load()},[userId])
 async function addGoal(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!supabase||!userId)return
  const {error}=await supabase.from('learner_learning_goals').insert({learner_user_id:userId,title:goalTitle.trim(),target_date:goalDate||null})
  if(error)onNotice('Goal was not saved: '+error.message);else{setGoalTitle('');setGoalDate('');onNotice('Learning goal saved.');await load()}
 }
 async function completeGoal(id:string){
  if(!supabase)return
  const {error}=await supabase.from('learner_learning_goals').update({status:'completed'}).eq('id',id)
  if(error)onNotice('Goal update failed: '+error.message);else await load()
 }
 async function saveOpportunity(id:string){
  if(!supabase||!userId)return
  const {error}=await supabase.from('learner_opportunity_saves').insert({learner_user_id:userId,opportunity_id:id})
  if(error&&!error.message.toLowerCase().includes('duplicate'))onNotice('Opportunity could not be saved: '+error.message);else onNotice('Opportunity saved to your list.')
 }
 async function verify(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!supabase)return
  setVerified(null)
  const {data,error}=await supabase.from('credential_verification_index').select('credential_identifier,issuer_name,credential_title,credential_type,issued_at,status,accreditation_reference').eq('credential_identifier',credentialQuery.trim()).maybeSingle()
  if(error)onNotice('Credential verification unavailable: '+error.message)
  else if(!data)onNotice('No active public credential matches that identifier.')
  else setVerified(data as Verified)
 }
 if(!userId)return <section className="academic-workspace"><div className="page-intro"><p className="eyebrow">ACADEMIC INTELLIGENCE</p><h1>Your learning,<br/><em>over time.</em></h1><p>Sign in to manage goals, opportunities and credentials.</p></div></section>
 return <section className="academic-workspace">
  <div className="page-intro"><p className="eyebrow">ACADEMIC INTELLIGENCE & OPPORTUNITY</p><h1>Your learning,<br/><em>over time.</em></h1><p>Keep meaningful goals, discover verified opportunities and maintain a record of earned credentials.</p></div>
  <div className="academic-grid">
   <section className="studio-panel"><div className="panel-heading"><div><p className="eyebrow">PERSONAL DIRECTION</p><h2>Learning goals</h2></div><Flag size={22}/></div>
    <form className="form-stack builder-form" onSubmit={addGoal}><label>Goal<input required maxLength={180} value={goalTitle} onChange={e=>setGoalTitle(e.target.value)} placeholder="e.g. Master quadratic equations"/></label><label>Target date<input type="date" value={goalDate} onChange={e=>setGoalDate(e.target.value)}/></label><button className="button button-dark">Add learning goal</button></form>
    {goals.length===0?<p className="form-hint">No learning goals yet.</p>:<div className="builder-list">{goals.map(g=><div className="builder-list-item static" key={g.id}><span className="builder-index">{g.status==='completed'?'✓':'GOAL'}</span><span>{g.title}<small>{g.target_date??'No target date'} · {g.status}</small></span>{g.status==='active'&&<button className="text-button" onClick={()=>void completeGoal(g.id)}>Complete</button>}</div>)}</div>}
   </section>
   <section className="studio-panel"><div className="panel-heading"><div><p className="eyebrow">CREDENTIAL RECORD</p><h2>Achievements</h2></div><Award size={22}/></div>
    {credentials.length===0?<p className="form-hint">Verified certificates and credentials issued to your account will appear here. No achievements are fabricated.</p>:<div className="builder-list">{credentials.map(c=><div className="builder-list-item static" key={c.id}><span className="builder-index">CRED</span><span>{c.credential_title}<small>{c.issuer_name} · {c.credential_type.replace('_',' ')} · {c.status}</small><small>{c.credential_identifier}</small></span></div>)}</div>}
    <form className="form-stack builder-form" onSubmit={verify}><label>Verify a credential identifier<input value={credentialQuery} onChange={e=>setCredentialQuery(e.target.value)} placeholder="Enter credential ID"/></label><button className="button button-outline">Verify credential <Search size={14}/></button></form>
    {verified&&<div className="credential-result"><strong>{verified.credential_title}</strong><span>{verified.issuer_name}</span><small>{verified.credential_type.replace('_',' ')} · Issued {new Date(verified.issued_at).toLocaleDateString()}</small><span className="credential-status">Active credential</span>{verified.accreditation_reference&&<small>Accreditation reference: {verified.accreditation_reference}</small>}</div>}
   </section>
  </div>
  <section className="studio-panel opportunity-panel"><div className="panel-heading"><div><p className="eyebrow">OPPORTUNITY DIRECTORY</p><h2>Discover what's next.</h2></div><Compass size={22}/></div>
   {loading?<p className="form-hint">Loading opportunities…</p>:opportunities.length===0?<div className="empty-state"><h3>Verified opportunities will appear here.</h3><p>Scholarships, bursaries and programmes are only published when their source and eligibility information have been checked.</p></div>:<div className="opportunity-list">{opportunities.map(o=><article className="opportunity-row" key={o.id}><div><span className="eyebrow">{o.opportunity_type.replace('_',' ')} · {o.region??'South Africa'}</span><h3>{o.title}</h3><p>{o.provider_name} · {o.description}</p><small>{o.deadline?'Deadline: '+o.deadline:'No published deadline'}</small><a href={o.source_url} target="_blank" rel="noreferrer">Source information</a>{o.application_url&&<a href={o.application_url} target="_blank" rel="noreferrer">Application details</a>}</div><button className="button button-outline" onClick={()=>void saveOpportunity(o.id)}>Save opportunity</button></article>)}</div>}
  </section>
 </section>
}
