import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BarChart3, ClipboardCheck, ShieldCheck, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Props = { academyId: string; userId: string; onNotice: (message: string) => void }
type Analytics = { course_id: string; title: string; publication_status: string; total_enrolments: number; active_learners: number; completed_learners: number; completion_rate_percent: number }
type TeamMember = { id: string; user_id: string; role: string; status: string }
type EducatorProfile = { professional_bio: string | null; teaching_experience_years: number | null; teaching_languages: string[]; subjects: string[]; verification_status: string }

export default function EducatorOperations({ academyId, userId, onNotice }: Props) {
  const [profile, setProfile] = useState<EducatorProfile | null>(null)
  const [bio, setBio] = useState('')
  const [experience, setExperience] = useState('0')
  const [languages, setLanguages] = useState('en')
  const [subjects, setSubjects] = useState('')
  const [credentialType, setCredentialType] = useState('teaching_qualification')
  const [issuer, setIssuer] = useState('')
  const [credentialReference, setCredentialReference] = useState('')
  const [evidencePath, setEvidencePath] = useState('')
  const [team, setTeam] = useState<TeamMember[]>([])
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviteRole, setInviteRole] = useState('instructor')
  const [analytics, setAnalytics] = useState<Analytics[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!supabase || !userId) return
    setLoading(true)
    const [p,t,a] = await Promise.all([
      supabase.from('educator_profiles').select('professional_bio,teaching_experience_years,teaching_languages,subjects,verification_status').eq('user_id',userId).maybeSingle(),
      academyId ? supabase.from('academy_memberships').select('id,user_id,role,status').eq('academy_id',academyId).order('created_at') : Promise.resolve({data:[],error:null}),
      academyId ? supabase.from('educator_course_analytics').select('*').eq('academy_id',academyId).order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null})
    ])
    setLoading(false)
    if (p.error) onNotice('Educator profile: '+p.error.message)
    else if (p.data) { const row=p.data as EducatorProfile; setProfile(row); setBio(row.professional_bio||''); setExperience(String(row.teaching_experience_years??0)); setLanguages(row.teaching_languages.join(', ')); setSubjects(row.subjects.join(', ')) }
    setTeam((t.data??[]) as TeamMember[])
    setAnalytics((a.data??[]) as Analytics[])
    if (t.error) onNotice('Academy team: '+t.error.message)
    if (a.error) onNotice('Educator analytics: '+a.error.message)
  }

  useEffect(()=>{ void load() },[academyId,userId])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const values={user_id:userId,professional_bio:bio.trim()||null,teaching_experience_years:Number(experience),teaching_languages:languages.split(',').map(x=>x.trim()).filter(Boolean),subjects:subjects.split(',').map(x=>x.trim()).filter(Boolean)}
    const result=profile
      ? await supabase.from('educator_profiles').update(values).eq('user_id',userId)
      : await supabase.from('educator_profiles').insert(values)
    if (result.error) onNotice('Educator profile was not saved: '+result.error.message)
    else { onNotice('Educator profile saved. Verification status remains controlled by Learnora review.'); await load() }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const {error}=await supabase.from('educator_verification_submissions').insert({educator_user_id:userId,credential_type:credentialType,issuer:issuer.trim()||null,credential_reference:credentialReference.trim()||null,document_storage_path:evidencePath.trim()||null,status:'pending'})
    if (error) onNotice('Verification submission was not saved: '+error.message)
    else onNotice('Verification evidence metadata submitted. A reviewer must verify the evidence before your profile can be marked verified.')
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !academyId) return
    const {error}=await supabase.from('academy_memberships').insert({academy_id:academyId,user_id:inviteUserId.trim(),role:inviteRole,status:'invited',invited_by:userId})
    if (error) onNotice('Team invitation was not created: '+error.message)
    else { setInviteUserId(''); onNotice('Team invitation recorded for the Learnora user. The recipient must accept through a future invitation workflow.'); await load() }
  }

  async function requestReview(courseId: string) {
    if (!supabase) return
    const {error}=await supabase.rpc('submit_course_for_review',{p_course_id:courseId})
    if (error) onNotice('Could not submit course for review: '+error.message)
    else { onNotice('Course submitted to the publication review queue. Publication is not automatic.'); await load() }
  }

  return <section className="studio-panel educator-operations">
    <div className="panel-heading"><div><p className="eyebrow">EDUCATOR OPERATIONS</p><h2>Build with credibility.</h2></div><ShieldCheck size={22}/></div>
    <div className="operations-grid">
      <div className="operations-block">
        <div className="builder-subheading"><strong>Professional educator profile</strong><span>{profile?.verification_status??'not started'}</span></div>
        <form className="form-stack builder-form" onSubmit={saveProfile}>
          <label>Professional biography<textarea rows={3} maxLength={3000} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Describe your teaching experience and approach."/></label>
          <label>Years of teaching experience<input type="number" min="0" max="80" value={experience} onChange={e=>setExperience(e.target.value)}/></label>
          <label>Teaching languages<input value={languages} onChange={e=>setLanguages(e.target.value)} placeholder="en, nso, ts, ve"/></label>
          <label>Subjects / specialisations<input value={subjects} onChange={e=>setSubjects(e.target.value)} placeholder="Mathematics, Physical Sciences"/></label>
          <button className="button button-dark" type="submit">Save educator profile</button>
        </form>
      </div>
      <div className="operations-block">
        <div className="builder-subheading"><strong>Credential verification</strong><span>{profile?.verification_status??'unverified'}</span></div>
        <form className="form-stack builder-form" onSubmit={submitVerification}>
          <label>Credential type<select value={credentialType} onChange={e=>setCredentialType(e.target.value)}><option value="teaching_qualification">Teaching qualification</option><option value="academic_qualification">Academic qualification</option><option value="professional_registration">Professional registration</option><option value="experience_reference">Experience reference</option></select></label>
          <label>Issuing institution<input value={issuer} onChange={e=>setIssuer(e.target.value)} placeholder="Institution or professional body"/></label>
          <label>Credential reference<input value={credentialReference} onChange={e=>setCredentialReference(e.target.value)} placeholder="Reference number (if applicable)"/></label>
          <label>Private evidence storage path (optional)<input value={evidencePath} onChange={e=>setEvidencePath(e.target.value)} placeholder="Reserved until secure document upload is enabled"/></label>
          <button className="button button-dark" type="submit">Submit for verification <ClipboardCheck size={15}/></button>
          <p className="form-hint">Do not enter identity numbers or sensitive details in this form. Secure document upload and reviewer tooling are still required before verification can be completed.</p>
        </form>
      </div>
    </div>
    <div className="operations-block team-block">
      <div className="builder-subheading"><strong><Users size={15}/> Academy team</strong><span>{team.length} memberships</span></div>
      {team.length===0?<p className="form-hint">No team memberships yet. The academy owner remains the default manager.</p>:<div className="builder-list">{team.map(member=><div className="builder-list-item static" key={member.id}><span className="builder-index">{member.role.toUpperCase()}</span><span>{member.user_id}<small>{member.status}</small></span></div>)}</div>}
      <form className="team-invite-form" onSubmit={inviteMember}>
        <label>Existing Learnora user ID<input required value={inviteUserId} onChange={e=>setInviteUserId(e.target.value)} placeholder="User UUID"/></label>
        <label>Role<select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}><option value="instructor">Instructor</option><option value="editor">Editor</option><option value="analyst">Analyst</option><option value="admin">Administrator</option></select></label>
        <button className="button button-dark" type="submit">Invite team member</button>
      </form>
      <p className="form-hint">Invitations currently target an existing Learnora user ID. Email invitations and acceptance flow are not yet enabled.</p>
    </div>
    <div className="operations-block">
      <div className="builder-subheading"><strong><BarChart3 size={15}/> Course performance</strong><span>{analytics.length} courses</span></div>
      {loading?<p className="form-hint">Loading performance data…</p>:analytics.length===0?<p className="form-hint">Course analytics will appear as real learners enrol and complete programmes. No sample metrics are generated.</p>:<div className="analytics-table"><div className="analytics-head"><span>COURSE</span><span>ENROLLED</span><span>ACTIVE</span><span>COMPLETED</span></div>{analytics.map(row=><div className="analytics-row" key={row.course_id}><span>{row.title}<small>{row.publication_status}</small></span><span>{row.total_enrolments}</span><span>{row.active_learners}</span><span>{row.completed_learners} <small>{row.completion_rate_percent}%</small></span></div>)}</div>}
    </div>
    <div className="operations-block">
      <div className="builder-subheading"><strong>Publication review</strong><span>Educator submission</span></div>
      <p className="form-hint">Submit a completed draft to the review queue. An authorised reviewer must approve it before it can become discoverable.</p>
      {analytics.filter(x=>x.publication_status==='draft').map(row=><div className="review-row" key={row.course_id}><span>{row.title}</span><button className="button button-outline" type="button" onClick={()=>void requestReview(row.course_id)}>Submit for review</button></div>)}
    </div>
  </section>
}
