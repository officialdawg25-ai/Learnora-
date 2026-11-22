import { useEffect, useState } from 'react'
import { ShieldCheck, CheckCircle2, XCircle, FileSearch, Building2, GraduationCap, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
type QueueItem=Record<string,any>
type Dashboard={educator_verifications:QueueItem[];publication_reviews:QueueItem[];guardian_requests:QueueItem[];institutions:QueueItem[];refunds:QueueItem[];safeguarding_cases:QueueItem[];competency_evidence:QueueItem[];opportunities:QueueItem[]}
const empty:Dashboard={educator_verifications:[],publication_reviews:[],guardian_requests:[],institutions:[],refunds:[],safeguarding_cases:[],competency_evidence:[],opportunities:[]}
export default function PlatformAdminWorkspace({onNotice}:{onNotice:(s:string)=>void}){
 const [dashboard,setDashboard]=useState<Dashboard>(empty)
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState('')
 const [denied,setDenied]=useState(false)
 async function load(){
  if(!supabase)return
  setLoading(true);setDenied(false)
  const {data,error}=await supabase.functions.invoke('learnora-admin',{body:{action:'dashboard'}})
  setLoading(false)
  if(error||data?.error){setDenied(true);onNotice(data?.error||error?.message||'Platform administration is unavailable.');return}
  setDashboard(data.dashboard??empty)
 }
 useEffect(()=>{void load()},[])
 async function act(key:string,payload:Record<string,unknown>){
  if(!supabase)return
  setBusy(key)
  const {data,error}=await supabase.functions.invoke('learnora-admin',{body:payload})
  setBusy('')
  if(error||!data?.success){onNotice(data?.error||error?.message||'Administrative action failed.');return}
  onNotice('Administrative decision recorded.');await load()
 }
 const count=Object.values(dashboard).reduce((n,x)=>n+x.length,0)
 const Action=({label,action,disabled=false}:{label:string;action:()=>void;disabled?:boolean})=><button className="button button-outline admin-action" disabled={disabled||!!busy} onClick={action}>{label}</button>
 if(denied)return <section className="admin-workspace"><div className="page-intro"><p className="eyebrow">PLATFORM GOVERNANCE</p><h1>Trusted<br/><em>operations.</em></h1><p>This account is not assigned an active Learnora platform-administration permission. Access cannot be self-assigned.</p></div></section>
 return <section className="admin-workspace">
  <div className="page-intro"><p className="eyebrow">LEARNORA PLATFORM GOVERNANCE</p><h1>Trust is<br/><em>operational.</em></h1><p>Review educator credentials, course publication, guardian relationships, institutions, finance requests and academic evidence.</p></div>
  <div className="admin-summary"><div><strong>{count}</strong><span>Pending review items visible to your permissions</span></div><button className="button button-outline" onClick={()=>void load()} disabled={loading}>Refresh queues</button></div>
  {loading?<p className="form-hint">Loading authorised review queues…</p>:<>
   <section className="studio-panel admin-queue"><div className="panel-heading"><div><p className="eyebrow">EDUCATOR GOVERNANCE</p><h2>Credential verification</h2></div><ShieldCheck size={22}/></div>
    {dashboard.educator_verifications.length===0?<p className="form-hint">No educator verification submissions are pending.</p>:dashboard.educator_verifications.map(x=><article className="admin-row" key={x.id}><div><strong>{x.credential_type.replace('_',' ')}</strong><small>Educator {x.educator_user_id} · {x.issuer??'Issuer not provided'}</small>{x.evidence_url&&<a href={x.evidence_url} target="_blank" rel="noreferrer">Open private evidence (120-second link)</a>}</div><div className="admin-actions"><Action label="Verify" action={()=>void act(x.id,{action:'educator_verification',submission_id:x.id,decision:'verified'})}/><Action label="More info" action={()=>void act(x.id,{action:'educator_verification',submission_id:x.id,decision:'more_information_required',notes:'Additional evidence or clarification required.'})}/><Action label="Reject" action={()=>void act(x.id,{action:'educator_verification',submission_id:x.id,decision:'rejected'})}/></div></article>)}
   </section>
   <section className="studio-panel admin-queue"><div className="panel-heading"><div><p className="eyebrow">ACADEMIC QUALITY</p><h2>Course publication review</h2></div><FileSearch size={22}/></div>
    {dashboard.publication_reviews.length===0?<p className="form-hint">No courses are awaiting publication review.</p>:dashboard.publication_reviews.map(x=><article className="admin-row" key={x.id}><div><strong>{x.courses?.title??'Course awaiting review'}</strong><small>Course {x.course_id} · Requested by {x.requested_by}</small></div><div className="admin-actions"><Action label="Approve" action={()=>void act(x.id,{action:'publication_review',review_id:x.id,decision:'approved'})}/><Action label="Changes" action={()=>void act(x.id,{action:'publication_review',review_id:x.id,decision:'changes_requested',notes:'Please address the review feedback before resubmission.'})}/><Action label="Reject" action={()=>void act(x.id,{action:'publication_review',review_id:x.id,decision:'rejected'})}/></div></article>)}
   </section>
   <section className="studio-panel admin-queue"><div className="panel-heading"><div><p className="eyebrow">CHILD SAFEGUARDING</p><h2>Guardian relationship review</h2></div><UsersIcon/></div>
    {dashboard.guardian_requests.length===0?<p className="form-hint">No guardian requests are pending.</p>:dashboard.guardian_requests.map(x=><article className="admin-row" key={x.id}><div><strong>{x.relationship_type.replace('_',' ')}</strong><small>Guardian {x.guardian_user_id} · Learner {x.learner_user_id}</small><small>Consent {x.consent_version} · Evidence reference {x.evidence_reference??'not supplied'}</small></div><div className="admin-actions"><Action label="Activate" disabled={!x.evidence_reference||String(x.consent_version).includes('draft')} action={()=>void act(x.id,{action:'guardian_review',relationship_id:x.id,decision:'active'})}/><Action label="Reject" action={()=>void act(x.id,{action:'guardian_review',relationship_id:x.id,decision:'rejected'})}/></div></article>)}
    <p className="form-hint">Activation requires an independently verified authority reference and the exact approved consent version configured server-side.</p>
   </section>
   <section className="studio-panel admin-queue"><div className="panel-heading"><div><p className="eyebrow">INSTITUTIONAL TRUST</p><h2>Institution verification</h2></div><Building2 size={22}/></div>
    {dashboard.institutions.length===0?<p className="form-hint">No institutions are pending verification.</p>:dashboard.institutions.map(x=><article className="admin-row" key={x.id}><div><strong>{x.name}</strong><small>{x.organisation_type} · Submitted by {x.created_by}</small></div><div className="admin-actions"><Action label="Activate" action={()=>void act(x.id,{action:'institution_verification',organisation_id:x.id,decision:'active'})}/><Action label="Suspend" action={()=>void act(x.id,{action:'institution_verification',organisation_id:x.id,decision:'suspended'})}/></div></article>)}
   </section>
   <section className="studio-panel admin-queue"><div className="panel-heading"><div><p className="eyebrow">FINANCIAL GOVERNANCE</p><h2>Refund requests</h2></div><AlertTriangle size={22}/></div>
    {dashboard.refunds.length===0?<p className="form-hint">No refund requests are pending.</p>:dashboard.refunds.map(x=><article className="admin-row" key={x.id}><div><strong>{(x.amount_minor/100).toFixed(2)} {x.currency}</strong><small>{x.reason}</small><small>Order {x.order_id}</small></div><div className="admin-actions"><Action label="Approve request" action={()=>void act(x.id,{action:'refund_approve',refund_id:x.id})}/></div></article>)}
    <p className="form-hint">Approval is not a provider refund. Finance must execute and confirm the refund before marking it completed.</p>
   </section>
   <section className="studio-panel admin-queue"><div className="panel-heading"><div><p className="eyebrow">ACADEMIC EVIDENCE</p><h2>Competency evidence</h2></div><GraduationCap size={22}/></div>
    {dashboard.competency_evidence.length===0?<p className="form-hint">No competency evidence is awaiting review.</p>:dashboard.competency_evidence.map(x=><article className="admin-row" key={x.id}><div><strong>{x.evidence_type.replace('_',' ')}</strong><small>Learner {x.learner_user_id} · Competency {x.competency_id}</small></div><div className="admin-actions"><Action label="Verify evidence" action={()=>void act(x.id,{action:'competency_evidence_review',evidence_id:x.id,decision:'verified'})}/><Action label="Reject" action={()=>void act(x.id,{action:'competency_evidence_review',evidence_id:x.id,decision:'rejected'})}/></div></article>)}
   </section>
   <section className="studio-panel admin-queue"><div className="panel-heading"><div><p className="eyebrow">OPPORTUNITY QUALITY</p><h2>Opportunity publication</h2></div><CheckCircle2 size={22}/></div>
    {dashboard.opportunities.length===0?<p className="form-hint">No opportunities are awaiting publication.</p>:dashboard.opportunities.map(x=><article className="admin-row" key={x.id}><div><strong>{x.title}</strong><small>{x.provider_name} · {x.verification_source}</small><a href={x.source_url} target="_blank" rel="noreferrer">Review source</a></div><div className="admin-actions"><Action label="Publish" action={()=>void act(x.id,{action:'opportunity_publish',opportunity_id:x.id})}/></div></article>)}
   </section>
   <section className="studio-panel admin-queue"><div className="panel-heading"><div><p className="eyebrow">TRUST AND SAFETY</p><h2>Safeguarding cases</h2></div><AlertTriangle size={22}/></div>
    {dashboard.safeguarding_cases.length===0?<p className="form-hint">No open safeguarding cases are assigned to this permission set.</p>:dashboard.safeguarding_cases.map(x=><article className="admin-row" key={x.id}><div><strong>{x.category.replace('_',' ')} · {x.severity}</strong><small>{x.description}</small></div><div className="admin-actions"><Action label="Triage" action={()=>void act(x.id,{action:'safeguarding_case',case_id:x.id,status:'triage'})}/><Action label="Investigate" action={()=>void act(x.id,{action:'safeguarding_case',case_id:x.id,status:'investigating'})}/><Action label="Resolve" action={()=>void act(x.id,{action:'safeguarding_case',case_id:x.id,status:'resolved',notes:'Resolved by authorised safeguarding reviewer.'})}/></div></article>)}
   </section>
  </>}
 </section>
}
function UsersIcon(){return <ShieldCheck size={22}/>}
