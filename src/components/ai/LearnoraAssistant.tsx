import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowUp, BookOpen, BrainCircuit, LoaderCircle, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Message={role:'user'|'assistant';content:string;sources?:{marker:string;title:string;url:string|null}[]}
export default function LearnoraAssistant(){
 const [mode,setMode]=useState<'tutor'|'teacher'>('tutor')
 const [conversationId,setConversationId]=useState<string|null>(null)
 const [messages,setMessages]=useState<Message[]>([])
 const [draft,setDraft]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 async function send(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const message=draft.trim();if(!message||busy||!supabase)return
  setDraft('');setError('');setMessages(old=>[...old,{role:'user',content:message}]);setBusy(true)
  const {data,error:invokeError}=await supabase.functions.invoke('learnora-ai',{body:{capability:mode,message,conversation_id:conversationId}})
  setBusy(false)
  if(invokeError||data?.error){setError(data?.error||invokeError?.message||'Learnora AI is unavailable.');return}
  setConversationId(data.conversation_id)
  setMessages(old=>[...old,{role:'assistant',content:data.answer,sources:data.sources??[]}])
 }
 function changeMode(next:'tutor'|'teacher'){setMode(next);setConversationId(null);setMessages([]);setError('')}
 return <section className="ai-workspace">
  <div className="ai-heading"><div><p className="eyebrow">LEARNORA INTELLIGENCE</p><h1>{mode==='tutor'?'Understand more.':'Teach with intention.'}</h1><p>{mode==='tutor'?'A guided learning companion that helps you work through difficult ideas.':'A teaching assistant for lesson planning, differentiation and resource preparation.'}</p></div><div className="ai-symbol"><BrainCircuit size={27}/></div></div>
  <div className="ai-mode-switch"><button className={mode==='tutor'?'selected':''} onClick={()=>changeMode('tutor')}><BookOpen size={15}/> Learnora Tutor</button><button className={mode==='teacher'?'selected':''} onClick={()=>changeMode('teacher')}><Sparkles size={15}/> Teacher Intelligence</button></div>
  <div className="ai-chat" aria-live="polite">
   {messages.length===0?<div className="ai-empty"><div><Sparkles size={22}/></div><h2>{mode==='tutor'?'What would you like to understand?':'What are you preparing to teach?'}</h2><p>{mode==='tutor'?'Ask a question, share where you got stuck, or work through a concept step by step.':'Describe a lesson, learning objective, topic or teaching challenge.'}</p></div>:<div className="ai-messages">{messages.map((m,i)=><article className={'ai-message '+m.role} key={i}><span>{m.role==='user'?'YOU':mode==='tutor'?'LEARNORA TUTOR':'TEACHER INTELLIGENCE'}</span><p>{m.content}</p>{m.sources && m.sources.length>0&&<div className="ai-sources"><strong>Reference material</strong>{m.sources.map(s=><div key={s.marker}>{s.marker} · {s.url?<a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>:s.title}</div>)}</div>}</article>)}</div>}
   {busy&&<div className="ai-thinking"><LoaderCircle size={16}/> Thinking through your question…</div>}
  </div>
  {error&&<p className="ai-error" role="alert">{error}</p>}
  <form className="ai-composer" onSubmit={send}><textarea rows={3} maxLength={6000} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={mode==='tutor'?'Ask Learnora Tutor…':'Ask Teacher Intelligence…'} disabled={busy}/><button type="submit" disabled={busy||!draft.trim()} aria-label="Send message">{busy?<LoaderCircle size={18}/>:<ArrowUp size={18}/>}</button></form>
  <p className="ai-disclaimer">AI-generated educational assistance can contain errors. Verify important information with educators and authoritative learning materials. Provider configuration is required to activate responses.</p>
 </section>
}
