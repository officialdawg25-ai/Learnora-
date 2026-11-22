import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ShieldCheck, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
type Relationship={id:string;learner_user_id:string;relationship_type:string;status:string;consent_scopes:string[];created_at:string}
export default function FamilyWorkspace({userId,onNotice}:{userId:string;onNotice:(s:string)=>void}){
 const [learnerId,setLearnerId]=useState('')
 const [relationship,setRelationship]=useState('parent')
 const [evidenceReference,setEvidenceReference]=useState('')
 const [progressConsent,setProgressConsent]=useState(true)
 const [assessmentConsent,setAssessmentConsent]=useState(true)
 const [rows,setRows]=useState<Relationship[]>([])
 const [summary,setSummary]=useState<Record<string,{progress:number;assessments:number}>>({})
 const [busy,setBusy]=useState(false)
 async function load(){
  if(!supabase||!userId)return
  const {data,error}=await supabase.from('guardian_relationships').select('id,learner_user_id,relationship_type,status,consent_scopes,created_at').eq('guardian_user_id',userId).order('created_at',{ascending:false})
  if(error){onNotice('Family access: '+error.message);return}
  const rels=(data??[]) as Relationship[];setRows(rels)
  const active=rels.filter(x=>x.status==='active')
  const counts:Record<string,{progress:number;assessments:number}>={}
  for(const r of active){
   const [p,a]=await Promise.all([
    r.consent_scopes.includes('learning_progress')?supabase.from('learning_progress').select('id',{count:'exact',head:true}).eq('learner_id',r.learner_user_id):Promise.resolve({count:0,error:null}),
    r.consent_scopes.includes('assessment_reports')?supabase.from('assessment_attempts').select('id',{count:'exact',head:true}).eq('learner_id',r.learner_user_id):Promise.resolve({count:0,error:null})
   ])
   counts[r.id]={progress:p.count??0,assessments:a.count??0}
  }
  setSummary(counts)
 }
 useEffect(()=>{void load()},[userId])
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!supabase||!userId)return
  if(!progressConsent&&!assessmentConsent){onNotice('Select at least one requested access scope.');return}
  setBusy(true)
  const {error}=await supabase.from('guardian_relationships').insert({guardian_user_id:userId,learner_user_id:learnerId.trim(),relationship_type:relationship,evidence_reference:evidenceReference.trim()||null,consent_scopes:[...(progressConsent?['learning_progress']:[]),...(assessmentConsent?['assessment_reports']:[])],consent_version:'learnora-guardian-consent-v1-draft',status:'pending'})
  setBusy(false)
  if(error)onNotice('Guardian relationship request was not submitted: '+error.message)
  else{setLearnerId('');setEvidenceReference('');onNotice('Guardian relationship request submitted. Access remains blocked until identity, authority and consent are independently verified.');await load()}
 }
 if(!userId)return <section className="family-workspace"><div className="page-intro"><p className="eyebrow">FAMILY AND GUARDIAN ACCESS</p><h1>Support their<br/><em>next steps.</em></h1><p>Sign in to submit a guardian relationship request.</p></div></section>;
 return <section className="family-workspace">
  <div className="page-intro"><p className="eyebrow">FAMILY AND GUARDIAN ACCESS</p><h1>Support their<br/><em>next steps.</em></h1><p>Guardian access is limited, purpose-based and independently verified before any learner information is disclosed.</p></div>
  <div className="family-grid">
   <section className="studio-panel"><div className="panel-heading"><div><p className="eyebrow">REQUEST ACCESS</p><h2>Connect a learner.</h2></div><ShieldCheck size={22}/></div>
    <form className="form-stack builder-form" onSubmit={submit}>
     <label>Learner's Learnora user ID<input required value={learnerId} onChange={e=>setLearnerId(e.target.value)} placeholder="Learner UUID"/></label>
     <label>Relationship<select value={relationship} onChange={e=>setRelationship(e.target.value)}><option value="parent">Parent</option><option value="legal_guardian">Legal guardian</option><option value="caregiver">Caregiver</option></select></label><label>Independent verification reference (optional)<input value={evidenceReference} onChange={e=>setEvidenceReference(e.target.value)} placeholder="Reference from an approved verification process"/></label>
     <div className="consent-scope"><strong>Requested access scopes</strong><label><input type="checkbox" checked={progressConsent} onChange={e=>setProgressConsent(e.target.checked)}/> Learning progress</label><label><input type="checkbox" checked={assessmentConsent} onChange={e=>setAssessmentConsent(e.target.checked)}/> Assessment reports</label></div>
     <p className="form-hint">This is a draft consent workflow, not legal consent or proof of guardianship. Provide only an external verification case reference, never an ID number or document. No access is granted by submitting this request.</p>
     <button className="button button-dark" disabled={busy||!userId}>Submit verification request</button>
    </form>
   </section>
   <section className="studio-panel"><div className="panel-heading"><div><p className="eyebrow">AUTHORISED RELATIONSHIPS</p><h2>Family connections.</h2></div><Users size={22}/></div>
    {rows.length===0?<p className="form-hint">No guardian relationships have been submitted.</p>:<div className="builder-list">{rows.map(r=><article className="builder-list-item static" key={r.id}><span className="builder-index">{r.status.toUpperCase()}</span><span>{r.relationship_type.replace('_',' ')}<small>Reference: {r.learner_user_id}</small>{r.status==='active'&&<small>{summary[r.id]?.progress??0} progress records · {summary[r.id]?.assessments??0} assessment records in authorised scopes</small>}</span></article>)}</div>}
   </section>
  </div>
 </section>
}
