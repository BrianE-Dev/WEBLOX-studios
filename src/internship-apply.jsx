import { useState } from 'react'
import ThemeAwareLogo from './components/ThemeAwareLogo.jsx'
import { submitInternshipApplication } from './lib/internshipApi.js'
import './internship-page.css'

export default function InternshipApply() {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('')
    try {
      await submitInternshipApplication(new FormData(event.currentTarget))
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'We could not submit your application. Please try again.')
    }
  }

  return <main className="internship-page">
    <header className="internship-nav"><a href="/" className="internship-brand"><ThemeAwareLogo /><b>WEBLOX <small>STUDIOS</small></b></a><a className="button secondary" href="/internship">Back to internship</a></header>
    <section className="internship-section">
      <div className="internship-section-heading"><div><span className="eyebrow">CURRENTLY OPEN · THREE MONTHS</span><h1>Apply for Digital Marketing</h1></div><p>Applications are currently open only for the Digital Marketing track. The internship program runs for three months.</p></div>
      {status === 'success' ? <article className="internship-card"><h2>Application received</h2><p>Thank you for applying to the three-month Digital Marketing internship. The WEBLOX team will review your application.</p></article> : <form className="internship-application-form" onSubmit={submit}>
        <label>Full name<input name="fullName" autoComplete="name" required /></label>
        <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
        <label>Phone number<input name="phone" type="tel" autoComplete="tel" required /></label>
        <label>Internship track<input value="Digital Marketing" readOnly /><input type="hidden" name="track" value="Digital Marketing" /></label>
        <label>Program duration<input value="3 months" readOnly /><input type="hidden" name="duration" value="3 months" /></label>
        <label>Current background<input name="background" required placeholder="Student, recent graduate, career starter…" /></label>
        <label className="wide">Relevant skills<textarea name="skills" rows="4" required /></label>
        <label className="wide">Why would you like to join WEBLOX?<textarea name="motivation" rows="5" required /></label>
        <label>Available start date<input name="startDate" type="date" required /></label>
        <label>Weekly availability<input name="availability" required placeholder="For example: weekdays, 20 hours" /></label>
        <label className="wide">CV or résumé<input name="resume" type="file" accept=".pdf,.doc,.docx" required /><small>PDF, DOC, or DOCX. Maximum file size 5 MB.</small></label>
        <label className="wide"><input type="checkbox" name="consent" required /> I confirm that the information provided is accurate.</label>
        {message && <p className="wide" role="alert">{message}</p>}
        <button className="button wide" type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Submitting…' : 'Submit application'}</button>
      </form>}
    </section>
  </main>
}
