export async function uploadDashboardImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, WebP, or GIF image.')
  }
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Images must be smaller than 5 MB.')

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })
  const response = await fetch('/api/media/library', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: file.name, contentType: file.type, data: String(dataUrl).split(',')[1] }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Image upload failed.')
  return result.image
}

export function absoluteImageUrl(image) {
  return new URL(image.url, window.location.origin).href
}
