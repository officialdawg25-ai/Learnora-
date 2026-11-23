import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BarChart3, ShieldCheck, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AssessmentBuilder from './AssessmentBuilder'
import EducatorFamilyMessages from './EducatorFamilyMessages'
import './EducatorFamilyMessages.css'

type Props = { academyId: string; userId: string; onNotice: (message: string) => void }
type Analytics = { course_id: string; title: string; publication_status: string; total_enrolments: number; active_learners: number; completed_learners: number; completion_rate_percent: number }
type TeamMember = { id: string; user_id: string; role: string; status: string }

export default function EducatorOperations({ academyId, userId, onNotice }: Props) {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviteRole, setInviteRole] = useState('instructor')
  const [analytics, setAnalytics] = useState<Analytics[]>([])
  const [knowledgeCourseId,setKnowledgeCourseId]=useState('')
  const [knowledgeTitle,setKnowledgeTitle]=useState('')
  const [knowledgeContent,setKnowledgeContent]=useState('')
  const [knowledgeType,setKnowledgeType]=useState('educator_resource')
  const [knowledgeUrl,setKnowledgeUrl]=useState('')
  const [ingesting,setIngesting]=useState(false)
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!supabase || !userId) return
    setLoading(true)
    const [t,a] = await Promise.all([
      academyId ? supabase.from('academy_memberships').select('id,user_id,role,status').eq('academy_id',academyId).order('created_at') : Promise.resolve({data:[],error:null}),
      academyId ? supabase.from('educator_course_analytics').select('*').eq('academy_id',academyId).order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null})
    ])
    setLoading(false)
    setTeam((t.data??[]) as TeamMember[])
    setAnalytics((a.data??[]) as Analytics[])
    if(a.data?.length)setKnowledgeCourseId(current=>a.data.some((x:any)=>x.course_id===current)?current:a.data[0].course_id)
    if (t.error) onNotice('Academy team: '+t.error.message)
    if (a.error) onNotice('Educator analytics: '+a.error.message)
  }

  useEffect(()=>{ void load() },[academyId,userId])

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !academyId) return
    const {error}=await supabase.from('academy_memberships').insert({academy_id:academyId,user_id:inviteUserId.trim(),role:inviteRole,status:'invited',invited_by:userId})
    if (error) onNotice('Team invitation was not created: '+error.message)
    else { setInviteUserId(''); onNotice('Team invitation created. The recipient can review and accept it from the Invitations workspace.'); await load() }
  }

  async function ingestKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(!supabase||!knowledgeCourseId)return
    if(knowledgeContent.trim().length>200000){onNotice('Learning material must be no longer than 200,000 characters.');return}
    setIngesting(true)
    const {data,error}=await supabase.functions.invoke('learnora-knowledge-ingest',{body:{title:knowledgeTitle.trim(),content:knowledgeContent.trim(),course_id:knowledgeCourseId,source_type:knowledgeType,access_scope:'enrolled',source_url:knowledgeUrl.trim()||null,language_code:'en'}})
    setIngesting(false)
    if(error||data?.error)onNotice('Knowledge source was not ingested: '+(data?.error||error?.message||'Unknown error'))
    else{setKnowledgeTitle('');setKnowledgeContent('');setKnowledgeUrl('');onNotice('Learning material saved as a private draft. It becomes available to Learnora AI only after authorised source review.')}
  }

  return <><section className="studio-panel educator-operations">
    <div className="panel-heading"><div><p className="eyebrow">EDUCATOR OPERATIONS</p><h2>Build with credibility.</h2></div><ShieldCheck size={22}/></div>
    <div className="operations-grid">
    </div>
    <div className="operations-block team-block">
      <div className="builder-subheading"><strong><Users size={15}/> Academy team</strong><span>{team.length} memberships</span></div>
      {team.length===0?<p className="form-hint">No team memberships yet. The academy owner remains the default manager.</p>:<div className="builder-list">{team.map(member=><div className="builder-list-item static" key={member.id}><span className="builder-index">{member.role.toUpperCase()}</span><span>{member.user_id}<small>{member.status}</small></span></div>)}</div>}
      <form className="team-invite-form" onSubmit={inviteMember}>
        <label>Existing Learnora user ID<input required value={inviteUserId} onChange={e=>setInviteUserId(e.target.value)} placeholder="User UUID"/></label>
        <label>Role<select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}><option value="instructor">Instructor</option><option value="editor">Editor</option><option value="analyst">Analyst</option><option value="admin">Administrator</option></select></label>
        <button className="button button-dark" type="submit">Invite team member</button>
      </form>
      <p className="form-hint">Invitations target an existing Learnora account and can be accepted in the Invitations workspace. Email delivery and invitations for people without an account are not enabled.</p>
    </div>
    <div className="operations-block">
      <div className="builder-subheading"><strong><BarChart3 size={15}/> Course performance</strong><span>{analytics.length} courses</span></div>
      {loading?<p className="form-hint">Loading performance data…</p>:analytics.length===0?<p className="form-hint">Course analytics will appear as real learners enrol and complete programmes. No sample metrics are generated.</p>:<div className="analytics-table"><div className="analytics-head"><span>COURSE</span><span>ENROLLED</span><span>ACTIVE</span><span>COMPLETED</span></div>{analytics.map(row=><div className="analytics-row" key={row.course_id}><span>{row.title}<small>{row.publication_status}</small></span><span>{row.total_enrolments}</span><span>{row.active_learners}</span><span>{row.completed_learners} <small>{row.completion_rate_percent}%</small></span></div>)}</div>}
    </div>
    <div className="operations-block">
      <div className="builder-subheading"><strong>Curriculum knowledge ingestion</strong><span>Private draft</span></div>
      {analytics.length===0?<p className="form-hint">Create a course first to attach authorised learning material.</p>:<form className="form-stack builder-form" onSubmit={ingestKnowledge}>
        <label>Course<select required value={knowledgeCourseId} onChange={e=>setKnowledgeCourseId(e.target.value)}>{analytics.map(x=><option key={x.course_id} value={x.course_id}>{x.title}</option>)}</select></label>
        <label>Source title<input required maxLength={200} value={knowledgeTitle} onChange={e=>setKnowledgeTitle(e.target.value)} placeholder="Curriculum topic or learning resource"/></label>
        <label>Source type<select value={knowledgeType} onChange={e=>setKnowledgeType(e.target.value)}><option value="educator_resource">Educator resource</option><option value="course_lesson">Course lesson</option><option value="curriculum">Curriculum reference</option></select></label>
        <label>Authorised source URL (optional)<input type="url" value={knowledgeUrl} onChange={e=>setKnowledgeUrl(e.target.value)} placeholder="https://"/></label>
        <label>Learning material<textarea required rows={6} maxLength={200000} value={knowledgeContent} onChange={e=>setKnowledgeContent(e.target.value)} placeholder="Paste learning material you own or are authorised to use…"/></label>
        <button className="button button-dark" disabled={ingesting||!knowledgeCourseId}>{ingesting?'Saving source…':'Ingest as private draft'}</button>
        <p className="form-hint">Maximum 200,000 characters. Material remains private and is not used by learner AI until an authorised reviewer publishes it.</p>
      </form>}
    </div>
  </section><EducatorFamilyMessages userId={userId} onNotice={onNotice}/><AssessmentBuilder academyId={academyId} userId={userId} onNotice={onNotice}/></>
}
