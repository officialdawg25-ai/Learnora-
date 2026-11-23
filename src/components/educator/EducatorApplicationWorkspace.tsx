import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FileCheck2, ShieldCheck, UploadCloud, Clock3, BookOpenCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Profile = {
  professional_bio: string | null
  teaching_philosophy: string | null
  teaching_experience_years: number | null
  teaching_languages: string[]
  subjects: string[]
  verification_status: string
  public_display_name: string | null
  teaching_levels: string[]
  public_region: string | null
  professional_category: string | null
  professional_country_code: string
}
type Submission = {
  id: string
  credential_type: string
  issuer: string | null
  credential_reference: string | null
  status: string
  submitted_at: string
  expires_at: string | null
  reviewer_notes: string | null
}
type VerificationEvent = {
  id: string
  submission_id: string
  event_type: string
  previous_status: string | null
  new_status: string | null
  notes: string | null
  created_at: string
}
const categories = [
  ['registered_educator', 'Registered educator'],
  ['provisionally_registered_educator', 'Provisionally registered educator'],
  ['student_educator', 'Student educator'],
  ['private_tutor', 'Private tutor'],
  ['subject_specialist', 'Subject specialist'],
  ['learning_facilitator', 'Learning facilitator'],
  ['institution_affiliated_educator', 'Institution-affiliated educator'],
  ['international_educator', 'International educator'],
]
const credentialTypes = [
  ['sace_registration', 'SACE registration'],
  ['provisional_sace_registration', 'Provisional SACE registration'],
  ['teaching_qualification', 'Teaching qualification'],
  ['academic_qualification', 'Academic qualification'],
  ['foreign_qualification_evaluation', 'Foreign qualification evaluation'],
  ['professional_certification', 'Professional certification'],
  ['identity_evidence', 'Identity evidence'],
  ['experience_reference', 'Teaching experience reference'],
  ['other', 'Other supporting evidence'],
]
const labelFor = (value: string) => value.replaceAll('_', ' ')

