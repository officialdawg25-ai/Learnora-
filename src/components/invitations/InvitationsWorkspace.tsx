import { useEffect, useState } from 'react'
import { Check, MailOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
type Invitation={id:string;role:string;academy_id?:string;class_id?:string;academies?:{name:string}|null;institution_classes?:{name:string}|null}
export default function InvitationsWorkspace({userId,onNotice}:{userId:string;onNotice:(s:string)=>void}){
 const [academyInvites,setAcademyInvites]=useState<Invitation[]>([])
 const [classInvites,setClassInvites]=useState<Invitation[]>([])
 const [busy,setBusy]=useState('')
 async function load(){
  if(!supabase||!userId)return
  const [a,c]=await Promise.all([
   supabase.from('academy_memberships').select('id,academy_id,role,academies(name)').eq('user_id',userId).eq('status','invited'),
   supabase.from('class_memberships').select('id,class_id,role,institution_classes(name)').eq('user_id',userId).eq('status','invited')
  ])
  if(a.error)onNotice('Academy invitations: '+a.error.message);else setAcademyInvites((a.data??[]) as unknown as Invitation[])
  if(c.error)onNotice('Class invitations: '+c.error.message);else setClassInvites((c.data??[]) as unknown as Invitation[])
 }
 useEffect(()=>{void load()},[userId])
 async function accept(kind:'academy'|'class',id:string){
  if(!supabase)return
  setBusy(id)
  const table=kind==='academy'?'academy_memberships':'class_memberships'
  const {error}=await supabase.from(table).update({status:'active'}).eq('id',id).eq('status','invited')
  setBusy('')
  if(error)onNotice('Invitation could not be accepted: '+error.message)
  else{onNotice('Invitation accepted. Your membership is now active.');await load()}
 }
 if(!userId)return <section className="invitation-workspace"><div className="page-intro"><p className="eyebrow">YOUR INVITATIONS</p><h1>Join your<br/><em>learning circles.</em></h1><p>Sign in to view invitations sent to your Learnora account.</p></div></section>
 return <section className="invitation-workspace">
  <div className="page-intro"><p className="eyebrow">YOUR INVITATIONS</p><h1>Join your<br/><em>learning circles.</em></h1><p>Accept academy and institution class invitations addressed to your Learnora account.</p></div>
  <section className="studio-panel invitation-panel"><div className="panel-heading"><div><p className="eyebrow">EDUCATOR ACADEMIES</p><h2>Academy invitations</h2></div><MailOpen size={22}/></div>
   {academyInvites.length===0?<p className="form-hint">No pending academy invitations.</p>:academyInvites.map(x=><article className="invitation-row" key={x.id}><div><strong>{x.academies?.name??'Academy invitation'}</strong><small>Role: {x.role}</small></div><button className="button button-dark" disabled={!!busy} onClick={()=>void accept('academy',x.id)}>Accept <Check size={15}/></button></article>)}
  </section>
  <section className="studio-panel invitation-panel"><div className="panel-heading"><div><p className="eyebrow">INSTITUTIONS</p><h2>Class invitations</h2></div><MailOpen size={22}/></div>
   {classInvites.length===0?<p className="form-hint">No pending class invitations.</p>:classInvites.map(x=><article className="invitation-row" key={x.id}><div><strong>{x.institution_classes?.name??'Class invitation'}</strong><small>Role: {x.role}</small></div><button className="button button-dark" disabled={!!busy} onClick={()=>void accept('class',x.id)}>Accept <Check size={15}/></button></article>)}
  </section>
 </section>
}
