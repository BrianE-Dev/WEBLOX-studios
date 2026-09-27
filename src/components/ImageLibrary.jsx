import { useEffect, useState } from 'react'
import { absoluteImageUrl, uploadDashboardImage } from '../lib/imageLibrary.js'

const formatSize = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

async function libraryRequest(path = '/api/media/library', options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Image library request failed.')
  return data
}

export default function ImageLibrary() {
  const [images, setImages] = useState([])
  const [usage, setUsage] = useState({ byteSize: 0, count: 0 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const loadImages = async () => {
    const result = await libraryRequest()
    setImages(result.images)
    setUsage(result.usage)
  }

  useEffect(() => {
    let active = true
    libraryRequest().then((result) => {
      if (!active) return
      setImages(result.images)
      setUsage(result.usage)
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Could not load your image library.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const upload = async (event) => {
    const files = [...(event.currentTarget.files || [])]
    event.currentTarget.value = ''
    if (!files.length) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      for (const file of files) {
        await uploadDashboardImage(file)
      }
      await loadImages()
      setNotice(`${files.length} file${files.length === 1 ? '' : 's'} uploaded.`)
    } catch (uploadError) {
      await loadImages().catch(() => {})
      setError(uploadError.message || 'Could not upload these images.')
    } finally {
      setBusy(false)
    }
  }

  const copyUrl = async (image) => {
    const url = absoluteImageUrl(image)
    try {
      await navigator.clipboard.writeText(url)
      setNotice('Image URL copied. Paste it into an image URL field to reuse this image.')
      setError('')
    } catch {
      setError(`Copy failed. Select and copy this URL: ${url}`)
    }
  }

  const deleteImage = async (image) => {
    if (!window.confirm(`Delete ${image.originalName} from your image library? Any place using its URL will stop showing it.`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await libraryRequest(`/api/media/library/${image.id}`, { method: 'DELETE' })
      await loadImages()
      setNotice('Image deleted.')
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this image.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="image-library-panel">
    <header className="image-library-head"><div><span className="eyebrow">MEDIA</span><h2>Image and resume library</h2><p>Upload images or resumes, then copy a file URL into your portfolio or share it elsewhere.</p></div><div className="image-library-usage">{usage.count} / 200 files · {formatSize(usage.byteSize)} / 50 MB</div></header>
    <div className="image-library-upload"><label className="button" htmlFor="dashboardImageUpload">{busy ? 'Please wait…' : 'Upload files'}</label><input id="dashboardImageUpload" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf" multiple disabled={busy} onChange={upload} /><span>JPEG, PNG, WebP, GIF, or PDF · up to 5 MB each</span></div>
    {error && <p className="image-library-error" role="alert">{error}</p>}
    {notice && <p className="image-library-notice" role="status">{notice}</p>}
    {loading ? <p className="theme-settings-copy">Loading image library…</p> : images.length ? <div className="image-library-grid">{images.map((image) => <article className="image-library-item" key={image.id}>
      {image.contentType === 'application/pdf' ? <div className="image-library-pdf-preview"><b>PDF</b><a href={image.url} target="_blank" rel="noopener noreferrer">Open resume</a></div> : <img src={image.url} alt={image.originalName} loading="lazy" />}
      <div className="image-library-item-info"><strong title={image.originalName}>{image.originalName}</strong><small>{formatSize(image.byteSize)} · {new Date(image.createdAt).toLocaleDateString()}</small><input readOnly aria-label={`URL for ${image.originalName}`} value={absoluteImageUrl(image)} onFocus={(event) => event.currentTarget.select()} /></div>
      <div className="image-library-item-actions"><button className="button secondary" type="button" onClick={() => copyUrl(image)}>Copy URL</button><button className="button secondary image-library-delete" type="button" disabled={busy} onClick={() => deleteImage(image)}>Delete</button></div>
    </article>)}</div> : <div className="image-library-empty">{error ? 'Your image library could not be loaded.' : 'No images yet. Upload an image to generate its reusable URL.'}</div>}
  </section>
}
