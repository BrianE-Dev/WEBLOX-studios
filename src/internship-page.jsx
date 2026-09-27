import ThemeAwareLogo from './components/ThemeAwareLogo.jsx'

const benefits = [
  ['01', 'Real Work', 'Contribute to practical tasks on real WEBLOX projects and initiatives.'],
  ['02', 'Structured Growth', 'Work against clear expectations, deadlines, and documented performance feedback.'],
  ['03', 'Studio Environment', 'See how product, engineering, growth, and operations work together.'],
  ['04', 'Portfolio & Experience', 'Leave with documented evidence of professional contribution.'],
]
const tracks = [
  ['Software Engineering', 'Build and test frontend and backend features, debug systems, and contribute to APIs.'],
  ['UI/UX & Product Design', 'Create user flows, wireframes, prototypes, interfaces, and design systems.'],
  ['Digital Marketing', 'Plan content, support campaigns, track results, and review engagement metrics.'],
  ['Business / Operations', 'Research markets, document workflows, coordinate tasks, and support operational execution.'],
]
const steps = ['Apply', 'Review', 'Onboard', 'Work', 'Check in', 'Grow', 'Complete']

function CertificateSample() {
  return <section className="internship-section internship-certificate-section" id="certificate">
    <div className="internship-section-heading centered"><span className="eyebrow">6 STEP COMPLETION JOURNEY · ACHIEVEMENT CREDENTIAL</span><h2>Proof of Mastery: Certificate of Internship</h2><p>Every graduate leaves with verifiable proof of their contributions: an official WEBLOX certificate of internship detailing track proficiency, shipped venture code, and formal leadership endorsements.</p></div>
    <div className="internship-certificate-layout">
      <div className="internship-certificate-frame"><article className="internship-certificate-art">
        <span className="certificate-corner top-left" /><span className="certificate-corner top-right" /><span className="certificate-corner bottom-left" /><span className="certificate-corner bottom-right" />
        <img className="certificate-watermark" src="/assets/weblox-logo-light.png" alt="" />
        <div className="certificate-wordmark"><img src="/assets/weblox-logo-light.png" alt="WEBLOX Studios" /><span>WEBLOX STUDIOS <small>VENTURE FOUNDRY</small></span></div>
        <span className="certificate-overline">A PRACTICAL VENTURE CONTRIBUTION</span><h3>CERTIFICATE OF INTERNSHIP</h3><span className="certificate-presented">THIS IS PROUDLY PRESENTED TO</span>
        <strong className="certificate-sample-name">Chukwuemeka Nkama</strong>
        <p>For outstanding dedication and successful completion of the WEBLOX Internship Program, contributing practical work to WEBLOX Studio ventures.</p>
        <div className="certificate-sample-details"><span>PROGRAM TRACK<b>Software Engineering</b></span><span>CONTRIBUTION<b>Signarol AI Pipeline</b></span><span>ISSUED<b>Sample preview</b></span><span>CREDENTIAL ID<b>WEBLOX-INT-SAMPLE</b></span></div>
        <div className="certificate-signatures"><span><i />Dr. Tayo Adeyemi<small>Program Director</small></span><span className="certificate-seal">WEBLOX<br />VERIFIED</span><span><i />Anise Mensah<small>Engineering Mentor</small></span></div>
      </article></div>
      <aside className="certificate-details"><span className="eyebrow">DIGITAL CREDENTIAL</span><h3>Credential ready for verification</h3><p>Each issued certificate includes a unique credential ID, a shareable certificate image, and a downloadable PDF.</p><div><small>CREDENTIAL ID</small><code>WEBLOX-INT-SAMPLE</code></div><div><small>ISSUED BY</small><b>WEBLOX Studios</b></div><span className="certificate-sample-label">SAMPLE PREVIEW</span><p className="certificate-detail-note">Official certificates are issued by the WEBLOX master administrator after reviewing an intern’s contribution.</p></aside>
    </div>
  </section>
}

