import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight, BookOpen, GraduationCap, LogOut, Sparkles } from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'

type Course = {
  id: string
  title: string
  summary: string | null
  subject: string | null
  education_level: string | null
  delivery_mode: string
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState<Course[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setCourses([])
      return
    }
    let active = true
    supabase
      .from('courses')
      .select('id,title,summary,subject,education_level,delivery_mode')
      .eq('publication_status', 'published')
      .order('published_at', { ascending: false })
      .limit(12)
      .then(({ data, error }) => {
        if (!active) return
        if (error) setNotice('Your session is active, but the course catalogue could not be loaded.')
        else setCourses((data ?? []) as Course[])
      })
    return () => { active = false }
  }, [session])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setNotice('')
    const result = mode === 'signup'
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (result.error) {
      setNotice(result.error.message)
      return
    }
    if (mode === 'signup' && !result.data.session) {
      setNotice('Check your email to confirm your account. Your profile is created when the account is registered.')
    } else {
      setNotice('You are signed in.')
    }
  }

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    setNotice(error ? error.message : 'You have signed out.')
  }

  if (loading) return <main className="loading-screen"><span className="wordmark">learnora<span>.</span></span><p>Preparing your learning space…</p></main>

  if (!supabaseConfigured) {
    return (
      <main className="setup-screen">
        <span className="wordmark">learnora<span>.</span></span>
        <div className="setup-card">
          <p className="eyebrow">PLATFORM CONFIGURATION</p>
          <h1>Connect your learning environment.</h1>
          <p>Set the Supabase project URL and publishable/anon key in your local environment. No secret or service-role key belongs in this application.</p>
          <code>VITE_SUPABASE_URL</code>
          <code>VITE_SUPABASE_ANON_KEY</code>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="auth-layout">
        <section className="auth-story">
          <span className="wordmark light">learnora<span>.</span></span>
          <div className="story-copy">
            <p className="eyebrow light-text">LEARNING, WITH PURPOSE</p>
            <h1>Where potential becomes possibility.</h1>
            <p>Build understanding. Find your next step. Make progress that means something.</p>
          </div>
          <p className="story-foot">A more connected way to teach and learn.</p>
        </section>
        <section className="auth-panel">
          <div className="auth-form-wrap">
            <p className="eyebrow">YOUR LEARNORA ACCOUNT</p>
            <h2>{mode === 'signin' ? 'Welcome back.' : 'Start your journey.'}</h2>
            <p className="muted">{mode === 'signin' ? 'Continue where your learning left off.' : 'Create one account for your learning and teaching journey.'}</p>
            <form onSubmit={handleAuth}>
              {mode === 'signup' && (
                <label>
                  Your name
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" required maxLength={100} />
                </label>
              )}
              <label>
                Email address
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
              </label>
              <label>
                Password
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required />
              </label>
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={17} />
              </button>
            </form>
            {notice && <p className="notice" role="status">{notice}</p>}
            <p className="switch-mode">
              {mode === 'signin' ? 'New to Learnora?' : 'Already have an account?'}{' '}
              <button type="button" className="text-button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setNotice('') }}>
                {mode === 'signin' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
            <p className="fine-print">By continuing, you agree to use Learnora responsibly. Terms, privacy and child-safeguarding notices must be published before public launch.</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Learnora home">learnora<span>.</span></a>
        <div className="topbar-right">
          <span className="account-email">{session.user.email}</span>
          <button className="icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={18} /></button>
        </div>
      </header>
      <section className="welcome">
        <div>
          <p className="eyebrow">YOUR LEARNING SPACE</p>
          <h1>Make today count.</h1>
          <p className="muted">A focused place to continue learning and discover what comes next.</p>
        </div>
        <div className="welcome-mark"><GraduationCap size={28} strokeWidth={1.4} /></div>
      </section>
      <section className="section-heading">
        <div><p className="eyebrow">DISCOVER</p><h2>Learning opportunities</h2></div>
        <span className="muted small">Published courses</span>
      </section>
      {notice && <p className="notice" role="status">{notice}</p>}
      {courses.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={24} strokeWidth={1.5} />
          <h3>Your next chapter starts here.</h3>
          <p>There are no published courses available in the catalogue yet. When educators publish programmes, they will appear here.</p>
        </div>
      ) : (
        <div className="course-list">
          {courses.map(course => (
            <article className="course-row" key={course.id}>
              <div className="course-icon"><BookOpen size={20} /></div>
              <div className="course-copy">
                <p className="course-meta">{[course.subject, course.education_level, course.delivery_mode.replace('_', ' ')].filter(Boolean).join(' · ')}</p>
                <h3>{course.title}</h3>
                {course.summary && <p className="muted">{course.summary}</p>}
              </div>
              <span className="course-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
            </article>
          ))}
        </div>
      )}
      <footer className="workspace-footer"><Sparkles size={15} /> Learning progress is earned through demonstrated understanding, not time spent watching.</footer>
    </main>
  )
}
