import { useEffect, useState } from 'react'
import { BookOpen, Check, Layers3, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type CourseOption = { id: string; title: string; publication_status: string }
type ModuleOption = { id: string; title: string; position: number; description: string | null }
type LessonOption = { id: string; title: string; lesson_type: string; position: number }

type Props = {
  academyId: string
  refreshKey: number
  onNotice: (message: string) => void
}

export default function CourseBuilder({ academyId, refreshKey, onNotice }: Props) {
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [courseId, setCourseId] = useState('')
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [moduleId, setModuleId] = useState('')
  const [lessons, setLessons] = useState<LessonOption[]>([])
  const [moduleTitle, setModuleTitle] = useState('')
  const [moduleDescription, setModuleDescription] = useState('')
  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonBody, setLessonBody] = useState('')
  const [lessonType, setLessonType] = useState<'text' | 'activity'>('text')
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [loadingModules, setLoadingModules] = useState(false)
  const [savingModule, setSavingModule] = useState(false)
  const [savingLesson, setSavingLesson] = useState(false)

  useEffect(() => {
    if (!supabase || !academyId) {
      setCourses([])
      setCourseId('')
      setModules([])
      setModuleId('')
      setLessons([])
      return
    }
    let active = true
    setLoadingCourses(true)
    supabase
      .from('courses')
      .select('id,title,publication_status')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        setLoadingCourses(false)
        if (error) {
          onNotice('Could not load academy courses: ' + error.message)
          return
        }
        const rows = (data ?? []) as CourseOption[]
        setCourses(rows)
        setCourseId(current => rows.some(row => row.id === current) ? current : (rows[0]?.id ?? ''))
      })
    return () => { active = false }
  }, [academyId, refreshKey, onNotice])

  useEffect(() => {
    if (!supabase || !courseId) {
      setModules([])
      setModuleId('')
      setLessons([])
      return
    }
    let active = true
    setLoadingModules(true)
    supabase
      .from('course_modules')
      .select('id,title,position,description')
      .eq('course_id', courseId)
      .order('position', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        setLoadingModules(false)
        if (error) {
          onNotice('Could not load course modules: ' + error.message)
          return
        }
        const rows = (data ?? []) as ModuleOption[]
        setModules(rows)
        setModuleId(current => rows.some(row => row.id === current) ? current : (rows[0]?.id ?? ''))
      })
    return () => { active = false }
  }, [courseId, onNotice])

  useEffect(() => {
    if (!supabase || !moduleId) {
      setLessons([])
      return
    }
    let active = true
    supabase
      .from('lessons')
      .select('id,title,lesson_type,position')
      .eq('module_id', moduleId)
      .order('position', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) onNotice('Could not load module lessons: ' + error.message)
        else setLessons((data ?? []) as LessonOption[])
      })
    return () => { active = false }
  }, [moduleId, onNotice])

  async function addModule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !courseId) return
    setSavingModule(true)
    const { data, error } = await supabase
      .from('course_modules')
      .insert({
        course_id: courseId,
        title: moduleTitle.trim(),
        description: moduleDescription.trim() || null,
        position: modules.length,
      })
      .select('id,title,position,description')
      .single()
    setSavingModule(false)
    if (error) {
      onNotice('Module was not saved: ' + error.message)
      return
    }
    const created = data as ModuleOption
    setModules(current => [...current, created].sort((a, b) => a.position - b.position))
    setModuleId(created.id)
    setModuleTitle('')
    setModuleDescription('')
    onNotice('Module saved to the course.')
  }

  async function addLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !moduleId) return
    setSavingLesson(true)
    const { data, error } = await supabase
      .from('lessons')
      .insert({
        module_id: moduleId,
        title: lessonTitle.trim(),
        lesson_type: lessonType,
        content: { format: 'plain_text', body: lessonBody.trim() },
        position: lessons.length,
        is_preview: false,
      })
      .select('id,title,lesson_type,position')
      .single()
    setSavingLesson(false)
    if (error) {
      onNotice('Lesson was not saved: ' + error.message)
      return
    }
    setLessons(current => [...current, data as LessonOption].sort((a, b) => a.position - b.position))
    setLessonTitle('')
    setLessonBody('')
    onNotice('Lesson saved. It remains inside the unpublished course.')
  }

  if (!academyId) return null

  return (
    <section className="studio-panel course-content-builder">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">COURSE CONTENT STUDIO</p>
          <h2>Build the learning journey.</h2>
        </div>
        <Layers3 size={22} />
      </div>
      <p className="form-hint">Add structured modules and text/activity lessons to your academy's draft courses. Content stays private until a reviewed publishing workflow is available.</p>

      {loadingCourses ? <p className="form-hint">Loading courses…</p> : courses.length === 0 ? (
        <div className="callout"><BookOpen size={18} /><p>Create a draft course above. It will appear here for module and lesson authoring.</p></div>
      ) : (
        <>
          <label className="builder-select">Course
            <select value={courseId} onChange={event => setCourseId(event.target.value)}>
              {courses.map(course => <option key={course.id} value={course.id}>{course.title} · {course.publication_status}</option>)}
            </select>
          </label>

          <div className="builder-columns">
            <div>
              <div className="builder-subheading"><strong>Modules</strong><span>{modules.length}</span></div>
              {loadingModules ? <p className="form-hint">Loading modules…</p> : modules.length === 0 ? <p className="form-hint">No modules yet. Add the first one below.</p> : (
                <div className="builder-list">
                  {modules.map((module, index) => (
                    <button type="button" key={module.id} className={moduleId === module.id ? 'builder-list-item selected' : 'builder-list-item'} onClick={() => setModuleId(module.id)}>
                      <span className="builder-index">{String(index + 1).padStart(2, '0')}</span>
                      <span>{module.title}</span>
                      {moduleId === module.id && <Check size={15} />}
                    </button>
                  ))}
                </div>
              )}
              <form className="form-stack builder-form" onSubmit={addModule}>
                <label>New module title<input required maxLength={120} value={moduleTitle} onChange={event => setModuleTitle(event.target.value)} placeholder="e.g. Algebra foundations" /></label>
                <label>Module description<textarea rows={2} maxLength={500} value={moduleDescription} onChange={event => setModuleDescription(event.target.value)} placeholder="What will this module cover?" /></label>
                <button className="button button-dark" type="submit" disabled={savingModule || !courseId}>{savingModule ? 'Saving…' : 'Add module'} <Plus size={15} /></button>
              </form>
            </div>

            <div>
              <div className="builder-subheading"><strong>Lessons</strong><span>{lessons.length}</span></div>
              {!moduleId ? <p className="form-hint">Choose or create a module to add lessons.</p> : lessons.length === 0 ? <p className="form-hint">No lessons in this module yet.</p> : (
                <div className="builder-list">
                  {lessons.map((lesson, index) => (
                    <div className="builder-list-item static" key={lesson.id}>
                      <span className="builder-index">{String(index + 1).padStart(2, '0')}</span>
                      <span>{lesson.title}<small>{lesson.lesson_type}</small></span>
                    </div>
                  ))}
                </div>
              )}
              <form className="form-stack builder-form" onSubmit={addLesson}>
                <label>Lesson title<input required maxLength={140} value={lessonTitle} onChange={event => setLessonTitle(event.target.value)} placeholder="e.g. Understanding linear equations" /></label>
                <label>Lesson format<select value={lessonType} onChange={event => setLessonType(event.target.value as 'text' | 'activity')}><option value="text">Reading / explanation</option><option value="activity">Guided activity</option></select></label>
                <label>Lesson content<textarea required rows={5} maxLength={20000} value={lessonBody} onChange={event => setLessonBody(event.target.value)} placeholder="Write the lesson explanation or activity instructions…" /></label>
                <button className="button button-dark" type="submit" disabled={savingLesson || !moduleId}>{savingLesson ? 'Saving…' : 'Add lesson'} <Plus size={15} /></button>
              </form>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
