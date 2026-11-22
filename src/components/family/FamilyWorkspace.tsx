import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Clock3, Copy, KeyRound, LockKeyhole, ShieldCheck, Users, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Relationship={
 id:string;guardian_user_id:string;learner_user_id:string;relationship_type:string;status:string;
 consent_scopes:string[];consent_version:string;created_at:string;learner_consent_status:string;
 learner_consent_at:string|null;learner_consent_version:string|null;revoked_at:string|null
}
type Invite={id:string;consent_scopes:string[];expires_at:string;redeemed_at:string|null;revoked_at:string|null;created_at:string}
type Summary={progress:number;assessments:number}
type NewCode={code:string;inviteId:string;expiresAt:string}
type UserNotification={id:string;notification_type:string;title:string;body:string;created_at:string;read_at:string|null;resource_id:string}

const GUARDIAN_CONSENT_VERSION='learnora-guardian-connection-v1'
const LEARNER_CONSENT_VERSION='learnora-learner-connection-v1'
const mask=(value:string)=>'Account ····'+value.slice(-6)
const statusLabel=(status:string)=>status.replaceAll('_',' ')
const scopeLabel=(scope:string)=>scope==='learning_progress'?'Learning progress':'Assessment reports'

function makeInviteCode(){
 const bytes=crypto.getRandomValues(new Uint8Array(24))
 return 'LRN-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase()
}
async function hashInviteCode(code:string){
 const normalized=code.trim().toUpperCase()
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized))
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
}