export default function InternshipPage() {
  return <main className="internship-page">
    <header className="internship-nav"><a href="/" className="internship-brand"><ThemeAwareLogo /><b>WEBLOX <small>STUDIOS</small></b></a><nav aria-label="Main navigation"><a href="/ventures">Ventures</a><a href="/services">Services</a><a href="/studio">Studio</a><a href="/insights">Insights</a><a href="/careers">Careers</a><a className="active" href="/internship">Internship</a></nav><div><a className="button secondary" href="/sign-in">Sign in</a><a className="button" href="/internship/apply">Let's build</a></div></header>
    <section className="internship-hero"><div><span className="eyebrow">WEBLOX INTERNSHIP PROGRAM</span><h1>Build. Learn. <em>Ship.</em></h1><p>Practical experience for emerging professionals contributing to real studio work across engineering, product, marketing, and operations.</p><div className="internship-actions"><a className="button" href="/internship/apply">Apply for Internship <span>↗</span></a><a className="button secondary" href="#work">See how it works <span>↓</span></a></div></div><div className="internship-hero-console"><div><i /><i /><i /><span>WEBLOX CORE INTERNSHIP · LIVE</span><b>CONNECTED</b></div><small>AI CORE PIPELINE</small><strong>System online</strong><code>Practical work · reviewed growth<br />Internship contribution active</code><small>PROGRAM TRACK</small><strong>Software Engineering</strong><code>◈ Signarol AI <b>ACTIVE</b><br />◈ Venture Studio <b>IN PROGRESS</b></code></div></section>
    <section className="internship-section" id="work"><div className="internship-section-heading"><div><span className="eyebrow">WHY WEBLOX</span><h2>Learn inside the work.</h2></div><p>The program is designed around practical contribution — not simulated classroom exercises.</p></div><div className="internship-card-grid">{benefits.map(([number, title, copy]) => <article key={number}><small>{number}</small><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    <section className="internship-section internship-shade"><div className="internship-section-heading"><div><span className="eyebrow">INTERNSHIP TRACKS</span><h2>Find your place in the studio.</h2></div><p>Each track is structured for real-world contribution and growth as WEBLOX grows.</p></div><div className="internship-card-grid">{tracks.map(([title, copy], index) => <article key={title}><small>0{index + 1}</small><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    <section className="internship-section" id="process"><div className="internship-section-heading"><div><span className="eyebrow">WORKING WITH US</span><h2>How the internship works.</h2></div><p>A clear path from application to practical, reviewed contribution.</p></div><div className="internship-steps">{steps.map((step, index) => <article key={step}><b>{String(index + 1).padStart(2, '0')}</b><h3>{step}</h3><p>{['Submit an application and share your experience.', 'We review your application and fit.', 'Selected interns receive program onboarding.', 'Contribute to practical studio work.', 'Share regular progress and check-ins.', 'Receive feedback and keep building.', 'Complete your work and receive a certificate.'][index]}</p></article>)}</div><div className="internship-review-grid"><article><span className="eyebrow">DAILY REVIEW</span><h3>Twice-a-day check-in.</h3><p>Morning: set your focus. Evening: send a clear end-of-day update.</p></article><article><span className="eyebrow">PROGRESS REVIEW</span><h3>Weekly performance feedback.</h3><p>Weekly evaluations cover attendance, task completion, quality of work, communication, initiative, and collaboration.</p></article></div></section>
    <CertificateSample />
    <section className="internship-apply"><div><span className="eyebrow">APPLICATIONS</span><h2>Apply for the WEBLOX<br /> Internship Program</h2><p>Ready to contribute to real work and build practical experience? Complete the application form and tell us where you can add value at WEBLOX.</p><a className="button" href="/internship/apply">Apply for Internship <span>↗</span></a><small>Applications are reviewed by the WEBLOX team.</small></div></section>
    <footer className="internship-footer"><a className="internship-brand" href="/"><ThemeAwareLogo /><b>WEBLOX <small>STUDIOS</small></b></a><span>VENTURES · SERVICES · STUDIO · INSIGHTS</span><small>© 2026 WEBLOX Studios. Lagos, Nigeria. Built for the world.</small></footer>
  </main>
}
