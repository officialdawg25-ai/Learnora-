import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Clock3, LockKeyhole, ShieldCheck, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Relationship={id:string;guardian_user_id:string;learner_user_id:string;relationship_type:string;status:string;consent_scopes:string[];created_at:string}
type Summary={progress:number;assessments:number}

const mask=(value:string)=>'Learner account ····'+value.slice(-6)
const statusLabel=(status:string)=>status.replaceAll('_',' ')

export default function FamilyWorkspace({userId,onNotice}:{userId:string;onNotice:(s:string)=>void}){
 const [learnerId,setLearnerId]=useState('')
 const [relationship,setRelationship]=useState('parent')
 const [evidenceReference,setEvidenceReference]=useState('')
 const [progressConsent,setProgressConsent]=useState(true)
 const [assessmentConsent,setAssessmentConsent]=useState(true)
 const [outgoing,setOutgoing]=useState<Relationship[]>([])
 const [incoming,setIncoming]=useState<Relationship[]>([])
 const [summary,setSummary]=useState<Record<string,Summary>>({})
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)

 async function load(){
  if(!supabase||!userId){setLoading(false);return}
  setLoading(true)
  const [sent,received]=await Promise.all([
   supabase.from('guardian_relationships').select('id,guardian_user_id,learner_user_id,relationship_type,status,consent_scopes,created_at').eq('guardian_user_id',userId).order('created_at',{ascending:false}),
   supabase.from('guardian_relationships').select('id,guardian_user_id,learner_user_id,relationship_type,status,consent_scopes,created_at').eq('learner_user_id',userId).order('created_at',{ascending:false})
  ])
  if(sent.error)onNotice('Your family connections could not be loaded: '+sent.error.message)
  if(received.error)onNotice('Incoming connection requests could not be loaded: '+received.error.message)
  const sentRows=(sent.data??[]) as Relationship[]
  const receivedRows=(received.data??[]) as Relationship[]
  setOutgoing(sentRows);setIncoming(receivedRows)
  const active=sentRows.filter(x=>x.status==='active')
  const counts:Record<string,Summary>={}
  for(const r of active){
   const [p,a]=await Promise.all([
    r.consent_scopes.includes('learning_progress')?supabase.from('learning_progress').select('id',{count:'exact',head:true}).eq('learner_id',r.learner_user_id):Promise.resolve({count:0,error:null}),
    r.consent_scopes.includes('assessment_reports')?supabase.from('assessment_attempts').select('id',{count:'exact',head:true}).eq('learner_id',r.learner_user_id):Promise.resolve({count:0,error:null})
   ])
   counts[r.id]={progress:p.count??0,assessments:a.count??0}
  }
  setSummary(counts);setLoading(false)
 }
 useEffect(()=>{void load()},[userId])

 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!supabase||!userId)return
  if(!progressConsent&&!assessmentConsent){onNotice('Select at least one requested access scope.');return}
  if(learnerId.trim()===userId){onNotice('You cannot connect your account as your own learner.');return}
  setBusy(true)
  const {error}=await supabase.from('guardian_relationships').insert({
   guardian_user_id:userId,learner_user_id:learnerId.trim(),relationship_type:relationship,
   evidence_reference:evidenceReference.trim()||null,
   consent_scopes:[...(progressConsent?['learning_progress']:[]),...(assessmentConsent?['assessment_reports']:[])],
   consent_version:'learnora-guardian-consent-v1-draft',status:'pending'
  })
  setBusy(false)
  if(error)onNotice('Connection request was not submitted: '+error.message)
  else{setLearnerId('');setEvidenceReference('');onNotice('Request submitted. No learner information is shared while the relationship is pending.');await load()}
 }

 const active=outgoing.filter(x=>x.status==='active')
 const pending=outgoing.filter(x=>x.status==='pending')
 const totalRecords=useMemo(()=>active.reduce((n,r)=>n+(summary[r.id]?.progress??0)+(summary[r.id]?.assessments??0),0),[active,summary])

 if(!userId)return <section className="family-workspace"><div className="page-intro"><p className="eyebrow">PARENT & GUARDIAN PORTAL</p><h1>Be part of<br/><em>their progress.</em></h1><p>Sign in to manage authorised learner connections and academic visibility.</p></div></section>

 return <section className="family-workspace">
  <div className="page-intro family-intro"><p className="eyebrow">PARENT & GUARDIAN PORTAL · LEARNORA 360°</p><h1>Be part of<br/><em>their progress.</em></h1><p>A considered view of the learning journey. Connect learner accounts, understand authorised academic activity and stay involved without compromising privacy.</p></div>
  <div className="family-overview">
   <article><span>CONNECTED LEARNERS</span><strong>{active.length.toString().padStart(2,'0')}</strong><small>Verified active relationships</small></article>
   <article><span>REQUESTS IN REVIEW</span><strong>{pending.length.toString().padStart(2,'0')}</strong><small>Access remains restricted</small></article>
   <article><span>AUTHORISED RECORDS</span><strong>{totalRecords.toString().padStart(2,'0')}</strong><small>Progress and assessment records available within approved scopes</small></article>
  </div>
  <div className="family-grid">
   <section className="studio-panel"><div className="panel-heading"><div><p className="eyebrow">FAMILY CONNECTIONS</p><h2>Connect an existing learner.</h2></div><Users size={22}/></div>
    <p className="family-lead">If your child already has a Learnora account, request a connection to that existing learner identity. Do not create a second account for the same learner.</p>
    <form className="form-stack builder-form" onSubmit={submit}>
     <label>Learner's Learnora account ID<input required value={learnerId} onChange={e=>setLearnerId(e.target.value)} placeholder="Paste the learner account UUID"/></label>
     <label>Your relationship<select value={relationship} onChange={e=>setRelationship(e.target.value)}><option value="parent">Parent</option><option value="legal_guardian">Legal guardian</option><option value="caregiver">Authorised caregiver</option></select></label>
     <label>Independent verification case reference (optional)<input value={evidenceReference} onChange={e=>setEvidenceReference(e.target.value)} placeholder="Reference from an approved verification process"/></label>
     <div className="consent-scope"><strong>Requested access</strong><label><input type="checkbox" checked={progressConsent} onChange={e=>setProgressConsent(e.target.checked)}/> Learning progress</label><label><input type="checkbox" checked={assessmentConsent} onChange={e=>setAssessmentConsent(e.target.checked)}/> Assessment reports</label></div>
     <div className="family-security-note"><LockKeyhole size={17}/><p>Submitting a request does not grant access. Independent authority verification and the required consent checks must be completed before learner records become available.</p></div>
     <button className="button button-dark" disabled={busy||!userId}>{busy?'Submitting request…':'Request secure connection'} <ArrowRight size={15}/></button>
    </form>
   </section>
   <section className="studio-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR LEARNER OVERVIEW</p><h2>Connected accounts.</h2></div><ShieldCheck size={22}/></div>
    {loading?<p className="form-hint">Loading authorised relationships…</p>:outgoing.length===0?<div className="family-empty"><Users size={22}/><strong>Your family space starts here.</strong><p>Once a learner connection has been independently verified, its permitted academic activity will appear in this space.</p></div>:<div className="family-connection-list">{outgoing.map(r=><article className="family-connection" key={r.id}><div className="family-connection-top"><span>{mask(r.learner_user_id)}</span><span className={'relationship-status '+(r.status==='active'?'is-active':'')}>{r.status==='active'?<CheckCircle2 size={13}/>:<Clock3 size={13}/>} {statusLabel(r.status)}</span></div><small>{r.relationship_type.replaceAll('_',' ')} · Requested {new Date(r.created_at).toLocaleDateString()}</small>{r.status==='active'&&<div className="family-record-counts"><span>{summary[r.id]?.progress??0} learning progress records</span><span>{summary[r.id]?.assessments??0} assessment records</span></div>}{r.status==='pending'&&<p className="form-hint">Verification is pending. No learner records are accessible.</p>}</article>)}</div>}
   </section>
  </div>
  <section className="studio-panel incoming-requests"><div className="panel-heading"><div><p className="eyebrow">LEARNER-SIDE VISIBILITY</p><h2>Requests involving this account.</h2></div><ShieldCheck size={22}/></div>
   {incoming.length===0?<p className="form-hint">No guardian connection requests have been made to this learner account.</p>:<div className="family-connection-list">{incoming.map(r=><article className="family-connection" key={r.id}><div className="family-connection-top"><span>Guardian account ····{r.guardian_user_id.slice(-6)}</span><span className="relationship-status"><Clock3 size={13}/>{statusLabel(r.status)}</span></div><small>{r.relationship_type.replaceAll('_',' ')} · {new Date(r.created_at).toLocaleDateString()}</small><p className="form-hint">This request is visible to the learner. Learner self-service approval is not yet enabled; platform verification remains required before any access is granted.</p></article>)}</div>}
  </section>
 </section>
}