export default function FamilyWorkspace({userId,onNotice}:{userId:string;onNotice:(s:string)=>void}){
 const [connectionMode,setConnectionMode]=useState<'account'|'code'>('code')
 const [learnerId,setLearnerId]=useState('')
 const [inviteCode,setInviteCode]=useState('')
 const [relationship,setRelationship]=useState('parent')
 const [evidenceReference,setEvidenceReference]=useState('')
 const [progressScope,setProgressScope]=useState(true)
 const [assessmentScope,setAssessmentScope]=useState(true)
 const [guardianAcknowledged,setGuardianAcknowledged]=useState(false)
 const [learnerInviteProgress,setLearnerInviteProgress]=useState(true)
 const [learnerInviteAssessments,setLearnerInviteAssessments]=useState(true)
 const [learnerAcknowledgements,setLearnerAcknowledgements]=useState<Record<string,boolean>>({})
 const [outgoing,setOutgoing]=useState<Relationship[]>([])
 const [incoming,setIncoming]=useState<Relationship[]>([])
 const [invites,setInvites]=useState<Invite[]>([])
 const [notifications,setNotifications]=useState<UserNotification[]>([])
 const [summary,setSummary]=useState<Record<string,Summary>>({})
 const [newCode,setNewCode]=useState<NewCode|null>(null)
 const [busy,setBusy]=useState('')
 const [loading,setLoading]=useState(true)

 async function load(){
  if(!supabase||!userId){setLoading(false);return}
  setLoading(true)
  const [sent,received,issued,notificationsResult]=await Promise.all([
   supabase.from('guardian_relationships').select('id,guardian_user_id,learner_user_id,relationship_type,status,consent_scopes,consent_version,created_at,learner_consent_status,learner_consent_at,learner_consent_version,revoked_at').eq('guardian_user_id',userId).order('created_at',{ascending:false}),
   supabase.from('guardian_relationships').select('id,guardian_user_id,learner_user_id,relationship_type,status,consent_scopes,consent_version,created_at,learner_consent_status,learner_consent_at,learner_consent_version,revoked_at').eq('learner_user_id',userId).order('created_at',{ascending:false}),
   supabase.from('guardian_connection_invites').select('id,consent_scopes,expires_at,redeemed_at,revoked_at,created_at').eq('learner_user_id',userId).order('created_at',{ascending:false}).limit(10),
   supabase.from('user_notifications').select('id,notification_type,title,body,created_at,read_at,resource_id').eq('recipient_user_id',userId).order('created_at',{ascending:false}).limit(8)
  ])
  if(sent.error)onNotice('Your outgoing family connections could not be loaded: '+sent.error.message)
  if(received.error)onNotice('Incoming connection requests could not be loaded: '+received.error.message)
  if(issued.error)onNotice('Your learner invitations could not be loaded: '+issued.error.message)
  if(notificationsResult.error)onNotice('Your notifications could not be loaded: '+notificationsResult.error.message)
  const sentRows=(sent.data??[]) as Relationship[]
  const receivedRows=(received.data??[]) as Relationship[]
  setOutgoing(sentRows);setIncoming(receivedRows);setInvites((issued.data??[]) as Invite[]);setNotifications((notificationsResult.data??[]) as UserNotification[])
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

 async function submitParentRequest(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!supabase||!userId)return
  if(!guardianAcknowledged){onNotice('Please acknowledge the guardian access and verification terms.');return}
  if(connectionMode==='account'&&!learnerId.trim()){onNotice('Enter the learner account ID.');return}
  if(connectionMode==='code'&&!inviteCode.trim()){onNotice('Enter the learner-issued invitation code.');return}
  const scopes=[...(progressScope?['learning_progress']:[]),...(assessmentScope?['assessment_reports']:[])]
  if(connectionMode==='account'&&scopes.length===0){onNotice('Select at least one requested access scope.');return}
  setBusy('parent-request')
  let error: {message:string}|null=null
  if(connectionMode==='account'){
   const result=await supabase.rpc('request_guardian_connection',{
    p_learner_user_id:learnerId.trim(),p_relationship_type:relationship,p_consent_scopes:scopes,
    p_evidence_reference:evidenceReference.trim()||null,p_consent_version:GUARDIAN_CONSENT_VERSION
   })
   error=result.error
  }else{
   try{
    const tokenHash=await hashInviteCode(inviteCode)
    const result=await supabase.rpc('redeem_guardian_connection_invite',{
     p_token_hash:tokenHash,p_relationship_type:relationship,
     p_evidence_reference:evidenceReference.trim()||null,p_consent_version:GUARDIAN_CONSENT_VERSION
    })
    error=result.error
   }catch(e){error={message:e instanceof Error?e.message:'Invitation could not be processed.'}}
  }
  setBusy('')
  if(error){onNotice('Connection request was not submitted: '+error.message);return}
  setLearnerId('');setInviteCode('');setEvidenceReference('');setGuardianAcknowledged(false)
  onNotice('Connection request submitted. The learner must respond, and Learnora must independently verify guardian authority before any academic access is enabled.')
  await load()
 }

 async function issueLearnerInvite(){
  if(!supabase||!userId)return
  const scopes=[...(learnerInviteProgress?['learning_progress']:[]),...(learnerInviteAssessments?['assessment_reports']:[])]
  if(!scopes.length){onNotice('Choose at least one information category for this invitation.');return}
  setBusy('issue-invite')
  try{
   const code=makeInviteCode()
   const tokenHash=await hashInviteCode(code)
   const {data,error}=await supabase.rpc('create_guardian_connection_invite',{p_token_hash:tokenHash,p_consent_scopes:scopes})
   setBusy('')
   if(error){onNotice('Invitation could not be created: '+error.message);return}
   setNewCode({code,inviteId:data.invite_id,expiresAt:data.expires_at})
   onNotice('Invitation created. Copy the code now; it is only shown once.')
   await load()
  }catch(e){setBusy('');onNotice(e instanceof Error?e.message:'Invitation could not be created.')}
 }

 async function respondToRequest(id:string,decision:'approve'|'decline'){
  if(!supabase)return
  if(decision==='approve'&&!learnerAcknowledgements[id]){onNotice('Please confirm that you understand the requested access before approving.');return}
  setBusy('response-'+id)
  const {error}=await supabase.rpc('respond_guardian_connection',{
   p_relationship_id:id,p_decision:decision,p_consent_version:LEARNER_CONSENT_VERSION
  })
  setBusy('')
  if(error){onNotice('Your response could not be saved: '+error.message);return}
  onNotice(decision==='approve'
   ?'Your acknowledgement has been recorded. This does not activate access; independent guardian-authority verification is still required.'
   :'You declined this connection request. No parent access has been granted.')
  setLearnerAcknowledgements(v=>({...v,[id]:false}))
  await load()
 }

 async function revokeRelationship(id:string){
  if(!supabase)return
  if(!window.confirm('Revoke this family connection? The associated parent access will stop immediately.'))return
  setBusy('revoke-'+id)
  const {error}=await supabase.rpc('revoke_guardian_connection',{p_relationship_id:id})
  setBusy('')
  if(error){onNotice('The connection could not be revoked: '+error.message);return}
  onNotice('The connection has been revoked. Guardian access is no longer active.')
  await load()
 }

 async function markNotificationRead(id:string){
  if(!supabase)return
  const {error}=await supabase.rpc('mark_user_notification_read',{p_notification_id:id})
  if(error){onNotice('Notification could not be marked as read: '+error.message);return}
  setNotifications(rows=>rows.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n))
 }

 async function revokeInvite(id:string){
  if(!supabase)return
  setBusy('revoke-invite-'+id)
  const {error}=await supabase.rpc('revoke_guardian_connection_invite',{p_invite_id:id})
  setBusy('')
  if(error){onNotice('The invitation could not be revoked: '+error.message);return}
  if(newCode?.inviteId===id)setNewCode(null)
  onNotice('Invitation revoked.')
  await load()
 }

 async function copyCode(){
  if(!newCode)return
  try{await navigator.clipboard.writeText(newCode.code);onNotice('Invitation code copied. Share it privately with the intended guardian.')}
  catch{onNotice('Clipboard access is unavailable. Select and copy the invitation code manually.')}
 }

 const active=outgoing.filter(x=>x.status==='active')
 const pending=outgoing.filter(x=>x.status==='pending')
 const totalRecords=useMemo(()=>active.reduce((n,r)=>n+(summary[r.id]?.progress??0)+(summary[r.id]?.assessments??0),0),[active,summary])

 if(!userId)return <section className="family-workspace"><div className="page-intro"><p className="eyebrow">PARENT & GUARDIAN PORTAL</p><h1>Be part of<br/><em>their progress.</em></h1><p>Sign in to manage authorised learner connections and academic visibility.</p></div></section>

 return <section className="family-workspace">
  <div className="page-intro family-intro"><p className="eyebrow">FAMILY CONNECTIONS · LEARNORA 360°</p><h1>Education moves<br/><em>together.</em></h1><p>Connect the right people to a learner's journey. Every request is scoped, visible to the learner and independently verified before academic access is enabled.</p></div>
  <div className="family-overview">
   <article><span>VERIFIED CONNECTIONS</span><strong>{active.length.toString().padStart(2,'0')}</strong><small>Active, independently verified relationships</small></article>
   <article><span>REQUESTS IN REVIEW</span><strong>{pending.length.toString().padStart(2,'0')}</strong><small>Learner response or authority review outstanding</small></article>
   <article><span>AUTHORISED RECORDS</span><strong>{totalRecords.toString().padStart(2,'0')}</strong><small>Records available within approved scopes</small></article>
  </div>
  {notifications.length>0&&<section className="family-notifications"><div className="family-notifications-heading"><div><p className="eyebrow">LEARNORA NOTIFICATIONS</p><h2>Important family updates.</h2></div><span>{notifications.filter(n=>!n.read_at).length} unread</span></div><div className="family-notification-list">{notifications.map(n=><article className={n.read_at?'family-notification read':'family-notification'} key={n.id}><div><strong>{n.title}</strong><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString()}</small></div>{!n.read_at&&<button type="button" className="text-button" onClick={()=>void markNotificationRead(n.id)}>Mark read</button>}</article>)}</div></section>}
  <div className="family-grid">
   <section className="studio-panel">
    <div className="panel-heading"><div><p className="eyebrow">PARENT / GUARDIAN</p><h2>Connect a learner.</h2></div><Users size={22}/></div>
    <p className="family-lead">Use a learner-issued code for the simplest private connection, or enter the learner's account ID if they have shared it with you.</p>
    <div className="family-mode-tabs"><button type="button" className={connectionMode==='code'?'selected':''} onClick={()=>setConnectionMode('code')}>Invitation code</button><button type="button" className={connectionMode==='account'?'selected':''} onClick={()=>setConnectionMode('account')}>Account ID</button></div>
    <form className="form-stack builder-form" onSubmit={submitParentRequest}>
     {connectionMode==='code'
      ?<label>Learner-issued invitation code<input required autoComplete="off" value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} placeholder="LRN-…"/></label>
      :<label>Learner's Learnora account ID<input required autoComplete="off" value={learnerId} onChange={e=>setLearnerId(e.target.value)} placeholder="Paste the learner account UUID"/></label>}
     <label>Your relationship<select value={relationship} onChange={e=>setRelationship(e.target.value)}><option value="parent">Parent</option><option value="legal_guardian">Legal guardian</option><option value="caregiver">Authorised caregiver</option></select></label>
     <label>Verification case reference (if already issued)<input value={evidenceReference} onChange={e=>setEvidenceReference(e.target.value)} placeholder="Reference from an independent verification process"/></label>
     {connectionMode==='account'&&<div className="consent-scope"><strong>Requested access</strong><label><input type="checkbox" checked={progressScope} onChange={e=>setProgressScope(e.target.checked)}/> Learning progress</label><label><input type="checkbox" checked={assessmentScope} onChange={e=>setAssessmentScope(e.target.checked)}/> Assessment reports</label></div>}
     <label className="family-acknowledge"><input type="checkbox" checked={guardianAcknowledged} onChange={e=>setGuardianAcknowledged(e.target.checked)}/><span>I confirm that I am requesting access for a legitimate caregiving relationship. I understand this request does not establish legal guardianship or grant access before independent verification.</span></label>
     <div className="family-security-note"><LockKeyhole size={17}/><p>Invitation codes expire after 72 hours and can only be redeemed once. Learnora stores a cryptographic hash, not the code itself. Account lookup responses do not disclose whether an account exists.</p></div>
     <button className="button button-dark" disabled={!!busy||!guardianAcknowledged}>{busy==='parent-request'?'Submitting request…':'Continue secure connection'} <ArrowRight size={15}/></button>
    </form>
   </section>

   <section className="studio-panel">
    <div className="panel-heading"><div><p className="eyebrow">PARENT 360°</p><h2>Your family overview.</h2></div><ShieldCheck size={22}/></div>
    {loading?<p className="form-hint">Loading authorised relationships…</p>:outgoing.length===0?<div className="family-empty"><Users size={22}/><strong>Your family space starts here.</strong><p>Once a relationship is approved and independently verified, its permitted academic information will appear here.</p></div>:<div className="family-connection-list">{outgoing.map(r=><article className="family-connection" key={r.id}>
     <div className="family-connection-top"><span>{mask(r.learner_user_id)}</span><span className={'relationship-status '+(r.status==='active'?'is-active':'')}>{r.status==='active'?<CheckCircle2 size={13}/>:<Clock3 size={13}/>} {statusLabel(r.status)}</span></div>
     <small>{r.relationship_type.replaceAll('_',' ')} · Requested {new Date(r.created_at).toLocaleDateString()}</small>
     <div className="scope-chips">{r.consent_scopes.map(s=><span key={s}>{scopeLabel(s)}</span>)}</div>
     {r.status==='active'&&<div className="family-record-counts"><span>{summary[r.id]?.progress??0} learning progress records</span><span>{summary[r.id]?.assessments??0} assessment records</span></div>}
     {r.status==='pending'&&<p className="form-hint">{r.learner_consent_status==='approved'?'Learner acknowledgement received. Independent guardian verification is still required.':r.learner_consent_status==='declined'?'The learner declined this request.':'Waiting for the learner to review this request.'}</p>}
     {['active','pending'].includes(r.status)&&<button className="text-button family-revoke" disabled={!!busy} onClick={()=>void revokeRelationship(r.id)}>Revoke connection</button>}
    </article>)}</div>}
   </section>
  </div>

  <div className="family-grid family-secondary-grid">
   <section className="studio-panel">
    <div className="panel-heading"><div><p className="eyebrow">LEARNER ACCOUNT</p><h2>Issue a private invitation.</h2></div><KeyRound size={22}/></div>
    <p className="family-lead">If this is your learner account, create a temporary code for a parent or authorised guardian. You choose which academic categories may be requested.</p>
    <div className="consent-scope"><strong>Include these information categories</strong><label><input type="checkbox" checked={learnerInviteProgress} onChange={e=>setLearnerInviteProgress(e.target.checked)}/> Learning progress</label><label><input type="checkbox" checked={learnerInviteAssessments} onChange={e=>setLearnerInviteAssessments(e.target.checked)}/> Assessment reports</label></div>
    <button className="button button-dark" disabled={!!busy} onClick={()=>void issueLearnerInvite()}>{busy==='issue-invite'?'Creating secure code…':'Generate invitation code'} <ArrowRight size={15}/></button>
    {newCode&&<div className="new-invite-code"><span>YOUR ONE-TIME CODE · COPY NOW</span><strong>{newCode.code}</strong><button type="button" className="button button-outline" onClick={()=>void copyCode()}><Copy size={14}/> Copy code</button><small>Expires {new Date(newCode.expiresAt).toLocaleString()}</small><p>This code is shown only once in this session. Share it privately with the intended guardian.</p></div>}
    {invites.length>0&&<div className="family-connection-list invite-list">{invites.map(i=><article className="family-connection" key={i.id}><div className="family-connection-top"><span>Invitation · {new Date(i.created_at).toLocaleDateString()}</span><span className="relationship-status">{i.redeemed_at?'Redeemed':i.revoked_at?'Revoked':new Date(i.expires_at)<new Date()?'Expired':'Available'}</span></div><small>{i.consent_scopes.map(scopeLabel).join(' · ')} · Expires {new Date(i.expires_at).toLocaleString()}</small>{!i.redeemed_at&&!i.revoked_at&&new Date(i.expires_at)>new Date()&&<button className="text-button family-revoke" disabled={!!busy} onClick={()=>void revokeInvite(i.id)}>Revoke invitation</button>}</article>)}</div>}
   </section>

   <section className="studio-panel incoming-requests">
    <div className="panel-heading"><div><p className="eyebrow">LEARNER-SIDE CONTROL</p><h2>Review connection requests.</h2></div><ShieldCheck size={22}/></div>
    {loading?<p className="form-hint">Loading incoming requests…</p>:incoming.length===0?<div className="family-empty"><ShieldCheck size={22}/><strong>No requests to review.</strong><p>Requests from parents and guardians will appear here. You remain in control of whether to acknowledge a connection.</p></div>:<div className="family-connection-list">{incoming.map(r=><article className="family-connection learner-request" key={r.id}>
     <div className="family-connection-top"><span>{mask(r.guardian_user_id)}</span><span className={'relationship-status '+(r.status==='active'?'is-active':'')}>{statusLabel(r.status)}</span></div>
     <small>{r.relationship_type.replaceAll('_',' ')} · Requested {new Date(r.created_at).toLocaleDateString()}</small>
     <div className="scope-chips">{r.consent_scopes.map(s=><span key={s}>{scopeLabel(s)}</span>)}</div>
     {r.status==='pending'&&r.learner_consent_status==='pending'&&<>
      <label className="family-acknowledge"><input type="checkbox" checked={!!learnerAcknowledgements[r.id]} onChange={e=>setLearnerAcknowledgements(v=>({...v,[r.id]:e.target.checked}))}/><span>I have reviewed the requested categories and understand that my response is an acknowledgement only. A parent or guardian must still complete independent authority verification.</span></label>
      <div className="learner-response-actions"><button className="button button-dark" disabled={!!busy} onClick={()=>void respondToRequest(r.id,'approve')}>{busy==='response-'+r.id?'Saving…':'Acknowledge request'} <CheckCircle2 size={14}/></button><button className="button button-outline" disabled={!!busy} onClick={()=>void respondToRequest(r.id,'decline')}>Decline <XCircle size={14}/></button></div>
     </>}
     {r.learner_consent_status==='approved'&&<p className="form-hint">You acknowledged this request on {r.learner_consent_at?new Date(r.learner_consent_at).toLocaleDateString():'—'}. It remains pending independent guardian verification.</p>}
     {r.learner_consent_status==='declined'&&<p className="form-hint">You declined this request. No guardian access is active.</p>}
     {r.status==='active'&&<><p className="form-hint">This relationship is active within the approved information categories.</p><button className="text-button family-revoke" disabled={!!busy} onClick={()=>void revokeRelationship(r.id)}>Revoke this connection</button></>}
     {r.status==='pending'&&r.learner_consent_status==='pending'&&<button className="text-button family-revoke" disabled={!!busy} onClick={()=>void revokeRelationship(r.id)}>Dismiss and revoke request</button>}
    </article>)}</div>}
   </section>
  </div>
  <div className="family-legal-note"><LockKeyhole size={16}/><p><strong>Safeguarding distinction.</strong> Learner acknowledgement is not proof of legal guardianship or a substitute for consent from a competent person where required by law. Learnora must independently review the guardian's authority and evidence before activating any relationship. Learners and guardians can revoke an active connection; revocation immediately removes the relationship-based academic access.</p></div>
 </section>
}
