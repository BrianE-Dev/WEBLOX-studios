import { useCallback, useEffect, useState } from 'react'
import { authRequest, clearStaffSession, saveStaffSession } from './lib/staffAuth.js'
import ThemeSettings, { useThemePreference } from './components/ThemeSettings.jsx'
import ImageLibrary from './components/ImageLibrary.jsx'
import ThemeAwareLogo from './components/ThemeAwareLogo.jsx'
import PageLoadingSkeleton from './components/PageLoadingSkeleton.jsx'
import DashboardNavIcon from './components/DashboardNavIcon.jsx'
import PortfolioPresentation from './components/PortfolioPresentation.jsx'
import { absoluteImageUrl, uploadDashboardImage } from './lib/imageLibrary.js'
import './master-online.css'

const pages = ['overview', 'people', 'applicants', 'tracks', 'history', 'certificates', 'images', 'settings', 'portfolio']
const fmt = (value) => value ? new Date(value).toLocaleString() : '—'
const date = (value) => value ? new Date(value).toLocaleDateString() : '—'
const splitList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
const rowsToText = (items = [], keys = []) => items.map((item) => keys.map((key) => Array.isArray(item[key]) ? item[key].join(', ') : item[key] || '').join(' | ')).join('\n')
const textToRows = (value, keys) => String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
  const values = line.split('|').map((part) => part.trim())
  return Object.fromEntries(keys.map((key, index) => [key, key === 'technologies' ? splitList(values[index]) : values[index] || '']))
}).filter((item) => Object.values(item).some(Boolean)).map((item) => ({ id: crypto.randomUUID(), ...item }))

