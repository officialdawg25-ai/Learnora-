import { useEffect, useState } from 'react'
import { CalendarDays, ClipboardCheck, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type ClassRow = { id:string; name:string; grade_or_level:string|null; academic_year:number|null }
type SessionRow = { id:string; class_id:string; title:string; scheduled_start:string; scheduled_end:string; status:string }

export default function EducatorOverview({userId,academyId,onNotice}:{userId:string;academyId:string;onNotice:(s:string)=>void}) {
  const [classes,setClasses]=useState<ClassRow[]>([])
  const [counts,setCounts]=useState<Record<string,number>>({})
  const [sessions,setSessions]=useState<SessionRow[]>([])
  const [pendingMarking,setPendingMarking]=useState(0)
  const [loading,setLoading]=useState(true)

  async function load() {
    if(!supabase||!userId){setLoading(false);return}
    setLoading(true)
    const [classResult,sessionResult,attemptResult]=await Promise.all([
      supabase.from('institution_classes').select('id,name,grade_or_level,academic_year').order('created_at',{ascending:false}).limit(50),
      supabase.from('live_class_sessions').select('id,class_id,title,scheduled_start,scheduled_end,status').eq('educator_user_id',userId).in('status',['scheduled','live']).order('scheduled_start',{ascending:true}).limit(12),
      supabase.from('assessment_attempts').select('id',{count:'exact',head:true}).eq('status','submitted'),
    ])
    setLoading(false)
    if(classResult.error)onNotice('Your classes could not be loaded: '+classResult.error.message)
    else {
      const rows=(classResult.data??[]) as ClassRow[]
      setClasses(rows)
      if(rows.length){
        const membership=await supabase.from('class_memberships').select('class_id,user_id,role,status').in('class_id',rows.map(x=>x.id)).eq('role','learner').eq('status','active')
        if(membership.error)onNotice('Class learner counts are unavailable: '+membership.error.message)
        else {
          const grouped:Record<string,number>={}
          ;(membership.data??[]).forEach((x:any)=>{grouped[x.class_id]=(grouped[x.class_id]??0)+1})
          setCounts(grouped)
        }
      } else setCounts({})
    }
    if(sessionResult.error)onNotice('Upcoming teaching sessions: '+sessionResult.error.message)
    else setSessions((sessionResult.data??[]) as SessionRow[])
    if(attemptResult.error)onNotice('Assessment marking queue: '+attemptResult.error.message)
    else setPendingMarking(attemptResult.count??0)
  }

  useEffect(()=>{void load()},[userId,academyId])

  const className=(id:string)=>classes.find(x=>x.id===id)?.name??'Class'
  const learnerTotal=Object.values(counts).reduce((sum,n)=>sum+n,0)

  return <section className="educator-overview">
    <div className="educator-overview-heading">
      <div><p className="eyebrow">YOUR TEACHING DAY</p><h2>Teaching, <em>in focus.</em></h2><p>Live information from the classes, sessions and assessments you are authorised to manage.</p></div>
      <span>{loading?'Updating…':'Current workspace'}</span>
    </div>
    <div className="educator-overview-metrics">
      <div><Users size={17}/><strong>{classes.length}</strong><span>Accessible classes</span></div>
      <div><Users size={17}/><strong>{learnerTotal}</strong><span>Active class enrolments</span></div>
      <div><CalendarDays size={17}/><strong>{sessions.length}</strong><span>Scheduled / live sessions</span></div>
      <div><ClipboardCheck size={17}/><strong>{pendingMarking}</strong><span>Submissions awaiting marking</span></div>
    </div>
    <div className="educator-overview-columns">
      <section className="studio-panel">
        <div className="panel-heading"><div><p className="eyebrow">MY CLASSES</p><h3>Teaching relationships</h3></div><Users size={20}/></div>
        {loading?<p className="form-hint">Loading authorised classes…</p>:classes.length===0?<p className="form-hint">No institution classes are currently connected to your educator account. An institution administrator can invite you to an existing class.</p>:classes.map(item=><article className="educator-overview-row" key={item.id}><div><strong>{item.name}</strong><small>{item.grade_or_level??'Level not specified'}{item.academic_year?' · '+item.academic_year:''}</small></div><span>{counts[item.id]??0} learners</span></article>)}
      </section>
      <section className="studio-panel">
        <div className="panel-heading"><div><p className="eyebrow">UPCOMING TEACHING</p><h3>Scheduled sessions</h3></div><CalendarDays size={20}/></div>
        {loading?<p className="form-hint">Loading sessions…</p>:sessions.length===0?<p className="form-hint">No scheduled or live sessions are currently connected to your account.</p>:sessions.map(item=><article className="educator-overview-row" key={item.id}><div><strong>{item.title}</strong><small>{className(item.class_id)} · {new Date(item.scheduled_start).toLocaleString()}</small></div><span>{item.status}</span></article>)}
      </section>
    </div>
  </section>
}
