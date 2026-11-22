import { useState } from 'react'
import { ArrowDown, ArrowRight, BookOpen, Building2, Check, GraduationCap, LockKeyhole, Menu, ShieldCheck, Users, X } from 'lucide-react'

type Role='parent'|'learner'|'educator'|'institution'
type Props={onSignIn:()=>void;onStart:(role:Role)=>void}

const roles=[
 {number:'01',name:'Parents & guardians',copy:'A clearer view of the learning journey, with meaningful ways to stay involved.',icon:Users,action:'Explore the family experience',role:'parent' as Role},
 {number:'02',name:'Learners',copy:'A considered space to learn independently, build confidence and keep moving forward.',icon:BookOpen,action:'Find your learning space',role:'learner' as Role},
 {number:'03',name:'Educators',copy:'Practical tools to shape learning, understand progress and support every learner.',icon:GraduationCap,action:'Explore educator tools',role:'educator' as Role},
 {number:'04',name:'Institutions',copy:'A connected environment for the people, programmes and structures behind education.',icon:Building2,action:'Create an institution space',role:'institution' as Role},
]

export default function LearnoraLanding({onSignIn,onStart}:Props){
 const [menuOpen,setMenuOpen]=useState(false)
 const start=(role:Role)=>{setMenuOpen(false);onStart(role)}
 const close=()=>setMenuOpen(false)
 return <div className="public-site">
  <header className="public-nav">
   <a className="public-brand" href="#top" aria-label="Learnora home"><span className="public-brand-mark">L</span><span><strong>learnora</strong><small>WHERE POTENTIAL BECOMES POSSIBILITY.</small></span></a>
   <button className="public-menu-toggle" onClick={()=>setMenuOpen(v=>!v)} aria-label={menuOpen?'Close navigation':'Open navigation'}>{menuOpen?<X size={21}/>:<Menu size={21}/>}</button>
   <nav className={menuOpen?'public-nav-links is-open':'public-nav-links'} aria-label="Main navigation">
    <a href="#ecosystem" onClick={close}>The ecosystem</a><a href="#parents" onClick={close}>For parents</a><a href="#learners" onClick={close}>For learners</a><a href="#educators" onClick={close}>For educators</a><a href="#trust" onClick={close}>Our approach</a>
    <button className="public-signin" onClick={()=>{close();onSignIn()}}>Sign in</button><button className="public-nav-cta" onClick={()=>start('parent')}>Get started <ArrowRight size={15}/></button>
   </nav>
  </header>

  <main id="top">
   <section className="public-hero">
    <div className="public-hero-copy">
     <p className="public-kicker"><span/> A CONNECTED EDUCATIONAL EXPERIENCE</p>
     <h1>Every learner<br/>deserves a <em>clearer</em><br/><em>path forward.</em></h1>
     <p className="public-hero-intro">A more connected way to learn, teach and grow. Learnora brings learners, families, educators and institutions into one thoughtful educational experience.</p>
     <div className="public-hero-actions"><button className="public-button dark" onClick={()=>start('parent')}>Discover Learnora <ArrowRight size={16}/></button><a className="public-text-link" href="#ecosystem">Explore the ecosystem <ArrowDown size={15}/></a></div>
     <div className="public-hero-foot"><span>BUILT AROUND PEOPLE</span><i/><span>DESIGNED FOR PROGRESS</span></div>
    </div>
    <div className="public-hero-visual">
     <div className="public-photo-frame"><img src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1500&q=88" alt="Learners working together in a bright classroom" fetchPriority="high"/><div className="public-photo-shade"/></div>
     <div className="public-image-caption"><span>01 / THE LEARNORA ECOSYSTEM</span><strong>Learning is a journey<br/>we shape together.</strong></div>
     <div className="public-connection-card"><span className="connection-card-label">ONE LEARNER. A CONNECTED CIRCLE.</span><div className="connection-people"><span className="connection-person learner"><BookOpen size={16}/></span><i/><span className="connection-person parent"><Users size={16}/></span><i/><span className="connection-person educator"><GraduationCap size={16}/></span></div><div className="connection-labels"><span>LEARNER</span><span>FAMILY</span><span>EDUCATOR</span></div></div>
    </div>
    <span className="public-hero-index">LEARNORA / 001</span>
   </section>

   <section className="public-manifesto">
    <p className="public-kicker">A BETTER WAY TO MOVE FORWARD</p>
    <div className="public-manifesto-grid"><h2>Education is not<br/>one person's work.</h2><div><p>It is a shared journey — shaped by the learner, strengthened by educators, supported by families and made possible by institutions.</p><p>Learnora brings those perspectives together without losing sight of what matters most: the individual learner.</p></div></div>
    <div className="public-role-strip"><span>01 <b>LEARNERS</b></span><span>02 <b>FAMILIES</b></span><span>03 <b>EDUCATORS</b></span><span>04 <b>INSTITUTIONS</b></span></div>
   </section>

   <section className="public-ecosystem" id="ecosystem">
    <div className="public-section-heading"><div><p className="public-kicker">ONE CONNECTED ECOSYSTEM</p><h2>Different roles.<br/><em>One shared purpose.</em></h2></div><p>Each person has a distinct place within Learnora, with an experience designed around the work they do and the information they need.</p></div>
    <div className="public-role-grid">{roles.map(item=>{const Icon=item.icon;return <article className="public-role" key={item.number}><span className="public-role-number">{item.number} / 04</span><div className="public-role-icon"><Icon size={21} strokeWidth={1.5}/></div><h3>{item.name}</h3><p>{item.copy}</p><button onClick={()=>start(item.role)}>{item.action}<ArrowRight size={14}/></button></article>})}</div>
   </section>

   <section className="public-parent-story" id="parents">
    <div className="public-story-image"><img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=88" alt="A learner reading and studying at a desk" loading="lazy"/><div className="public-story-image-note"><span>THE FAMILY CONNECTION</span><strong>Be present in<br/>the moments<br/>that matter.</strong></div></div>
    <div className="public-story-copy"><p className="public-kicker">FOR PARENTS & GUARDIANS</p><h2>Closer to their<br/><em>learning journey.</em></h2><p>Support should come with understanding. Learnora gives parents a dedicated family space to follow authorised academic progress, stay informed and build a constructive connection with educators.</p>
     <ul><li><Check size={15}/>One family view for multiple learners</li><li><Check size={15}/>Academic reports and progress over time</li><li><Check size={15}/>Meaningful parent–educator communication</li><li><Check size={15}/>Learner connections with clear permissions</li></ul>
     <button className="public-button dark" onClick={()=>start('parent')}>Explore the parent experience <ArrowRight size={15}/></button>
     <small>Academic information is shown only where a relationship and the relevant access permissions have been approved.</small>
    </div>
   </section>

   <section className="public-learner-story" id="learners">
    <div className="public-learner-copy"><p className="public-kicker">FOR LEARNERS</p><h2>Your journey.<br/><em>Your next step.</em></h2><p>Learning should feel like progress, not a pile of disconnected tasks. Build your own space for subjects, learning resources, assignments and the milestones that move you forward.</p><button className="public-button light" onClick={()=>start('learner')}>Create a learner account <ArrowRight size={15}/></button></div>
    <div className="public-learning-composition" aria-label="Illustration of a learner's connected learning workspace"><div className="learning-composition-top"><span>LEARNORA / YOUR LEARNING SPACE</span><span>01—04</span></div><div className="learning-composition-title">A little progress,<br/><em>every day.</em></div><div className="learning-composition-lines"><span/><span/><span/></div><div className="learning-composition-footer"><BookOpen size={18}/><span>SUBJECTS · IDEAS · DISCOVERY</span></div><div className="learning-orbit orbit-a"/><div className="learning-orbit orbit-b"/></div>
   </section>

   <section className="public-practice" id="educators">
    <div className="public-section-heading"><div><p className="public-kicker">FOR THE PEOPLE WHO TEACH</p><h2>More room for<br/><em>meaningful teaching.</em></h2></div><p>Bring the practical work of teaching into a considered digital environment — from organising programmes and assessments to understanding learner progress.</p></div>
    <div className="public-practice-grid"><article><span>01 / EDUCATOR STUDIO</span><GraduationCap size={22}/><h3>Teach with clarity.</h3><p>Organise learning programmes, shape course material, manage classes and guide learners with relevant feedback.</p><button onClick={()=>start('educator')}>Explore educator tools <ArrowRight size={14}/></button></article><article><span>02 / INSTITUTION SPACE</span><Building2 size={22}/><h3>Bring your institution together.</h3><p>Connect the people and structures behind education through a shared institutional environment.</p><button onClick={()=>start('institution')}>Explore institution tools <ArrowRight size={14}/></button></article></div>
   </section>

   <section className="public-trust" id="trust">
    <div className="public-trust-symbol"><ShieldCheck size={32} strokeWidth={1.2}/><span>TRUST IS BUILT INTO THE EXPERIENCE</span></div>
    <div className="public-trust-copy"><p className="public-kicker">A RESPONSIBLE FOUNDATION</p><h2>Visibility with care.<br/><em>Access with purpose.</em></h2><p>Educational information deserves thoughtful protection. Learnora is designed around distinct account roles, authorised relationships and access permissions that reflect the purpose of each connection.</p><div className="public-trust-points"><div><LockKeyhole size={17}/><span><strong>Considered access</strong><small>Information is scoped to approved relationships and permissions.</small></span></div><div><Users size={17}/><span><strong>Learner-centred connections</strong><small>Family relationships are not treated as automatic access rights.</small></span></div><div><ShieldCheck size={17}/><span><strong>Clear responsibility</strong><small>Verification and consent remain important parts of the process.</small></span></div></div></div>
   </section>

   <section className="public-closing"><p className="public-kicker">THE NEXT CHAPTER STARTS HERE</p><h2>Education works better<br/>when we move <em>forward together.</em></h2><p>Find your place in a more connected educational experience.</p><button className="public-button dark" onClick={()=>start('parent')}>Join Learnora <ArrowRight size={16}/></button><span className="public-closing-mark">L</span></section>
  </main>

  <footer className="public-footer"><a className="public-brand" href="#top"><span className="public-brand-mark">L</span><span><strong>learnora</strong><small>WHERE POTENTIAL BECOMES POSSIBILITY.</small></span></a><div className="public-footer-links"><a href="#ecosystem">The ecosystem</a><a href="#parents">Parents</a><a href="#learners">Learners</a><a href="#educators">Educators</a><a href="#trust">Trust & privacy</a></div><span>© {new Date().getFullYear()} Learnora. Where potential becomes possibility.</span></footer>
 </div>
}