async function adminRequest(path, options = {}) {
  const response = await fetch(path, { ...options, credentials: 'include', headers: { 'content-type': 'application/json', ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Request failed.')
  return data
}

function Notice({ children, success = false }) {
  return <p className={`master-notice${success ? ' success' : ''}`} role="status">{children}</p>
}

export default function MasterAdmin() {
  const [account, setAccount] = useState(null)
  const [loginReady, setLoginReady] = useState(false)
  const [page, setPage] = useState(() => pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loginNotice, setLoginNotice] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [staff, setStaff] = useState([])
  const [onlineStaff, setOnlineStaff] = useState(null)
  const [interns, setInterns] = useState([])
  const [admins, setAdmins] = useState([])
  const [applications, setApplications] = useState([])
  const [internshipTracks, setInternshipTracks] = useState([])
  const [trackNotice, setTrackNotice] = useState({ text: '', success: false })
  const [trackBusy, setTrackBusy] = useState('')
  const [activity, setActivity] = useState({ staffActivity: [], internCheckins: [], audit: [] })
  const [workspace, setWorkspace] = useState({ recipients: [], sentMessages: [] })
  const [attendance, setAttendance] = useState(null)
  const [attendanceNotice, setAttendanceNotice] = useState('')
  const [notice, setNotice] = useState({ text: '', success: false })
  const [messageNotice, setMessageNotice] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [messageBusy, setMessageBusy] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState('')
  const [portfolio, setPortfolio] = useState({ status: 'draft', updatedAt: null, slug: '' })
  const [projectRows, setProjectRows] = useState([])
  const [portfolioMetrics, setPortfolioMetrics] = useState([])
  const [portfolioPreview, setPortfolioPreview] = useState({ layout: 'editorial', accentColor: '#a259ff', skills: [], projects: [], metrics: [] })
  const [portfolioNotice, setPortfolioNotice] = useState('')
  const [theme, setTheme] = useThemePreference()
  const [portfolioBusy, setPortfolioBusy] = useState(false)
  const [portfolioPhotoUrl, setPortfolioPhotoUrl] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [certificates, setCertificates] = useState([])
  const [certificateNotice, setCertificateNotice] = useState('')
  const [certificateBusy, setCertificateBusy] = useState(false)
  const [certificateSignatures, setCertificateSignatures] = useState({ signature1Url: '', signature2Url: '' })

  useEffect(() => { document.documentElement.dataset.theme = localStorage.getItem('weblox-theme') || 'dark' }, [])

  const refreshStaff = useCallback(async () => setStaff((await adminRequest('/api/admin/staff')).staff), [])
  const refreshOnlineStaff = useCallback(async () => {
    try {
      const result = await adminRequest('/api/admin/staff/online')
      setOnlineStaff(result.staff || [])
    } catch {
      setOnlineStaff(null)
    }
  }, [])
  const refreshInterns = useCallback(async () => setInterns((await adminRequest('/api/admin/interns')).interns), [])
  const refreshAdmins = useCallback(async () => setAdmins((await adminRequest('/api/admin/admins')).admins), [])
  const refreshApplicants = useCallback(async () => setApplications((await adminRequest('/api/admin/internship-applications')).applications), [])
  const refreshInternshipTracks = useCallback(async () => setInternshipTracks((await adminRequest('/api/admin/internship-tracks')).tracks), [])
  const refreshCertificates = useCallback(async () => setCertificates((await adminRequest('/api/admin/certificates')).certificates), [])
  const refreshActivity = useCallback(async () => {
    const data = await adminRequest('/api/admin/activity')
    setActivity({ staffActivity: data.staffActivity || [], internCheckins: data.internCheckins || [], audit: data.audit || [] })
  }, [])
  const refreshWorkspace = useCallback(async () => setWorkspace(await adminRequest('/api/admin/workspace/recipients')), [])

  const loadMasterPortfolio = useCallback(async () => {
    const { portfolio: record } = await adminRequest('/api/admin/portfolio/me')
    const draft = record?.draft || {}
    setPortfolioPhotoUrl(draft.photoUrl || '')
    setPortfolioMetrics((draft.metrics || []).map((item) => ({ ...item, id: item.id || crypto.randomUUID() })))
    setPortfolioPreview({ layout: 'editorial', accentColor: '#a259ff', skills: [], socialLinks: {}, ...draft, photoUrl: draft.photoUrl || '' })
    const form = document.getElementById('masterPortfolioForm')
    if (form) {
      for (const field of form.elements) if (field.name) {
        const listText = {
          metricsText: rowsToText(draft.metrics, ['value', 'label', 'detail']),
          experienceText: rowsToText(draft.experience, ['title', 'organization', 'location', 'startDate', 'endDate', 'technologies', 'description']),
          educationText: rowsToText(draft.education, ['qualification', 'institution', 'location', 'startDate', 'endDate', 'description']),
          repositoriesText: rowsToText(draft.repositories, ['name', 'language', 'stars', 'url', 'description']),
          testimonialsText: rowsToText(draft.testimonials || draft.recommendations, ['quote', 'name', 'title', 'organization']),
        }
        field.value = field.name === 'skills' ? (draft.skills || []).join(', ') : ['linkedin', 'github', 'website', 'instagram'].includes(field.name) ? draft.socialLinks?.[field.name] || '' : field.name === 'layout' ? draft.layout || 'editorial' : field.name === 'accentColor' ? draft.accentColor || '#a259ff' : Object.hasOwn(listText, field.name) ? listText[field.name] : draft[field.name] || ''
      }
    }
    setProjectRows((draft.projects || []).map((project) => ({ ...project, technologiesText: (project.technologies || []).join(', ') })))
    setPortfolio(record || { status: 'draft' })
  }, [])

  const loadAll = useCallback(async () => {
    const results = await Promise.allSettled([refreshStaff(), refreshOnlineStaff(), refreshInterns(), refreshAdmins(), refreshApplicants(), refreshInternshipTracks(), refreshActivity(), refreshWorkspace(), loadMasterPortfolio(), refreshCertificates()])
    const error = results.find((result) => result.status === 'rejected')
    if (error) setNotice({ text: error.reason?.message || 'Some administrator data could not be loaded.', success: false })
  }, [refreshStaff, refreshOnlineStaff, refreshInterns, refreshAdmins, refreshApplicants, refreshInternshipTracks, refreshActivity, refreshWorkspace, loadMasterPortfolio, refreshCertificates])

  useEffect(() => {
    let active = true
    authRequest('/session').then(async ({ account: current }) => {
      if (!active) return
      if (current?.accountType !== 'master_admin') {
        await authRequest('/logout', { method: 'POST' }).catch(() => {})
        clearStaffSession()
        setLoginReady(true)
        return
      }
      saveStaffSession(current)
      setAccount(current)
      setLoginReady(true)
    }).catch(() => { if (active) { clearStaffSession(); setLoginReady(true) } })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (loginReady) window.webloxDismissBrandedLoader?.()
  }, [loginReady])

  useEffect(() => {
    if (!account) return undefined
    let active = true
    loadAll().then(() => { if (!active) return })
    adminRequest('/api/staff/attendance').then((result) => { if (active) setAttendance(result.attendance) }).catch((error) => { if (active) setAttendanceNotice(error.message) })
    const timer = setInterval(() => Promise.allSettled([refreshStaff(), refreshInterns(), refreshAdmins(), refreshApplicants(), refreshInternshipTracks(), refreshActivity()]), 30_000)
    return () => { active = false; clearInterval(timer) }
  }, [account, loadAll, refreshStaff, refreshInterns, refreshAdmins, refreshApplicants, refreshInternshipTracks, refreshActivity])

  useEffect(() => {
    if (!account) return undefined
    refreshOnlineStaff()
    const timer = setInterval(refreshOnlineStaff, 30_000)
    return () => clearInterval(timer)
  }, [account, refreshOnlineStaff])

  useEffect(() => {
    const sync = () => setPage(pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview')
    addEventListener('hashchange', sync)
    return () => removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    if (account && page === 'portfolio') loadMasterPortfolio().catch((error) => setPortfolioNotice(error.message))
  }, [account, page, loadMasterPortfolio])

  const showPage = (next) => {
    setPage(next)
    setSidebarOpen(false)
    if (location.hash !== `#${next}`) history.replaceState(null, '', `#${next}`)
    if (next === 'applicants') refreshApplicants().catch((error) => setNotice({ text: error.message, success: false }))
    if (next === 'tracks') refreshInternshipTracks().catch((error) => setTrackNotice({ text: error.message, success: false }))
    if (next === 'history') refreshWorkspace().catch((error) => setMessageNotice(error.message))
    if (matchMedia('(max-width: 800px)').matches) requestAnimationFrame(() => document.querySelector('.master-pages')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const signIn = async (event) => {
    event.preventDefault(); setLoginBusy(true); setLoginNotice('')
    const form = event.currentTarget
    try {
      const { account: current } = await authRequest('/login', { method: 'POST', body: JSON.stringify({ email: form.elements.email.value.trim().toLowerCase(), password: form.elements.password.value }) })
      if (current.accountType !== 'master_admin') {
        await authRequest('/logout', { method: 'POST' }).catch(() => {})
        clearStaffSession()
        throw new Error('This login is not a master administrator account.')
      }
      saveStaffSession(current); setAccount(current); setLoginReady(true)
      window.webloxShowBrandedLoader?.()
      location.assign('/master-admin.html')
    } catch (error) { setLoginNotice(error.message || 'Could not sign in.') }
    finally { setLoginBusy(false) }
  }

  const signOut = async () => {
    await authRequest('/logout', { method: 'POST' }).catch(() => {})
    clearStaffSession(); location.reload()
  }

  const updateAttendance = async (action) => {
    try {
      const result = await adminRequest('/api/staff/attendance', action ? { method: 'POST', body: JSON.stringify({ action }) } : {})
      setAttendance(result.attendance)
      setAttendanceNotice(action === 'clock_in' ? 'Clock-in recorded.' : action === 'clock_out' ? 'Clock-out recorded.' : '')
    } catch (error) { setAttendanceNotice(error.message) }
  }

  const submitForm = async (event, path, onSuccess, successText, noticeTarget = 'main') => {
    event.preventDefault()
    const form = event.currentTarget
    try {
      await adminRequest(path, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) })
      form.reset()
      if (form.elements.role && noticeTarget === 'intern') form.elements.role.value = 'Intern'
      await onSuccess?.()
      setNotice({ text: successText, success: true })
    } catch (error) { setNotice({ text: error.message || 'Request failed.', success: false }) }
  }

  const updatePerson = async (person, type, action) => {
    if (action === 'remove' && !confirm(`Remove ${person.email} from active ${type}?`)) return
    try {
      if (type === 'staff' && !person.activated) {
        if (action === 'restore') return
        await adminRequest(`/api/admin/staff-directory/${encodeURIComponent(person.email)}`, { method: 'DELETE' })
      } else {
        const path = `/api/admin/${type}/${encodeURIComponent(person.id)}${action === 'restore' ? '/restore' : ''}`
        await adminRequest(path, { method: action === 'remove' ? 'DELETE' : 'POST' })
      }
      await Promise.all([refreshStaff(), refreshInterns()])
    } catch (error) { setNotice({ text: error.message, success: false }) }
  }

  const editPerson = async (person, type) => {
    const name = prompt(`${type === 'staff' ? 'Staff member' : 'Intern'} name`, person.name || '')
    if (name === null) return
    const email = prompt('Email address', person.email || '')
    if (email === null) return
    const role = prompt(type === 'staff' ? 'Staff role' : 'Program or track', person.role || '')
    if (role === null) return
    const jobType = prompt('Job type', person.jobType || (type === 'staff' ? 'Full-time' : 'Internship'))
    if (jobType === null) return
    const gender = prompt('Gender (Male or Female)', person.gender || '')
    if (gender === null) return
    try {
      if (type === 'staff' && !person.activated) {
        await adminRequest(`/api/admin/staff-directory/${encodeURIComponent(person.email)}`, { method: 'PUT', body: JSON.stringify({ name, role, jobType }) })
      } else {
        await adminRequest(`/api/admin/${type}/${encodeURIComponent(person.id)}`, { method: 'PUT', body: JSON.stringify({ ...(type === 'staff' ? { oldEmail: person.email } : {}), name, email, role, jobType, gender }) })
      }
      await Promise.all([refreshStaff(), refreshInterns()])
    } catch (error) { setNotice({ text: error.message || 'Could not update account.', success: false }) }
  }

  const updateAdmin = async (person) => {
    if (!confirm(`Remove administrator access for ${person.email}?`)) return
    try { await adminRequest(`/api/admin/admins/${encodeURIComponent(person.id)}`, { method: 'DELETE' }); await refreshAdmins() }
    catch (error) { setNotice({ text: error.message, success: false }) }
  }

  const downloadResume = async (application) => {
    try {
      const response = await fetch(`/api/admin/internship-applications/${application.id}/resume`, { credentials: 'include' })
      if (!response.ok) throw new Error('Could not download applicant CV.')
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = application.resume.name; anchor.click(); URL.revokeObjectURL(url)
    } catch (error) { alert(error.message) }
  }

  const selectGroup = (type) => setSelectedRecipients(type === 'none' ? [] : workspace.recipients.filter((person) => type === 'all' || person.accountType === type).map((person) => person.id))
  const toggleRecipient = (id) => setSelectedRecipients((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!selectedRecipients.length) { setMessageNotice('Select at least one recipient.'); return }
    setMessageBusy(true)
    const form = event.currentTarget
    try {
      const result = await adminRequest('/api/admin/workspace/messages', { method: 'POST', body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), recipientIds: selectedRecipients }) })
      setMessageNotice(`Sent to ${result.recipientCount} recipients.`); form.reset(); setSelectedRecipients([]); await refreshWorkspace()
    } catch (error) { setMessageNotice(error.message || 'Could not send the message.') }
    finally { setMessageBusy(false) }
  }

  const loadWeeklyReport = async () => {
    try {
      const report = await adminRequest('/api/admin/workspace/report-preview')
      const form = document.getElementById('workspaceMessageForm')
      form.elements.type.value = 'weekly_report'; form.elements.subject.value = report.subject; form.elements.body.value = report.body
      setMessageNotice(report.alreadySent ? 'The scheduled report was already sent; this manual send will create another copy.' : 'Weekly report loaded.')
    } catch (error) { setMessageNotice(error.message) }
  }

  const addProject = () => setProjectRows((rows) => [...rows, { title: '', category: '', description: '', technologiesText: '', imageUrl: '', liveUrl: '', sourceUrl: '' }])
  const updateProject = (index, key, value) => setProjectRows((rows) => rows.map((row, item) => item === index ? { ...row, [key]: value } : row))

  const uploadPortfolioPhoto = async (event) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setPhotoBusy(true)
    try {
      const image = await uploadDashboardImage(file)
      setPortfolioPhotoUrl(absoluteImageUrl(image))
      setPortfolioNotice('Profile picture uploaded. Save your portfolio to keep this change.')
    } catch (error) {
      setPortfolioNotice(error.message || 'Could not upload the profile picture.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const updatePortfolioPreview = (form = document.getElementById('masterPortfolioForm')) => {
    if (!form) return
    const values = Object.fromEntries(new FormData(form))
    setPortfolioPreview({
      ...values,
      photoUrl: portfolioPhotoUrl,
      skills: splitList(values.skills),
      socialLinks: { linkedin: values.linkedin, github: values.github, website: values.website, instagram: values.instagram },
      metrics: portfolioMetrics,
      experience: textToRows(values.experienceText, ['title', 'organization', 'location', 'startDate', 'endDate', 'technologies', 'description']),
      education: textToRows(values.educationText, ['qualification', 'institution', 'location', 'startDate', 'endDate', 'description']),
      repositories: textToRows(values.repositoriesText, ['name', 'language', 'stars', 'url', 'description']),
      testimonials: textToRows(values.testimonialsText, ['quote', 'name', 'title', 'organization']),
      projects: projectRows.map(({ technologiesText, ...project }) => ({ ...project, technologies: splitList(technologiesText) })),
      layout: values.layout || 'editorial',
      accentColor: values.accentColor || '#a259ff',
    })
  }

  useEffect(() => {
    if (page !== 'portfolio') return
    updatePortfolioPreview()
  }, [page, projectRows, portfolioPhotoUrl, portfolioMetrics])

  const addPortfolioMetric = () => setPortfolioMetrics((rows) => rows.length >= 8 ? rows : [...rows, { id: crypto.randomUUID(), value: '', label: '', detail: '' }])
  const updatePortfolioMetric = (id, key, value) => setPortfolioMetrics((rows) => rows.map((row) => row.id === id ? { ...row, [key]: value } : row))
  const removePortfolioMetric = (id) => setPortfolioMetrics((rows) => rows.filter((row) => row.id !== id))

  const copyPortfolioLink = async () => {
    const url = new URL('/portfolio.html?slug=' + encodeURIComponent(portfolio.slug), location.origin).href
    try {
      await navigator.clipboard.writeText(url)
      setPortfolioNotice('Public portfolio link copied.')
    } catch {
      setPortfolioNotice('Copy failed. Public portfolio link: ' + url)
    }
  }

  const unpublishPortfolio = async () => {
    if (!window.confirm('Unpublish your portfolio? The saved draft will remain available in this builder.')) return
    setPortfolioBusy(true)
    try {
      const { portfolio: record } = await adminRequest('/api/admin/portfolio/me/unpublish', { method: 'POST', body: '{}' })
      setPortfolio(record)
      setPortfolioNotice('Portfolio unpublished. Your draft is still saved.')
    } catch (error) {
      setPortfolioNotice(error.message || 'Could not unpublish your portfolio.')
    } finally {
      setPortfolioBusy(false)
    }
  }

  const addInternshipTrack = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setTrackBusy('new')
    setTrackNotice({ text: '', success: false })
    try {
      const { track } = await adminRequest('/api/admin/internship-tracks', {
        method: 'POST',
        body: JSON.stringify({ name: form.elements.name.value.trim(), isSelectable: form.elements.isSelectable.checked }),
      })
      setInternshipTracks((items) => [...items, track])
      form.reset()
      setTrackNotice({ text: `${track.name} added.`, success: true })
    } catch (error) {
      setTrackNotice({ text: error.message || 'Could not add this track.', success: false })
    } finally {
      setTrackBusy('')
    }
  }

  const setInternshipTrackAvailability = async (track, isSelectable) => {
    setTrackBusy(String(track.id))
    setTrackNotice({ text: '', success: false })
    try {
      const { track: updated } = await adminRequest(`/api/admin/internship-tracks/${track.id}`, {
        method: 'PATCH', body: JSON.stringify({ isSelectable }),
      })
      setInternshipTracks((items) => items.map((item) => item.id === updated.id ? updated : item))
      setTrackNotice({ text: `${updated.name} ${isSelectable ? 'opened for' : 'closed to'} applications.`, success: true })
    } catch (error) {
      setTrackNotice({ text: error.message || 'Could not update this track.', success: false })
    } finally {
      setTrackBusy('')
    }
  }

  const removeInternshipTrack = async (track) => {
    if (!window.confirm(`Remove ${track.name} from the internship track list? Existing applications will be kept.`)) return
    setTrackBusy(String(track.id))
    setTrackNotice({ text: '', success: false })
    try {
      await adminRequest(`/api/admin/internship-tracks/${track.id}`, { method: 'DELETE' })
      setInternshipTracks((items) => items.filter((item) => item.id !== track.id))
      setTrackNotice({ text: `${track.name} removed. Existing applications were kept.`, success: true })
    } catch (error) {
      setTrackNotice({ text: error.message || 'Could not remove this track.', success: false })
    } finally {
      setTrackBusy('')
    }
  }

  const issueCertificate = async (event) => {
    event.preventDefault()
    setCertificateBusy(true)
    setCertificateNotice('')
    try {
      const form = event.currentTarget
      const { certificate } = await adminRequest('/api/admin/certificates', {
        method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))),
      })
      form.reset()
      setCertificateSignatures({ signature1Url: '', signature2Url: '' })
      setCertificateNotice(`Certificate issued. Credential ID: ${certificate.credentialId}`)
      await refreshCertificates()
    } catch (error) {
      setCertificateNotice(error.message || 'Could not issue the certificate.')
    } finally {
      setCertificateBusy(false)
    }
  }

  const uploadCertificateSignature = async (event, field) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setCertificateBusy(true)
    setCertificateNotice('')
    try {
      const image = await uploadDashboardImage(file)
      const form = document.querySelector('.certificate-issue-form')
      form.elements[field].value = image.url
      setCertificateSignatures((current) => ({ ...current, [field]: image.url }))
      setCertificateNotice('PNG signature uploaded and attached to the certificate form.')
    } catch (error) {
      setCertificateNotice(error.message || 'Could not upload this signature.')
    } finally {
      setCertificateBusy(false)
    }
  }

  const copyCertificateUrl = async (certificate) => {
    const url = new URL(certificate.imageUrl, location.origin).href
    try {
      await navigator.clipboard.writeText(url)
      setCertificateNotice(`Certificate image URL copied: ${url}`)
    } catch {
      setCertificateNotice(`Copy failed. Certificate image URL: ${url}`)
    }
  }

  const savePortfolio = async (publish = false) => {
    setPortfolioBusy(true); setPortfolioNotice('')
    const form = document.getElementById('masterPortfolioForm')
    const values = Object.fromEntries(new FormData(form))
    values.skills = splitList(values.skills)
    values.socialLinks = { linkedin: values.linkedin, github: values.github, website: values.website, instagram: values.instagram }
    delete values.linkedin; delete values.github; delete values.website; delete values.instagram
    values.projects = projectRows.map(({ technologiesText, ...project }) => ({ ...project, technologies: splitList(technologiesText) })).filter((project) => project.title || project.description)
    values.metrics = portfolioMetrics
    values.experience = textToRows(values.experienceText, ['title', 'organization', 'location', 'startDate', 'endDate', 'technologies', 'description'])
    values.education = textToRows(values.educationText, ['qualification', 'institution', 'location', 'startDate', 'endDate', 'description'])
    values.repositories = textToRows(values.repositoriesText, ['name', 'language', 'stars', 'url', 'description'])
    values.testimonials = textToRows(values.testimonialsText, ['quote', 'name', 'title', 'organization'])
    delete values.metricsText; delete values.experienceText; delete values.educationText; delete values.repositoriesText; delete values.testimonialsText
    try {
      let { portfolio: record } = await adminRequest('/api/admin/portfolio/me', { method: 'PUT', body: JSON.stringify(values) })
      if (publish) ({ portfolio: record } = await adminRequest('/api/admin/portfolio/me/publish', { method: 'POST', body: '{}' }))
      setPortfolio(record); setPortfolioNotice(publish ? 'Portfolio published.' : 'Draft saved.')
    } catch (error) { setPortfolioNotice(error.message || 'Could not save the portfolio.') }
    finally { setPortfolioBusy(false) }
  }

  const updatePassword = async (event) => {
    event.preventDefault(); const form = event.currentTarget
    try {
      await authRequest('/password', { method: 'POST', body: JSON.stringify({ currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value }) })
      form.reset(); setPasswordNotice('Password updated.')
    } catch (error) { setPasswordNotice(error.message || 'Could not update the password.') }
  }

  if (!loginReady && !account) return <PageLoadingSkeleton label="Loading master administration" />

  return <main className="master-shell">
    <header className="master-head"><div className="master-brand"><ThemeAwareLogo /><div><span className="eyebrow">WEBLOX · ADMINISTRATION</span><h1 className="master-title">Master admin</h1><p>Manage staff, interns, and administrator accounts.</p></div></div>{account && <div className="master-actions"><span className="eyebrow">{account.email}</span><button className="button secondary" type="button" onClick={loadAll}>Refresh</button><button className="button secondary" type="button" onClick={signOut}>Sign out</button></div>}</header>
    {!account ? <section className="master-card"><h2>Administrator sign in</h2><p>Sign in with your backend administrator email and password.</p><form className="master-form" onSubmit={signIn}><label className="wide">Email address<input name="email" type="email" autoComplete="username" required /></label><label className="wide">Password<input name="password" type="password" autoComplete="current-password" required /></label><button className="button wide" type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in'}</button></form><Notice>{loginNotice}</Notice></section> : <div id="masterConsole">
      <aside className={`master-card master-sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <button className="dashboard-sidebar-toggle" type="button" aria-expanded={sidebarOpen} aria-controls="masterAdminSidebarContent" onClick={() => setSidebarOpen((open) => !open)}>{sidebarOpen ? 'Hide dashboard menu' : 'Show dashboard menu'}<span aria-hidden="true">{sidebarOpen ? '−' : '+'}</span></button>
        <div className="dashboard-sidebar-content" id="masterAdminSidebarContent"><span className="eyebrow">ADMIN PROFILE</span><h2>{account.name || 'Administrator'}</h2><p>{account.email}</p><nav aria-label="Master admin navigation">{[['overview', 'Overview'], ['people', 'People'], ['applicants', 'Applicants'], ['tracks', 'Internship tracks'], ['history', 'History'], ['certificates', 'Certificates'], ['images', 'Image library'], ['settings', 'Settings'], ['portfolio', 'My portfolio']].map(([key, label]) => <a key={key} href={`#${key}`} className={page === key ? 'active' : ''} aria-current={page === key ? 'page' : undefined} onClick={(event) => { event.preventDefault(); showPage(key) }}><DashboardNavIcon name={key} />{label}</a>)}</nav><section><span className="eyebrow">TODAY’S ATTENDANCE</span><p className="master-attendance-status">{attendance ? `In: ${attendance.clockInAt ? new Date(attendance.clockInAt).toLocaleTimeString() : '—'} · Out: ${attendance.clockOutAt ? new Date(attendance.clockOutAt).toLocaleTimeString() : '—'}` : attendanceNotice || 'Loading attendance…'}</p><div className="master-attendance"><button className="button" type="button" onClick={() => updateAttendance('clock_in')}>Clock in</button><button className="button secondary" type="button" onClick={() => updateAttendance('clock_out')}>Clock out</button></div><Notice>{attendanceNotice}</Notice></section></div>
      </aside>
      <div className="master-pages">
        {page === 'overview' && <section className="master-card"><span className="eyebrow">OVERVIEW</span><h2>Master admin overview</h2><p>Review internship applicants, manage people, check sent reports, and build your portfolio.</p><div className="master-summary-grid"><article><b>{staff.filter((person) => person.activated && person.active).length}</b><span>Active staff</span></article><article><b>{onlineStaff === null ? '—' : onlineStaff.length}</b><span>Staff online now</span></article><article><b>{interns.filter((person) => person.active).length}</b><span>Active interns</span></article><article><b>{applications.length}</b><span>Applications</span></article><article><b>{admins.length}</b><span>Administrators</span></article></div><div className="master-online-list" aria-live="polite"><span>Staff online now</span>{onlineStaff === null ? <p>Online staff could not be loaded.</p> : onlineStaff.length ? <ul>{onlineStaff.map((person) => <li key={person.id}>{person.name}</li>)}</ul> : <p>No staff are online right now.</p>}</div>{notice.text && <Notice success={notice.success}>{notice.text}</Notice>}</section>}

        {page === 'people' && <>
          <section className="master-card"><span className="eyebrow">ALL STAFF</span><h2>Staff accounts</h2><p>Review onboarded team members and update their directory details.</p><div className="master-list">{staff.length ? staff.map((person) => <article className="master-row" key={person.id || person.email}><div><b>{person.name || person.email}</b><small>{[person.email, person.role, person.jobType || '—', person.gender || 'Gender undisclosed', `Added ${date(person.createdAt)} by ${person.createdByName || 'Unknown'}${person.createdByEmail ? ` (${person.createdByEmail})` : ''}`, person.activated ? person.active ? 'ACTIVE' : 'DISABLED' : 'INVITATION PENDING'].join(' · ')}</small></div>{person.activated && <span className="master-state">{person.active ? 'ACTIVE' : 'DISABLED'}</span>}<button className="button secondary" type="button" onClick={() => editPerson(person, 'staff')}>Edit</button>{person.activated ? <button className={`button secondary${person.active ? ' master-danger' : ''}`} type="button" onClick={() => updatePerson(person, 'staff', person.active ? 'remove' : 'restore')}>{person.active ? 'Disable' : 'Restore access'}</button> : <button className="button secondary master-danger" type="button" onClick={() => updatePerson(person, 'staff', 'remove')}>Remove invitation</button>}</article>) : <p>No staff have been onboarded yet.</p>}</div></section>
          <section className="master-card"><span className="eyebrow">INTERNSHIP PROGRAM</span><h2>Onboard an intern</h2><p>Create an intern workspace account for a future program participant. Share the temporary password privately. Intern check-ins are submitted at <a href="/intern-portal.html">the intern portal</a>.</p><form className="master-form" onSubmit={(event) => submitForm(event, '/api/admin/interns', async () => { await refreshInterns() }, 'Intern onboarded. Share the temporary password securely.')}><label>Full name<input name="name" maxLength="120" required /></label><label>Email address<input name="email" type="email" maxLength="254" required /></label><label>Program or track<input name="role" maxLength="80" defaultValue="Intern" required /></label><label>Gender<select name="gender"><option value="">Select gender</option><option>Male</option><option>Female</option></select></label><label>Job type<select name="jobType" required><option>Internship</option><option>Part-time</option><option>Full-time</option><option>Contract</option></select></label><label className="wide">Temporary password<input name="password" type="password" minLength="8" autoComplete="new-password" required /></label><button className="button" type="submit">Onboard intern</button></form>{notice.text && <Notice success={notice.success}>{notice.text}</Notice>}<div className="master-list">{interns.length ? interns.map((person) => <article className="master-row" key={person.id}><div><b>{person.name}</b><small>{[person.email, person.role, person.jobType, person.gender || 'Gender undisclosed', `Added ${date(person.createdAt)} by ${person.createdByName || 'Unknown'}`].join(' · ')}</small></div><span className="master-state">{person.active ? 'ACTIVE' : 'DISABLED'}</span><button className="button secondary" type="button" onClick={() => editPerson(person, 'intern')}>Edit</button><button className="button secondary" type="button" onClick={() => updatePerson(person, 'intern', person.active ? 'remove' : 'restore')}>{person.active ? 'Disable' : 'Restore access'}</button></article>) : <p>No interns onboarded yet.</p>}</div></section>
          <section className="master-card"><span className="eyebrow">STAFF ADMINISTRATORS</span><h2>Add an administrator account</h2><p>Create a backend account directly. The password is stored as a salted hash. Share the login details securely with the administrator.</p><form className="master-form" onSubmit={(event) => submitForm(event, '/api/admin/admins', refreshAdmins, 'Administrator account created.')}><label>Full name<input name="name" maxLength="120" autoComplete="name" required /></label><label>Email address<input name="email" type="email" maxLength="254" autoComplete="email" required /></label><label className="wide">Temporary password<input name="password" type="password" minLength="8" autoComplete="new-password" required /><small>At least 8 characters. The new administrator can sign in immediately.</small></label><button className="button" type="submit">Add administrator</button></form>{notice.text && <Notice success={notice.success}>{notice.text}</Notice>}<h2>Current administrators</h2><div className="master-list">{admins.length ? admins.map((person) => <article className="master-row" key={person.id}><div><b>{person.name}</b><small>{person.email} · {person.gender || 'Gender undisclosed'} · Added {date(person.createdAt)}</small></div><span className="master-state">ADMIN</span>{!person.isCurrent && <button className="remove-admin" type="button" onClick={() => updateAdmin(person)}>Remove</button>}</article>) : <p>No administrator accounts found.</p>}</div></section>
        </>}

        {page === 'applicants' && <section className="master-card"><span className="eyebrow">INTERNSHIP APPLICANTS</span><h2>Applicant submissions</h2><div className="master-list">{applications.length ? applications.map((app) => <article className="master-row" key={app.id}><div><b>{app.fullName}</b><small>{app.email} · {app.phone} · {app.track} · Received {fmt(app.createdAt)}</small>{[['Background', app.background], ['Background details', app.backgroundDetails], ['Skills', app.skills], ['Motivation', app.motivation], ['Availability', `${app.startDate || ''} · ${app.duration || ''} · ${app.availability || ''}`], ['Contribution', app.contribution]].filter(([, value]) => value).map(([label, value]) => <small key={label}>{label}: {Array.isArray(value) ? value.join(', ') : value}</small>)}<div>{[['Portfolio', app.portfolioUrl], ['GitHub', app.githubUrl], ['LinkedIn', app.linkedinUrl]].filter(([, url]) => /^https?:\/\//i.test(url || '')).map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer">{label} </a>)}</div>{app.resume?.name && <button className="button secondary" type="button" onClick={() => downloadResume(app)}>Download CV · {app.resume.name}</button>}</div></article>) : <p>No internship applications have been received yet.</p>}</div></section>}

        {page === 'tracks' && <>
          <section className="master-card"><span className="eyebrow">INTERNSHIP TRACKS</span><h2>Manage application options</h2><p>Selectable tracks are open on the public application form. Turn a track off to keep it visible but greyed out. Removing a track deletes it from the form; submitted applications remain unchanged.</p><form className="master-form master-track-form" onSubmit={addInternshipTrack}><label>New track name<input name="name" maxLength="100" placeholder="e.g. Data Science / AI" required /></label><label className="master-track-add-toggle"><input name="isSelectable" type="checkbox" /> Open for applications immediately</label><button className="button" type="submit" disabled={trackBusy === 'new'}>{trackBusy === 'new' ? 'Adding…' : 'Add track'}</button></form><Notice success={trackNotice.success}>{trackNotice.text}</Notice><div className="master-list">{internshipTracks.length ? internshipTracks.map((track) => <article className="master-row master-track-row" key={track.id}><div><b>{track.name}</b><small>{track.isSelectable ? 'Applicants can select this track.' : 'Shown in the application list but currently unavailable.'}</small></div><label className="master-track-toggle"><input type="checkbox" checked={track.isSelectable} disabled={trackBusy === String(track.id)} onChange={(event) => setInternshipTrackAvailability(track, event.target.checked)} /><span>{track.isSelectable ? 'Selectable' : 'Disabled'}</span></label><button className="button secondary master-danger" type="button" disabled={trackBusy === String(track.id)} onClick={() => removeInternshipTrack(track)}>Remove</button></article>) : <p>No internship tracks are configured.</p>}</div></section>
        </>}

        {page === 'history' && <>
          <section className="master-card"><span className="eyebrow">MESSAGE HISTORY</span><h2>Sent announcements and reports</h2><div className="master-list">{workspace.sentMessages?.length ? workspace.sentMessages.map((item) => <article className="master-row" key={item.id}><div><b>{item.type === 'announcement' ? 'ANNOUNCEMENT' : 'WEEKLY REPORT'} · {item.subject}</b><small>Sent by {item.senderName}{item.senderEmail ? ` (${item.senderEmail})` : ''} · {fmt(item.createdAt)} · {item.recipientCount} recipients</small></div></article>) : <p>No messages have been sent.</p>}</div></section>
          <section className="master-card"><span className="eyebrow">ANNOUNCEMENTS & REPORTS</span><h2>Compose a message</h2><p>Choose everyone, a whole group, or any combination of individual staff and interns.</p><form id="workspaceMessageForm" className="master-form" onSubmit={sendMessage}><label>Message type<select name="type"><option value="announcement">Announcement</option><option value="weekly_report">Weekly report</option></select></label><label>Subject<input name="subject" maxLength="180" required /></label><label className="wide">Message<textarea name="body" rows="6" maxLength="20000" required /></label><button className="button secondary" type="button" onClick={loadWeeklyReport}>Load weekly summary</button><button className="button" type="submit" disabled={messageBusy}>{messageBusy ? 'Sending…' : 'Send to selected'}</button><fieldset className="wide master-recipient-fieldset"><legend>Recipients</legend><div className="master-recipient-actions">{[['all', 'Everyone'], ['staff', 'All staff'], ['intern', 'All interns'], ['none', 'Clear']].map(([key, label]) => <button className="button secondary" key={key} type="button" onClick={() => selectGroup(key)}>{label}</button>)}</div><div className="master-recipient-groups">{[['staff', 'Staff'], ['intern', 'Interns']].map(([type, label]) => { const people = workspace.recipients.filter((person) => person.accountType === type); return <section className="master-recipient-group" key={type}><h3>{label} ({people.length})</h3>{people.length ? people.map((person) => <label className="master-recipient-option" key={person.id}><input type="checkbox" checked={selectedRecipients.includes(person.id)} onChange={() => toggleRecipient(person.id)} /><span>{[person.name, person.role, person.email].filter(Boolean).join(' · ')}</span></label>) : <p>No active {label.toLowerCase()} accounts.</p>}</section> })}</div></fieldset></form><Notice>{messageNotice}</Notice></section>
          <section className="master-card"><span className="eyebrow">STAFF SIGN-INS & ATTENDANCE</span><h2>Daily team activity</h2><div className="master-list">{activity.staffActivity.length ? activity.staffActivity.map((item, index) => <article className="master-row" key={`${item.email}-${item.occurredAt}-${index}`}><div><b>{item.name}</b><small>{item.email} · {item.eventType === 'login' ? `Signed in · ${fmt(item.occurredAt)}` : `Attendance ${item.attendanceDate}: in ${item.clockInAt ? new Date(item.clockInAt).toLocaleTimeString() : '—'}, out ${item.clockOutAt ? new Date(item.clockOutAt).toLocaleTimeString() : '—'}`}</small></div></article>) : <p>No staff login or attendance records yet.</p>}</div></section>
          <section className="master-card"><span className="eyebrow">INTERN CHECK-INS</span><h2>Morning and evening updates</h2><div className="master-list">{activity.internCheckins.length ? activity.internCheckins.map((item, index) => <article className="master-row" key={`${item.email}-${item.date}-${index}`}><div><b>{item.name}</b><small>{item.email} · {item.date || 'No check-ins yet'} · Morning: {item.morning || '—'} · Evening: {item.evening || '—'}</small></div></article>) : <p>No onboarded interns or check-ins yet.</p>}</div></section>
          <section className="master-card"><span className="eyebrow">ADMIN CHANGE HISTORY</span><h2>People changes by administrator</h2><div className="master-list">{activity.audit.length ? activity.audit.map((event, index) => <article className="master-row" key={`${event.id || event.createdAt}-${index}`}><div><b>{event.action.toUpperCase()} · {event.personName} ({event.personType})</b><small>{event.personEmail} · {event.role} · {event.jobType || '—'} · {fmt(event.createdAt)} · By {event.performedByName} ({event.performedByEmail || 'no email'}){event.details?.before && event.details?.after ? ` · Change: ${JSON.stringify(event.details.before)} → ${JSON.stringify(event.details.after)}` : ''}</small></div></article>) : <p>No onboarding changes have been recorded yet.</p>}</div></section>
        </>}

        {page === 'certificates' && <>
          <section className="master-card"><span className="eyebrow">INTERNSHIP CREDENTIALS</span><h2>Issue a certificate</h2><p>Select an onboarded intern and enter the details to create a branded certificate PDF and shareable certificate image.</p>
            <form className="master-form certificate-issue-form" onSubmit={issueCertificate}>
              <label className="wide">Intern<select name="internAccountId" required defaultValue="" onChange={(event) => { const selected = interns.find((person) => person.id === event.target.value); const form = event.currentTarget.form; if (selected && form) { form.elements.name.value = selected.name || ''; form.elements.track.value = selected.role || 'Internship' } }}><option value="" disabled>Select an intern</option>{interns.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}{person.active ? '' : ' · disabled account'}</option>)}</select></label>
              <label>Certificate name<input name="name" maxLength="120" placeholder="Intern's name as it should appear" required /></label>
              <label>Program or track<input name="track" maxLength="120" placeholder="Software Engineering" required /></label>
              <label>Internship start date<input name="startDate" type="date" /></label>
              <label>Completion date<input name="completionDate" type="date" /></label>
              <fieldset className="wide certificate-signatory"><legend>First signatory</legend><label>Name<input name="signatory1Name" maxLength="120" defaultValue="Chukwuemeka Nkama" /></label><label>Title<input name="signatory1Title" maxLength="120" defaultValue="Founder & Team Lead" /></label><label className="wide">PNG signature<input type="file" accept="image/png" disabled={certificateBusy} onChange={(event) => uploadCertificateSignature(event, 'signature1Url')} /></label><input type="hidden" name="signature1Url" />{certificateSignatures.signature1Url && <img className="certificate-signature-preview" src={new URL(certificateSignatures.signature1Url, location.origin).href} alt="First signatory signature preview" />}</fieldset>
              <fieldset className="wide certificate-signatory"><legend>Second signatory</legend><label>Name<input name="signatory2Name" maxLength="120" placeholder="Signatory name" /></label><label>Title<input name="signatory2Title" maxLength="120" placeholder="Signatory title" /></label><label className="wide">PNG signature<input type="file" accept="image/png" disabled={certificateBusy} onChange={(event) => uploadCertificateSignature(event, 'signature2Url')} /></label><input type="hidden" name="signature2Url" />{certificateSignatures.signature2Url && <img className="certificate-signature-preview" src={new URL(certificateSignatures.signature2Url, location.origin).href} alt="Second signatory signature preview" />}</fieldset>
              <label className="wide">Certificate statement<textarea name="description" rows="3" maxLength="500" defaultValue="For outstanding dedication, practical contribution, and successful completion of the WEBLOX Internship Program." /></label>
              <button className="button" type="submit" disabled={certificateBusy || !interns.length}>{certificateBusy ? 'Issuing certificate…' : 'Issue certificate'}</button>
            </form><Notice success={certificateNotice.startsWith('Certificate issued')}>{certificateNotice}</Notice>
          </section>
          <section className="master-card"><span className="eyebrow">CERTIFICATE LIBRARY</span><h2>Issued certificates</h2><div className="master-certificate-grid">{certificates.length ? certificates.map((certificate) => <article className="master-certificate-card" key={certificate.id}><img src={certificate.imageUrl} alt={`Certificate issued to ${certificate.certificateData.name}`} /><div><b>{certificate.certificateData.name}</b><small>{certificate.internEmail} · {certificate.certificateData.track}</small><code>{certificate.credentialId}</code><label>Certificate image URL<input readOnly value={new URL(certificate.imageUrl, location.origin).href} onFocus={(event) => event.currentTarget.select()} /></label><div className="master-certificate-actions"><button className="button secondary" type="button" onClick={() => copyCertificateUrl(certificate)}>Copy image URL</button><a className="button" href={certificate.pdfUrl}>Download PDF</a></div></div></article>) : <p>No certificates have been issued yet.</p>}</div></section>
        </>}
        {page === 'images' && <section className="master-card master-image-library"><ImageLibrary /></section>}
        {page === 'settings' && <><section className="master-card"><span className="eyebrow">APPEARANCE</span><h2>Color theme</h2><p className="theme-settings-copy">Choose how the dashboard looks. Your preference is saved for your next visit.</p><ThemeSettings theme={theme} onChange={setTheme} /></section><section className="master-card"><span className="eyebrow">ACCOUNT SETTINGS</span><h2>Master admin settings</h2><button className="button secondary" type="button" onClick={() => setPasswordOpen((open) => !open)}>Change password</button>{passwordOpen && <><form className="master-form" onSubmit={updatePassword}><label>Current password<input name="currentPassword" type="password" required /></label><label>New password<input name="newPassword" type="password" minLength="8" required /></label><button className="button" type="submit">Update password</button></form><Notice>{passwordNotice}</Notice></>}</section></>}

        {page === 'portfolio' && <section className="master-card master-portfolio-card">
          <span className="eyebrow">MASTER ADMIN PORTFOLIO</span><h2>My portfolio</h2><p>Build and publish a portfolio for your administrator account. Your preview updates as you edit.</p>
          <div className="master-portfolio-layout">
            <div className="master-portfolio-editor">
              <form id="masterPortfolioForm" className="master-form master-portfolio-form" noValidate onSubmit={(event) => event.preventDefault()} onInput={(event) => updatePortfolioPreview(event.currentTarget)} onChange={(event) => updatePortfolioPreview(event.currentTarget)}>
                <label>Name<input name="name" maxLength="120" /></label><label>Professional title<input name="title" maxLength="120" /></label><label>Location<input name="location" /></label><label>Availability<input name="availability" maxLength="120" placeholder="Available for contracts" /></label>
                <div className="wide profile-picture-field"><span className="profile-picture-preview">{portfolioPhotoUrl.startsWith('http') ? <img src={portfolioPhotoUrl} alt="Current portfolio profile" /> : <span>{(account.name || 'W').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>}</span><div><b>Profile picture</b><p className="builder-hint">Upload a new picture, or remove the current one. Uploaded images are also saved in your image library.</p><label className="button secondary profile-picture-upload" htmlFor="masterProfilePhotoUpload">{photoBusy ? 'Uploading...' : portfolioPhotoUrl ? 'Change picture' : 'Upload picture'}</label><input id="masterProfilePhotoUpload" className="profile-picture-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={photoBusy} onChange={uploadPortfolioPhoto} />{portfolioPhotoUrl && <button className="button secondary" type="button" disabled={photoBusy} onClick={() => { setPortfolioPhotoUrl(''); setPortfolioNotice('Profile picture removed. Save your portfolio to keep this change.') }}>Remove picture</button>}</div></div>
                <label className="wide">Profile photo URL<input name="photoUrl" type="url" maxLength="2048" value={portfolioPhotoUrl} onChange={(event) => setPortfolioPhotoUrl(event.target.value)} /></label><label>Contact email<input name="contactEmail" type="email" /></label><label>CV or resume URL<input name="cvUrl" type="url" maxLength="2048" /></label><label>LinkedIn URL<input name="linkedin" type="url" placeholder="https://linkedin.com/in/" /></label><label>GitHub URL<input name="github" type="url" placeholder="https://github.com/" /></label><label>Website URL<input name="website" type="url" placeholder="https://" /></label><label>Instagram URL<input name="instagram" type="url" placeholder="https://instagram.com/" /></label><label className="wide">About<textarea name="biography" rows="5" maxLength="3000" /></label><label className="wide">Skills, separated by commas<input name="skills" /></label>
                <section className="wide portfolio-text-editor master-career-highlights"><h3>Career highlights</h3><p>Add up to eight short metrics that appear near the top of the portfolio.</p>{portfolioMetrics.map((metric, index) => <div className="master-metric-row" key={metric.id || index}><label>Value<input value={metric.value || ''} onChange={(event) => updatePortfolioMetric(metric.id, 'value', event.target.value)} /></label><label>Label<input value={metric.label || ''} onChange={(event) => updatePortfolioMetric(metric.id, 'label', event.target.value)} /></label><label className="wide">Detail<input value={metric.detail || ''} onChange={(event) => updatePortfolioMetric(metric.id, 'detail', event.target.value)} /></label><button className="button secondary" type="button" onClick={() => removePortfolioMetric(metric.id)}>Remove highlight</button></div>)}<button className="button secondary" type="button" disabled={portfolioMetrics.length >= 8} onClick={addPortfolioMetric}>Add career highlight</button></section>
                <section className="wide portfolio-text-editor"><h3>Work experience</h3><p>One item per line: role | organization | location | start date | end date | technologies (comma separated) | description</p><textarea name="experienceText" rows="5" /></section><section className="wide portfolio-text-editor"><h3>Education</h3><p>One item per line: qualification | institution | location | start date | end date | description</p><textarea name="educationText" rows="4" /></section><section className="wide portfolio-text-editor"><h3>Open-source work</h3><p>One item per line: repository | language or tool | stars or downloads | URL | description</p><textarea name="repositoriesText" rows="4" /></section><section className="wide portfolio-text-editor"><h3>Recommendations</h3><p>One item per line: quote | colleague name | job title | organization</p><textarea name="testimonialsText" rows="4" /></section>
                <div className="wide"><h3>Projects</h3>{projectRows.map((project, index) => <fieldset className="master-project-card" key={project.id || index}><legend>Project {index + 1}</legend><div className="master-form"><label>Project title<input value={project.title || ''} onChange={(event) => updateProject(index, 'title', event.target.value)} /></label><label>Project category<input value={project.category || ''} onChange={(event) => updateProject(index, 'category', event.target.value)} /></label><label>Technologies<input value={project.technologiesText || ''} onChange={(event) => updateProject(index, 'technologiesText', event.target.value)} /></label><label className="wide">Description<textarea value={project.description || ''} onChange={(event) => updateProject(index, 'description', event.target.value)} /></label><label>Cover image URL<input type="url" value={project.imageUrl || ''} onChange={(event) => updateProject(index, 'imageUrl', event.target.value)} /></label><label>Live project URL<input type="url" value={project.liveUrl || ''} onChange={(event) => updateProject(index, 'liveUrl', event.target.value)} /></label><label>Source code URL<input type="url" value={project.sourceUrl || ''} onChange={(event) => updateProject(index, 'sourceUrl', event.target.value)} /></label></div><button className="button secondary" type="button" onClick={() => setProjectRows((rows) => rows.filter((_, item) => item !== index))}>Remove project</button></fieldset>)}<button className="button secondary" type="button" onClick={addProject}>Add project</button></div>
                <section className="wide portfolio-text-editor master-portfolio-design"><h3>Portfolio design</h3><p>Choose the public portfolio layout and accent color.</p><label>Layout<select name="layout" value={portfolioPreview.layout || 'editorial'} onChange={(event) => { setPortfolioPreview((current) => ({ ...current, layout: event.target.value })); updatePortfolioPreview(event.currentTarget.form) }}><option value="editorial">Editorial</option><option value="cards">Card showcase</option></select></label><label>Accent color<input name="accentColor" type="color" value={portfolioPreview.accentColor || '#a259ff'} onChange={(event) => { setPortfolioPreview((current) => ({ ...current, accentColor: event.target.value })); updatePortfolioPreview(event.currentTarget.form) }} /></label></section>
              </form>
              <section className="master-portfolio-publishing"><span className="eyebrow">PUBLISHING</span><h3>{portfolio.status === 'published' ? 'Portfolio published' : portfolio.updatedAt ? 'Draft saved' : 'Private draft'}</h3><p>{portfolio.updatedAt ? 'Last saved ' + fmt(portfolio.updatedAt) + '. ' : ''}{portfolio.status === 'published' ? 'Edits stay in your draft until you publish again.' : 'Your draft stays private until you publish it.'}</p><div className="master-portfolio-progress"><span style={{ width: Math.round([portfolioPreview.name && portfolioPreview.title, portfolioPreview.biography, (portfolioPreview.skills || []).length, portfolioMetrics.length, projectRows.length, portfolioPreview.experience, portfolioPreview.education, portfolioPreview.socialLinks && Object.values(portfolioPreview.socialLinks).some(Boolean)].filter(Boolean).length / 8 * 100) + '%' }} /></div><small>{Math.round([portfolioPreview.name && portfolioPreview.title, portfolioPreview.biography, (portfolioPreview.skills || []).length, portfolioMetrics.length, projectRows.length, portfolioPreview.experience, portfolioPreview.education, portfolioPreview.socialLinks && Object.values(portfolioPreview.socialLinks).some(Boolean)].filter(Boolean).length / 8 * 100)}% complete</small><div className="master-portfolio-publish-actions"><button className="button secondary" type="button" disabled={portfolioBusy} onClick={() => savePortfolio(false)}>Save draft</button><button className="button" type="button" disabled={portfolioBusy} onClick={() => savePortfolio(true)}>{portfolio.status === 'published' ? 'Publish updates' : 'Publish portfolio'}</button>{portfolio.status === 'published' && <button className="button secondary master-danger" type="button" disabled={portfolioBusy} onClick={unpublishPortfolio}>Unpublish</button>}</div>{portfolio.status === 'published' && portfolio.slug && <div className="master-portfolio-public-link"><a className="button secondary" href={'/portfolio.html?slug=' + encodeURIComponent(portfolio.slug)} target="_blank" rel="noopener noreferrer">Open published portfolio</a><button className="button secondary" type="button" onClick={copyPortfolioLink}>Copy public link</button></div>}<Notice success={portfolioNotice.includes('saved') || portfolioNotice.includes('published') || portfolioNotice.includes('copied')}>{portfolioNotice}</Notice></section>
            </div>
            <aside className="master-portfolio-preview"><div className="master-portfolio-preview-head"><h3>Live preview</h3><span>UPDATES AS YOU EDIT</span></div><PortfolioPresentation portfolio={portfolioPreview} preview /></aside>
          </div>
        </section>}
      </div>
    </div>}
  </main>
}