export default function EducatorApplicationWorkspace({ userId, onNotice }: { userId: string; onNotice: (s: string) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [country, setCountry] = useState('ZA')
  const [bio, setBio] = useState('')
  const [philosophy, setPhilosophy] = useState('')
  const [experience, setExperience] = useState('0')
  const [languages, setLanguages] = useState('en')
  const [subjects, setSubjects] = useState('')
  const [levels, setLevels] = useState('')
  const [region, setRegion] = useState('')
  const [credentialType, setCredentialType] = useState('sace_registration')
  const [issuer, setIssuer] = useState('')
  const [issuerCountry, setIssuerCountry] = useState('ZA')
  const [credentialReference, setCredentialReference] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [events, setEvents] = useState<VerificationEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!supabase || !userId) { setLoading(false); return }
    setLoading(true)
    const [p, s, e] = await Promise.all([
      supabase.from('educator_profiles').select('professional_bio,teaching_philosophy,teaching_experience_years,teaching_languages,subjects,verification_status,public_display_name,teaching_levels,public_region,professional_category,professional_country_code').eq('user_id', userId).maybeSingle(),
      supabase.from('educator_verification_submissions').select('id,credential_type,issuer,credential_reference,status,submitted_at,expires_at,reviewer_notes').eq('educator_user_id', userId).order('submitted_at', { ascending: false }).limit(30),
      supabase.from('educator_verification_events').select('id,submission_id,event_type,previous_status,new_status,notes,created_at').eq('educator_user_id', userId).order('created_at', { ascending: false }).limit(50),
    ])
    setLoading(false)
    if (p.error) onNotice('Educator application profile: ' + p.error.message)
    else if (p.data) {
      const x = p.data as Profile
      setProfile(x)
      setName(x.public_display_name ?? '')
      setCategory(x.professional_category ?? '')
      setCountry((x.professional_country_code ?? 'ZA').trim())
      setBio(x.professional_bio ?? '')
      setPhilosophy(x.teaching_philosophy ?? '')
      setExperience(String(x.teaching_experience_years ?? 0))
      setLanguages((x.teaching_languages ?? []).join(', '))
      setSubjects((x.subjects ?? []).join(', '))
      setLevels((x.teaching_levels ?? []).join(', '))
      setRegion(x.public_region ?? '')
    }
    if (s.error) onNotice('Credential history: ' + s.error.message)
    else setSubmissions((s.data ?? []) as Submission[])
    if (e.error) onNotice('Verification history: ' + e.error.message)
    else setEvents((e.data ?? []) as VerificationEvent[])
  }

  useEffect(() => { void load() }, [userId])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    if (!category) { onNotice('Select the professional category that accurately describes your teaching pathway.'); return }
    const values = {
      user_id: userId,
      public_display_name: name.trim() || null,
      professional_category: category,
      professional_country_code: country.trim().toUpperCase(),
      professional_bio: bio.trim() || null,
      teaching_philosophy: philosophy.trim() || null,
      teaching_experience_years: Number(experience),
      teaching_languages: languages.split(',').map(x => x.trim()).filter(Boolean),
      subjects: subjects.split(',').map(x => x.trim()).filter(Boolean),
      teaching_levels: levels.split(',').map(x => x.trim()).filter(Boolean),
      public_region: region.trim() || null,
    }
    setBusy(true)
    const result = profile
      ? await supabase.from('educator_profiles').update(values).eq('user_id', userId)
      : await supabase.from('educator_profiles').insert({ ...values, verification_status: 'unverified', public_profile: false })
    setBusy(false)
    if (result.error) onNotice('Application profile was not saved: ' + result.error.message)
    else { onNotice('Professional profile saved. Your category is self-declared until the relevant evidence is reviewed.'); await load() }
  }

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    if (!profile) { onNotice('Save your professional profile before submitting evidence.'); return }
    if (!file) { onNotice('Choose the credential document you want reviewed.'); return }
    if (file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      onNotice('Evidence must be a PDF, JPEG or PNG no larger than 10 MB.')
      return
    }
    if (expiresAt && validFrom && expiresAt < validFrom) { onNotice('The expiry date cannot be earlier than the issue date.'); return }
    setBusy(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
    const path = `${userId}/${crypto.randomUUID()}-${safeName}`
    const upload = await supabase.storage.from('learnora-verification').upload(path, file, { contentType: file.type, upsert: false })
    if (upload.error) { setBusy(false); onNotice('Private evidence upload failed: ' + upload.error.message); return }
    const result = await supabase.from('educator_verification_submissions').insert({
      educator_user_id: userId,
      credential_type: credentialType,
      issuer: issuer.trim() || null,
      issuer_country_code: issuerCountry.trim().toUpperCase(),
      credential_reference: credentialReference.trim() || null,
      document_storage_path: path,
      valid_from: validFrom || null,
      expires_at: expiresAt || null,
      status: 'pending',
    })
    if (result.error) {
      await supabase.storage.from('learnora-verification').remove([path])
      setBusy(false)
      onNotice('Evidence submission failed and its temporary upload was removed: ' + result.error.message)
      return
    }
    setBusy(false)
    setFile(null)
    setCredentialReference('')
    setValidFrom('')
    setExpiresAt('')
    onNotice('Credential evidence submitted. Learnora will record a reviewer decision before granting verified status.')
    await load()
  }

  const verified = profile?.verification_status === 'verified'
  const pending = submissions.filter(x => x.status === 'pending').length

  return <section className="educator-application">
    <header>
      <p className="eyebrow">BUILD WITH LEARNORA · PROFESSIONAL ONBOARDING</p>
      <h1>Bring your expertise <em>forward.</em></h1>
      <p>Tell us about your professional pathway, then submit the evidence relevant to your category. A self-declared profile is not a professional accreditation.</p>
    </header>
    <div className="educator-application-status">
      <ShieldCheck />
      <div>
        <strong>{profile?.verification_status ?? 'Profile not started'}</strong>
        <small>{verified ? 'Your professional verification is approved.' : pending ? `${pending} credential submission(s) awaiting review.` : 'Complete your profile and submit relevant evidence for independent review.'}</small>
      </div>
    </div>
    <div className="educator-onboarding-progress">
      <div><span>01 · Professional profile</span><strong>{profile ? 'Saved' : 'Not started'}</strong></div>
      <div><span>02 · Credential evidence</span><strong>{submissions.length ? `${submissions.length} submitted` : 'Not submitted'}</strong></div>
      <div><span>03 · Independent review</span><strong>{verified ? 'Approved' : 'Pending'}</strong></div>
    </div>
    {loading ? <p className="form-hint">Loading your saved application…</p> : <>
      <form className="educator-application-form" onSubmit={save}>
        <p className="eyebrow">YOUR PROFESSIONAL IDENTITY</p>
        <label>Professional category
          <select required value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Select your category</option>
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Country of professional practice
          <input required minLength={2} maxLength={2} value={country} onChange={e => setCountry(e.target.value.toUpperCase())} placeholder="ZA" />
        </label>
        <label>Professional display name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Your professional name" /></label>
        <label>Professional biography<textarea rows={4} maxLength={3000} value={bio} onChange={e => setBio(e.target.value)} placeholder="Describe your teaching experience and approach." /></label>
        <label>Teaching philosophy<textarea rows={3} maxLength={2000} value={philosophy} onChange={e => setPhilosophy(e.target.value)} placeholder="What principles guide the way you teach?" /></label>
        <label>Subjects / specialisations<input value={subjects} onChange={e => setSubjects(e.target.value)} placeholder="Mathematics, Physical Sciences" /></label>
        <label>Grades, phases or teaching levels<input value={levels} onChange={e => setLevels(e.target.value)} placeholder="Foundation Phase, Senior Phase, Grade 12" /></label>
        <label>Teaching languages<input value={languages} onChange={e => setLanguages(e.target.value)} placeholder="English, Sepedi, Xitsonga" /></label>
        <label>Years of experience<input type="number" min="0" max="80" value={experience} onChange={e => setExperience(e.target.value)} /></label>
        <label>Public region<input value={region} onChange={e => setRegion(e.target.value)} maxLength={100} placeholder="Limpopo, South Africa" /></label>
        <button className="button button-dark" disabled={busy}>{busy ? 'Saving…' : 'Save professional profile'}</button>
      </form>
      <form className="educator-evidence-form" onSubmit={submitEvidence}>
        <div>
          <p className="eyebrow">CREDENTIAL VERIFICATION</p>
          <h2>Submit supporting evidence.</h2>
          <p>Submit each credential separately so Learnora can review its issuer, reference and validity independently. Accepted formats: PDF, JPEG or PNG, up to 10 MB.</p>
        </div>
        <label>Evidence type
          <select value={credentialType} onChange={e => setCredentialType(e.target.value)}>
            {credentialTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Issuing organisation<input value={issuer} onChange={e => setIssuer(e.target.value)} maxLength={180} placeholder="SACE, university or professional body" /></label>
        <label>Issuer country code<input value={issuerCountry} onChange={e => setIssuerCountry(e.target.value.toUpperCase())} minLength={2} maxLength={2} placeholder="ZA" /></label>
        <label>Registration or credential reference<input value={credentialReference} onChange={e => setCredentialReference(e.target.value)} maxLength={160} placeholder="Enter the relevant reference number, if applicable" /></label>
        <div className="form-row">
          <label>Issue date<input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} /></label>
          <label>Expiry date<input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></label>
        </div>
        <label className="educator-evidence-file"><UploadCloud /><span>{file?.name ?? 'Choose credential evidence'}</span><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
        <button className="button button-outline" disabled={busy || !file}>{busy ? 'Submitting…' : 'Submit credential for review'} <FileCheck2 size={14} /></button>
        <p className="form-hint">A submitted SACE number or document is not automatically verified. Learnora does not claim direct SACE, SAQA or identity-provider access unless an authorised integration is configured.</p>
      </form>
      <section className="studio-panel educator-submission-history">
        <div className="panel-heading"><div><p className="eyebrow">YOUR RECORD</p><h2>Credential submissions</h2></div><BookOpenCheck size={22} /></div>
        {submissions.length === 0 ? <p className="form-hint">No credentials have been submitted yet.</p> : submissions.map(item => <article className="admin-row" key={item.id}>
          <div><strong>{labelFor(item.credential_type)}</strong><small>{item.issuer ?? 'Issuer not supplied'} · {item.credential_reference ?? 'No reference supplied'}</small><small>Submitted {new Date(item.submitted_at).toLocaleString()} · {item.status}{item.expires_at ? ` · Expires ${new Date(item.expires_at).toLocaleDateString()}` : ''}</small>{item.reviewer_notes && <small>Reviewer note: {item.reviewer_notes}</small>}</div>
        </article>)}
      </section>
      <section className="studio-panel educator-verification-history">
        <div className="panel-heading"><div><p className="eyebrow">REVIEW HISTORY</p><h2>Verification activity</h2></div><Clock3 size={22} /></div>
        {events.length === 0 ? <p className="form-hint">Review events will appear here as your evidence is processed.</p> : events.map(item => <article className="builder-list-item static" key={item.id}>
          <span className="builder-index">{item.event_type.replaceAll('_', ' ')}</span>
          <span>{item.previous_status ?? 'New'} → {item.new_status ?? 'Recorded'}<small>{new Date(item.created_at).toLocaleString()}{item.notes ? ` · ${item.notes}` : ''}</small></span>
        </article>)}
      </section>
    </>}
  </section>
}
