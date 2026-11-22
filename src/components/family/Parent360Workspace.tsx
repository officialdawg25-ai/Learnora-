import {useEffect,useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowUpRight,Download,FileText,RefreshCw,Send,ShieldCheck,Wallet,AlertCircle} from 'lucide-react';
import {supabase} from '../../lib/supabase';

type Tab='attendance'|'educators'|'messages'|'finance'|'calendar'|'documents'|'support';
type Attendance={id:string;attendance_date:string;attendance_status:string;arrival_time:string|null;explanation:string|null};
type Invoice={id:string;invoice_number:string;description:string;currency:string;total_minor:number;amount_paid_minor:number;balance_minor:number;due_date:string|null;status:string;items:{id:string;description:string;line_total_minor:number}[]};
type EventRow={id:string;title:string;description:string|null;event_type:string;starts_at:string;ends_at:string|null;all_day:boolean};
type DocumentRow={id:string;title:string;document_type:string;storage_path:string;mime_type:string|null;created_at:string};
type Educator={user_id:string;display_name:string|null;bio:string|null;subjects:string[];region:string|null;course_title:string};
type Conversation={id:string;subject:string;educator_user_id:string;created_at:string;status:string};
type Message={id:string;conversation_id:string;sender_user_id:string;body:string;created_at:string;read_at:string|null};
type Workspace={attendance:Attendance[];invoices:Invoice[];calendar:EventRow[];documents:DocumentRow[];educators:Educator[];attendance_summary:{total:number;present:number;absent:number;late:number;excused:number}};
const tuitionCheckoutEnabled=import.meta.env.VITE_PARENT_TUITION_ENABLED==='true';
const money=(minor:number,currency='ZAR')=>new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format(minor/100);
const date=(v:string|null)=>v?new Date(v+'T00:00:00').toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'}):'—';
const time=(v:string)=>new Date(v).toLocaleString('en-ZA',{dateStyle:'medium',timeStyle:'short'});
const title=(v:string)=>v.replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());
export default function Parent360Workspace({tab,userId,learnerId,onNotice}:{tab:Tab;userId:string;learnerId:string;onNotice:(message:string)=>void}){
 const [data,setData]=useState<Workspace|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [conversations,setConversations]=useState<Conversation[]>([]),[messages,setMessages]=useState<Message[]>([]);
 const [selectedConversation,setSelectedConversation]=useState('');
 const [educatorId,setEducatorId]=useState(''),[subject,setSubject]=useState(''),[messageBody,setMessageBody]=useState('');
 const [reply,setReply]=useState(''),[busy,setBusy]=useState('');
 const [supportCategory,setSupportCategory]=useState('account'),[supportSubject,setSupportSubject]=useState(''),[supportDescription,setSupportDescription]=useState('');
 const [meetingEducator,setMeetingEducator]=useState(''),[meetingMessage,setMeetingMessage]=useState(''),[meetingDate,setMeetingDate]=useState('');
 const [supportRows,setSupportRows]=useState<{id:string;subject:string;status:string;created_at:string}[]>([]);
 const [paymentRows,setPaymentRows]=useState<{id:string;invoice_id:string;amount_minor:number;status:string;receipt_number:string|null;created_at:string}[]>([]);
 const [meetingRows,setMeetingRows]=useState<{id:string;educator_user_id:string;requested_start:string|null;confirmed_start:string|null;status:string;message:string|null}[]>([]);
 const [documentUrls,setDocumentUrls]=useState<Record<string,string>>({});
 async function load(){
  if(!supabase||!learnerId){setData(null);setLoading(false);return}
  setLoading(true);setError('');
  const [workspaceResult,conversationResult,supportResult,paymentResult,meetingResult]=await Promise.all([
   supabase.rpc('guardian_parent_workspace',{p_learner_id:learnerId}),
   supabase.from('family_conversations').select('id,subject,educator_user_id,created_at,status').eq('parent_user_id',userId).eq('learner_user_id',learnerId).order('created_at',{ascending:false}),
   supabase.from('family_support_requests').select('id,subject,status,created_at').eq('requester_user_id',userId).order('created_at',{ascending:false}).limit(20),
   supabase.from('family_tuition_payments').select('id,invoice_id,amount_minor,status,receipt_number,created_at').eq('payer_user_id',userId).order('created_at',{ascending:false}).limit(20),
   supabase.from('family_meeting_requests').select('id,educator_user_id,requested_start,confirmed_start,status,message').eq('parent_user_id',userId).eq('learner_user_id',learnerId).order('created_at',{ascending:false}).limit(20)
  ]);
  if(workspaceResult.error){setError(workspaceResult.error.message);setData(null)}else setData(workspaceResult.data as Workspace);
  if(conversationResult.error)onNotice('Messages could not be loaded: '+conversationResult.error.message);
  else{
   const rows=(conversationResult.data??[]) as Conversation[];setConversations(rows);
   if(rows.length){const ids=rows.map(x=>x.id);const result=await supabase.from('family_messages').select('id,conversation_id,sender_user_id,body,created_at,read_at').in('conversation_id',ids).order('created_at',{ascending:true}).limit(200);if(result.error)onNotice('Conversation messages could not be loaded: '+result.error.message);else setMessages((result.data??[]) as Message[])}
   else setMessages([]);
  }
  if(supportResult.error)onNotice('Support requests could not be loaded: '+supportResult.error.message);else setSupportRows((supportResult.data??[]) as typeof supportRows);
  if(paymentResult.error)onNotice('Payment history could not be loaded: '+paymentResult.error.message);else setPaymentRows((paymentResult.data??[]) as typeof paymentRows);
  if(meetingResult.error)onNotice('Meeting requests could not be loaded: '+meetingResult.error.message);else setMeetingRows((meetingResult.data??[]) as typeof meetingRows);
  setLoading(false);
 }
 useEffect(()=>{void load()},[learnerId,userId,tab]);
 const attendance=data?.attendance_summary;
 const outstanding=(data?.invoices??[]).reduce((sum,i)=>sum+Number(i.balance_minor||0),0);
 const unread=messages.filter(m=>m.sender_user_id!==userId&&!m.read_at).length;
 async function createConversation(e:FormEvent){
  e.preventDefault();if(!supabase||!learnerId||!educatorId||!subject.trim()||!messageBody.trim())return;
  setBusy('message');
  const created=await supabase.from('family_conversations').insert({learner_user_id:learnerId,parent_user_id:userId,educator_user_id:educatorId,subject:subject.trim()}).select('id').single();
  if(created.error){setBusy('');onNotice('Conversation could not be started: '+created.error.message);return}
  const sent=await supabase.from('family_messages').insert({conversation_id:created.data.id,sender_user_id:userId,body:messageBody.trim()});
  setBusy('');
  if(sent.error){onNotice('The conversation was created but your message could not be sent: '+sent.error.message);return}
  setSubject('');setMessageBody('');setSelectedConversation(created.data.id);onNotice('Your message has been sent to the selected educator.');await load();
 }
 async function sendReply(e:FormEvent){
  e.preventDefault();if(!supabase||!selectedConversation||!reply.trim())return;
  setBusy('reply');const {error}=await supabase.from('family_messages').insert({conversation_id:selectedConversation,sender_user_id:userId,body:reply.trim()});setBusy('');
  if(error){onNotice('Message could not be sent: '+error.message);return}setReply('');await load();
 }
 async function payInvoice(invoice:Invoice){
  if(!supabase)return;
  const amount=invoice.balance_minor;
  if(amount<=0)return;
  setBusy('pay-'+invoice.id);
  const {data:result,error}=await supabase.functions.invoke('family-tuition-checkout',{body:{invoice_id:invoice.id,amount_minor:amount}});
  setBusy('');
  if(error||!result?.checkout_url){onNotice(result?.error||'Secure tuition checkout is not currently available. Confirm PayFast tuition settings and deployment.');return}
  window.location.assign(result.checkout_url);
 }
 async function openDocument(item:DocumentRow){
  if(!supabase)return;
  if(documentUrls[item.id]){window.open(documentUrls[item.id],'_blank','noopener,noreferrer');return}
  const {data:link,error}=await supabase.storage.from('learnora-family-documents').createSignedUrl(item.storage_path,120);
  if(error||!link?.signedUrl){onNotice('This document is not available for secure viewing: '+(error?.message??'Access denied'));return}
  setDocumentUrls(v=>({...v,[item.id]:link.signedUrl}));window.open(link.signedUrl,'_blank','noopener,noreferrer');
 }
 async function requestMeeting(e:FormEvent){
  e.preventDefault();if(!supabase||!meetingEducator||!meetingDate)return;
  setBusy('meeting');const {error}=await supabase.from('family_meeting_requests').insert({learner_user_id:learnerId,parent_user_id:userId,educator_user_id:meetingEducator,requested_start:new Date(meetingDate).toISOString(),message:meetingMessage.trim()||null});setBusy('');
  if(error){onNotice('Meeting request could not be sent: '+error.message);return}setMeetingMessage('');onNotice('Meeting request sent. The educator must confirm the proposed time.');await load();
 }
 async function createSupport(e:FormEvent){
  e.preventDefault();if(!supabase)return;
  setBusy('support');const {error}=await supabase.from('family_support_requests').insert({requester_user_id:userId,category:supportCategory,subject:supportSubject.trim(),description:supportDescription.trim()});setBusy('');
  if(error){onNotice('Support request could not be submitted: '+error.message);return}setSupportSubject('');setSupportDescription('');onNotice('Your support request has been recorded.');await load();
 }
 const selected=conversations.find(c=>c.id===selectedConversation)??conversations[0]??null;
 const selectedMessages=useMemo(()=>messages.filter(m=>m.conversation_id===selected?.id),[messages,selected?.id]);
 if(loading)return <div className="parent360-loading"><span className="parent-spinner"/><p>Loading verified family records…</p></div>;
 if(error)return <div className="parent-inline-error"><strong>Family information is unavailable.</strong><span>{error}</span><button className="button button-outline small" onClick={()=>void load()}><RefreshCw size={14}/> Try again</button></div>;
 if(!data)return <div className="parent-empty-state"><ShieldCheck size={22}/><h3>Select a verified learner.</h3><p>Connect and verify a learner account before accessing these records.</p></div>;
 return <div className="parent360">
  {tab==='attendance'&&<><div className="parent360-heading"><div><p className="eyebrow">ATTENDANCE & PARTICIPATION</p><h2>Presence, clearly recorded.</h2><p>Only institution-recorded attendance is shown. No records are inferred.</p></div><span className="parent360-status"><ShieldCheck size={14}/> Verified family access</span></div><div className="parent360-metrics"><article><span>RECORDS</span><strong>{attendance?.total??0}</strong></article><article><span>PRESENT</span><strong>{attendance?.present??0}</strong></article><article><span>ABSENT</span><strong>{attendance?.absent??0}</strong></article><article><span>LATE</span><strong>{attendance?.late??0}</strong></article><article><span>EXCUSED</span><strong>{attendance?.excused??0}</strong></article></div><div className="parent360-table-wrap"><table className="parent360-table"><thead><tr><th>Date</th><th>Status</th><th>Arrival</th><th>Institution explanation</th></tr></thead><tbody>{data.attendance.map(a=><tr key={a.id}><td>{date(a.attendance_date)}</td><td><span className={'parent360-pill '+a.attendance_status}>{title(a.attendance_status)}</span></td><td>{a.arrival_time??'—'}</td><td>{a.explanation||'—'}</td></tr>)}</tbody></table>{!data.attendance.length&&<p className="parent360-empty">No attendance records have been published for this learner.</p>}</div></>}
  {tab==='educators'&&<><div className="parent360-heading"><div><p className="eyebrow">EDUCATORS & INSTITUTIONS</p><h2>The people guiding their learning.</h2><p>Educators are listed only where the learner has a recorded course relationship.</p></div></div><div className="parent360-educators">{data.educators.map((e,i)=><article key={e.user_id+'-'+i}><span className="parent360-educator-avatar">{(e.display_name||'E').slice(0,1).toUpperCase()}</span><div><strong>{e.display_name||'Educator profile'}</strong><p>{e.course_title}</p><small>{(e.subjects??[]).join(' · ')||'Subject information not supplied'}{e.region?' · '+e.region:''}</small>{e.bio&&<p>{e.bio}</p>}</div><span className="parent360-pill">Learnora educator</span></article>)}</div>{!data.educators.length&&<p className="parent360-empty">No educator relationships have been published through the learner's course records yet.</p>}<section className="parent360-panel"><h3>Request a parent–teacher meeting</h3><form className="parent360-form" onSubmit={requestMeeting}><label>Educator<select required value={meetingEducator} onChange={e=>setMeetingEducator(e.target.value)}><option value="">Choose an educator</option>{data.educators.map((e,i)=><option key={e.user_id+'-'+i} value={e.user_id}>{e.display_name||e.course_title}</option>)}</select></label><label>Proposed date and time<input type="datetime-local" required value={meetingDate} onChange={e=>setMeetingDate(e.target.value)}/></label><label>Message<textarea rows={3} value={meetingMessage} onChange={e=>setMeetingMessage(e.target.value)} placeholder="Share the topic you would like to discuss."/></label><button className="button button-dark" disabled={busy==='meeting'||!data.educators.length}>{busy==='meeting'?'Sending…':'Request meeting'}</button></form></section><section className="parent360-panel"><h3>Meeting requests</h3>{meetingRows.map(m=><div className="parent360-payment-row" key={m.id}><div><strong>{m.confirmed_start?'Confirmed: '+time(m.confirmed_start):m.requested_start?'Requested: '+time(m.requested_start):'Meeting request'}</strong><small>{m.message||'No additional details'}</small></div><span className="parent360-pill">{title(m.status)}</span></div>)}{!meetingRows.length&&<p>No parent–teacher meeting requests yet.</p>}</section></>}
  {tab==='messages'&&<><div className="parent360-heading"><div><p className="eyebrow">COMMUNICATION CENTRE</p><h2>Keep the conversation open.</h2><p>{unread?unread+' unread messages':'Your educator conversations for this learner'}.</p></div></div><div className="parent360-messages"><aside>{conversations.map(c=><button key={c.id} className={selected?.id===c.id?'active':''} onClick={()=>setSelectedConversation(c.id)}><strong>{c.subject}</strong><small>{time(c.created_at)}</small></button>)}{!conversations.length&&<p>No conversations yet.</p>}</aside><section>{selected?<><div className="parent360-message-list">{selectedMessages.map(m=><article className={m.sender_user_id===userId?'mine':'theirs'} key={m.id}><p>{m.body}</p><small>{time(m.created_at)}{m.sender_user_id===userId?' · You':''}</small></article>)}</div><form className="parent360-reply" onSubmit={sendReply}><textarea rows={2} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write a reply…" required/><button className="button button-dark" disabled={busy==='reply'}><Send size={14}/> Send</button></form></>:<p className="parent360-empty">Select a conversation or start one with an authorised educator.</p>}</section></div><section className="parent360-panel"><h3>Start a conversation</h3><form className="parent360-form" onSubmit={createConversation}><label>Educator<select required value={educatorId} onChange={e=>setEducatorId(e.target.value)}><option value="">Choose an educator</option>{data.educators.map((e,i)=><option key={e.user_id+'-'+i} value={e.user_id}>{e.display_name||e.course_title}</option>)}</select></label><label>Subject<input required maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Understanding recent assessment feedback"/></label><label>Message<textarea required rows={3} maxLength={10000} value={messageBody} onChange={e=>setMessageBody(e.target.value)} placeholder="Write your message…"/></label><button className="button button-dark" disabled={busy==='message'||!data.educators.length}>{busy==='message'?'Sending…':'Send message'}</button></form></section></>}
  {tab==='finance'&&<><div className="parent360-heading"><div><p className="eyebrow">FINANCIAL CENTRE · ZAR</p><h2>Tuition and fee visibility.</h2><p>Balances are calculated from institution-issued invoices and verified payment allocations.</p></div><span className="parent360-status"><Wallet size={14}/> {money(outstanding)} outstanding</span></div><div className="parent360-invoices">{data.invoices.map(i=><article key={i.id}><div className="parent360-invoice-top"><div><span className="eyebrow">{i.invoice_number}</span><h3>{i.description}</h3><small>Due {date(i.due_date)}</small></div><span className={'parent360-pill '+i.status}>{title(i.status)}</span></div><div className="parent360-invoice-values"><span><small>Invoice total</small><strong>{money(i.total_minor,i.currency)}</strong></span><span><small>Paid</small><strong>{money(i.amount_paid_minor,i.currency)}</strong></span><span><small>Balance</small><strong>{money(i.balance_minor,i.currency)}</strong></span></div>{i.items?.length>0&&<ul>{i.items.map(item=><li key={item.id}>{item.description}<strong>{money(item.line_total_minor,i.currency)}</strong></li>)}</ul>}{i.balance_minor>0&&<button className="button button-dark small" onClick={()=>void payInvoice(i)} disabled={!tuitionCheckoutEnabled||busy==='pay-'+i.id}>{busy==='pay-'+i.id?'Preparing secure checkout…':tuitionCheckoutEnabled?'Pay outstanding balance':'Online tuition checkout not enabled'} <ArrowUpRight size={14}/></button>}</article>)}</div>{!data.invoices.length&&<p className="parent360-empty">No tuition invoices have been issued to this learner's family account.</p>}<section className="parent360-panel"><h3>Payment history</h3>{paymentRows.length?paymentRows.map(p=><div className="parent360-payment-row" key={p.id}><div><strong>{money(p.amount_minor)}</strong><small>{time(p.created_at)} · {p.receipt_number||'Receipt pending'}</small></div><span className={'parent360-pill '+p.status}>{title(p.status)}</span></div>):<p>No tuition payments recorded yet.</p>}</section><p className="parent360-note"><AlertCircle size={15}/> Checkout remains in PayFast sandbox until the tuition notification URL and provider configuration are deployed and verified. A browser redirect never changes an invoice balance.</p></>}
  {tab==='calendar'&&<><div className="parent360-heading"><div><p className="eyebrow">ACADEMIC CALENDAR</p><h2>What is coming up.</h2><p>Events and deadlines published for this learner.</p></div></div><div className="parent360-events">{data.calendar.map(e=><article key={e.id}><span className="parent360-event-date">{new Date(e.starts_at).toLocaleDateString('en-ZA',{day:'2-digit',month:'short'})}</span><div><span className="eyebrow">{title(e.event_type)} · {e.all_day?'All day':time(e.starts_at)}</span><strong>{e.title}</strong>{e.description&&<p>{e.description}</p>}</div></article>)}</div>{!data.calendar.length&&<p className="parent360-empty">No upcoming school or assessment events have been published.</p>}</>}
  {tab==='documents'&&<><div className="parent360-heading"><div><p className="eyebrow">DOCUMENTS & RECORDS</p><h2>Your family's learning records.</h2><p>Only institution-published documents explicitly marked parent-visible appear here.</p></div></div><div className="parent360-documents">{data.documents.map(d=><article key={d.id}><FileText size={20}/><div><strong>{d.title}</strong><small>{title(d.document_type)} · {date(d.created_at)}</small></div><button className="button button-outline small" onClick={()=>void openDocument(d)}><Download size={14}/> View securely</button></article>)}</div>{!data.documents.length&&<p className="parent360-empty">No parent-visible documents have been published for this learner.</p>}</>}
  {tab==='support'&&<><div className="parent360-heading"><div><p className="eyebrow">LEARNORA FAMILY SUPPORT</p><h2>How can we help?</h2><p>Submit a support request and keep track of its status.</p></div></div><section className="parent360-panel"><form className="parent360-form" onSubmit={createSupport}><label>Category<select value={supportCategory} onChange={e=>setSupportCategory(e.target.value)}><option value="account">Account assistance</option><option value="learner_account">Learner account</option><option value="payment">Payment support</option><option value="academic">Academic portal</option><option value="technical">Technical support</option><option value="privacy">Privacy request</option></select></label><label>Subject<input required maxLength={160} value={supportSubject} onChange={e=>setSupportSubject(e.target.value)} placeholder="Briefly describe the issue"/></label><label>Details<textarea required minLength={10} maxLength={5000} rows={4} value={supportDescription} onChange={e=>setSupportDescription(e.target.value)} placeholder="Include relevant details. Do not include passwords or payment card information."/></label><button className="button button-dark" disabled={busy==='support'}>{busy==='support'?'Submitting…':'Submit support request'}</button></form></section><section className="parent360-panel"><h3>Your support requests</h3>{supportRows.map(s=><div className="parent360-payment-row" key={s.id}><div><strong>{s.subject}</strong><small>{time(s.created_at)}</small></div><span className="parent360-pill">{title(s.status)}</span></div>)}{!supportRows.length&&<p>No support requests yet.</p>}</section></>}
 </div>
}
