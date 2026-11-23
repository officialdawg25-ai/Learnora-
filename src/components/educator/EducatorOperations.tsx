import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BarChart3, ClipboardCheck, ShieldCheck, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AssessmentBuilder from './AssessmentBuilder'
import EducatorFamilyMessages from './EducatorFamilyMessages'
import './EducatorFamilyMessages.css'

type Props = { academyId: string; userId: string; onNotice: (message: string) => void }
type Analytics = { course_id: string; title: string; publication_status: string; total_enrolments: number; active_learners: number; completed_learners: number; completion_rate_percent: number }
type TeamMember = { id: string; user_id: string; role: string; status: string }
type EducatorProfile = { professional_bio: string | null; teaching_philosophy:string|null; professional_category:string|null; professional_country_code:string; teaching_experience_years: number | null; teaching_languages: string[]; subjects: string[]; verification_status: string; public_display_name:string|null; teaching_levels:string[]; public_region:string|null; public_profile:boolean }

export default function EducatorOperations({ academyId, userId, onNotice }: Props) {
  const [profile, setProfile] = useState<EducatorProfile | null>(null)
  const [bio, setBio] = useState('')
  const [experience, setExperience] = useState('0')
  const [languages, setLanguages] = useState('en')
  const [subjects, setSubjects] = useState('')
  const [publicName,setPublicName]=useState('')
  const [teachingLevels,setTeachingLevels]=useState('')
  const [publicRegion,setPublicRegion]=useState('')
  const [publicProfile,setPublicProfile]=useState(false)
  const [professionalCategory,setProfessionalCategory]=useState('')
  const [professionalCountry,setProfessionalCountry]=useState('ZA')
  const [teachingPhilosophy,setTeachingPhilosophy]=useState('')
  const [credentialType, setCredentialType] = useState('teaching_qualification')
  const [issuer, setIssuer] = useState('')
  const [credentialReference, setCredentialReference] = useState('')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
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
    const [p,t,a] = await Promise.all([
      supabase.from('educator_profiles').select('professional_bio,teaching_philosophy,professional_category,professional_country_code,teaching_experience_years,teaching_languages,subjects,verification_status,public_display_name,teaching_levels,public_region,public_profile').eq('user_id',userId).maybeSingle(),
      academyId ? supabase.from('academy_memberships').select('id,user_id,role,status').eq('academy_id',academyId).order('created_at') : Promise.resolve({data:[],error:null}),
      academyId ? supabase.from('educator_course_analytics').select('*').eq('academy_id',academyId).order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null})
    ])
    setLoading(false)
    if (p.error) onNotice('Educator profile: '+p.error.message)
    else if (p.data) { const row=p.data as EducatorProfile; setProfile(row); setBio(row.professional_bio||''); setTeachingPhilosophy(row.teaching_philosophy??''); setProfessionalCategory(row.professional_category??''); setProfessionalCountry((row.professional_country_code??'ZA').trim()); setExperience(String(row.teaching_experience_years??0)); setLanguages(row.teaching_languages.join(', ')); setSubjects(row.subjects.join(', ')); setPublicName(row.public_display_name??''); setTeachingLevels((row.teaching_levels??[]).join(', ')); setPublicRegion(row.public_region??''); setPublicProfile(!!row.public_profile) }
    setTeam((t.data??[]) as TeamMember[])
    setAnalytics((a.data??[]) as Analytics[])
    if(a.data?.length)setKnowledgeCourseId(current=>a.data.some((x:any)=>x.course_id===current)?current:a.data[0].course_id)
    if (t.error) onNotice('Academy team: '+t.error.message)
    if (a.error) onNotice('Educator analytics: '+a.error.message)
  }

  useEffect(()=>{ void load() },[academyId,userId])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    if(!professionalCategory){onNotice('Select your professional category before saving.');return}\n    const values={user_id:userId,professional_category:professionalCategory,professional_country_code:professionalCountry.trim().toUpperCase(),professional_bio:bio.trim()||null,teaching_philosophy:teachingPhilosophy.trim()||null,teaching_experience_years:Number(experience),teaching_languages:languages.split(',').map(x=>x.trim()).filter(Boolean),subjects:subjects.split(',').map(x=>x.trim()).filter(Boolean),public_display_name:publicName.trim()||null,teaching_levels:teachingLevels.split(',').map(x=>x.trim()).filter(Boolean),public_region:publicRegion.trim()||null,public_profile:profile?.verification_status==='verified'&&publicProfile}
    const result=profile
      ? await supabase.from('educator_profiles').update(values).eq('user_id',userId)
      : await supabase.from('educator_profiles').insert(values)
    if (result.error) onNotice('Educator profile was not saved: '+result.error.message)
    else { onNotice('Educator profile saved. Verification status remains controlled by Learnora review.'); await load() }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    if (!evidenceFile) { onNotice('Attach a PDF, JPEG or PNG credential document before submitting.'); return }
    if (evidenceFile.size > 10 * 1024 * 1024 || !['application/pdf','image/jpeg','image/png'].includes(evidenceFile.type)) { onNotice('Evidence must be a PDF, JPEG or PNG no larger than 10 MB.'); return }
    const safeName=evidenceFile.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)
    const storagePath=`${userId}/${crypto.randomUUID()}-${safeName}`
    const {error:uploadError}=await supabase.storage.from('learnora-verification').upload(storagePath,evidenceFile,{contentType:evidenceFile.type,upsert:false})
    if(uploadError){onNotice('Private evidence upload failed: '+uploadError.message);return}
    const {error}=await supabase.from('educator_verification_submissions').insert({educator_user_id:userId,credential_type:credentialType,issuer:issuer.trim()||null,credential_reference:credentialReference.trim()||null,document_storage_path:storagePath,status:'pending'})
    if (error) onNotice('Evidence uploaded privately, but the submission record was not saved: '+error.message)
    else { setEvidenceFile(null); onNotice('Verification evidence submitted to private storage. A reviewer must verify it before your profile can be marked verified.') }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !academyId) return
    const {error}=await supabase.from('academy_memberships').insert({academy_id:academyId,user_id:inviteUserId.trim(),role:inviteRole,status:'invited',invited_by:userId})
    if (error) onNotice('Team invitation was not created: '+error.message)
    else { setInviteUserId(''); onNotice('Team invitation created. The recipient can review and accept it from the Invitations workspace.'); await load() }
  }

  async function requestReview(courseId: string) {
    if (!supabase) return
    const {error}=await supabase.rpc('submit_course_for_review',{p_course_id:courseId})
    if (error) onNotice('Could not submit course for review: '+error.message)
    else { onNotice('Course submitted to the publication review queue. Publication is not automatic.'); await load() }
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
      <div className="operations-block">
        <div className="builder-subheading"><strong>Professional educator profile</strong><span>{profile?.verification_status??'not started'}</span></div>
        <form className="form-stack builder-form" onSubmit={saveProfile}>
          <label>Professional category<select required value={professionalCategory} onChange={e=>setProfessionalCategory(e.target.value)}><option value="">Select your category</option><option value="registered_educator">Registered educator</option><option value="provisionally_registered_educator">Provisionally registered educator</option><option value="student_educator">Student educator</option><option value="private_tutor">Private tutor</option><option value="subject_specialist">Subject specialist</option><option value="learning_facilitator">Learning facilitator</option><option value="institution_affiliated_educator">Institution-affiliated educator</option><option value="international_educator">International educator</option></select></label>\n          <label>Professional country code<input required minLength={2} maxLength={2} value={professionalCountry} onChange={e=>setProfessionalCountry(e.target.value.toUpperCase())}/></label>\n          <label>Professional biography<textarea rows={3} maxLength={3000} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Describe your teaching experience and approach."/></label>\n          <label>Teaching philosophy<textarea rows={3} maxLength={2000} value={teachingPhilosophy} onChange={e=>setTeachingPhilosophy(e.target.value)} placeholder="What principles guide your teaching?"/></label>
          <label>Years of teaching experience<input type="number" min="0" max="80" value={experience} onChange={e=>setExperience(e.target.value)}/></label>
          <label>Teaching languages<input value={languages} onChange={e=>setLanguages(e.target.value)} placeholder="en, nso, ts, ve"/></label>
          <label>Subjects / specialisations<input value={subjects} onChange={e=>setSubjects(e.target.value)} placeholder="Mathematics, Physical Sciences"/></label>
          <label>Public display name<input value={publicName} onChange={e=>setPublicName(e.target.value)} maxLength={100} placeholder="Name shown on your educator profile"/></label>
          <label>Teaching levels<input value={teachingLevels} onChange={e=>setTeachingLevels(e.target.value)} placeholder="Primary, Secondary, University"/></label>
          <label>Public region<input value={publicRegion} onChange={e=>setPublicRegion(e.target.value)} maxLength={100} placeholder="e.g. Limpopo, South Africa"/></label>
          <label className="discover-optin"><input type="checkbox" checked={publicProfile} disabled={profile?.verification_status!=='verified'} onChange={e=>setPublicProfile(e.target.checked)}/> Publish my educator profile in Discover (available after verification)</label>
          <button className="button button-dark" type="submit">Save educator profile</button>
        </form>
      </div>
      <div className="operations-block">
        <div className="builder-subheading"><strong>Credential verification</strong><span>{profile?.verification_status??'unverified'}</span></div>
        <form className="form-stack builder-form" onSubmit={submitVerification}>
          <label>Credential type<select value={credentialType} onChange={e=>setCredentialType(e.target.value)}><option value="teaching_qualification">Teaching qualification</option><option value="academic_qualification">Academic qualification</option><option value="professional_registration">Professional registration</option><option value="experience_reference">Experience reference</option></select></label>
          <label>Issuing institution<input value={issuer} onChange={e=>setIssuer(e.target.value)} placeholder="Institution or professional body"/></label>
          <label>Credential reference<input value={credentialReference} onChange={e=>setCredentialReference(e.target.value)} placeholder="Reference number (if applicable)"/></label>
          <label>Credential evidence document<input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e=>setEvidenceFile(e.target.files?.[0]??null)}/></label>{evidenceFile&&<p className="form-hint">Selected: {evidenceFile.name}</p>}
          <button className="button button-dark" type="submit">Submit for verification <ClipboardCheck size={15}/></button>
          <p className="form-hint">Documents are private and limited to PDF/JPEG/PNG files up to 10 MB. Only the submitting educator can read their upload through the application. Reviewer tooling is still required before verification can be completed.</p>
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
    <div className="operations-block">
      <div className="builder-subheading"><strong>Publication review</strong><span>Educator submission</span></div>
      <p className="form-hint">Submit a completed draft to the review queue. An authorised reviewer must approve it before it can become discoverable.</p>
      {analytics.filter(x=>x.publication_status==='draft').map(row=><div className="review-row" key={row.course_id}><span>{row.title}</span><button className="button button-outline" type="button" onClick={()=>void requestReview(row.course_id)}>Submit for review</button></div>)}
    </div>
  </section><EducatorFamilyMessages userId={userId} onNotice={onNotice}/><AssessmentBuilder academyId={academyId} userId={userId} onNotice={onNotice}/></>
}
