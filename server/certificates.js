import { deflateSync, inflateSync } from 'node:zlib'

const clean = (value, max = 200) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?').slice(0, max)
const xml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char])
const wrapText = (value, width, maxLines = 3) => {
  const result = []
  let line = ''
  for (const word of clean(value, 500).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (next.length > width && line) { result.push(line); line = word }
    else line = next
  }
  if (line) result.push(line)
  return result.slice(0, maxLines)
}

function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null
  let width, height, bitDepth, colorType, interlace
  const compressed = []
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const chunk = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') { width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); bitDepth = chunk[8]; colorType = chunk[9]; interlace = chunk[12] }
    if (type === 'IDAT') compressed.push(chunk)
    if (type === 'IEND') break
    offset += length + 12
  }
  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) return null
  const channels = colorType === 6 ? 4 : 3
  const stride = width * channels
  const raw = inflateSync(Buffer.concat(compressed))
  if (raw.length !== (stride + 1) * height) return null
  const decoded = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x]
      const left = x >= channels ? decoded[y * stride + x - channels] : 0
      const up = y ? decoded[(y - 1) * stride + x] : 0
      const upperLeft = y && x >= channels ? decoded[(y - 1) * stride + x - channels] : 0
      let predictor = 0
      if (filter === 1) predictor = left
      else if (filter === 2) predictor = up
      else if (filter === 3) predictor = Math.floor((left + up) / 2)
      else if (filter === 4) {
        const p = left + up - upperLeft
        const a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - upperLeft)
        predictor = a <= b && a <= c ? left : b <= c ? up : upperLeft
      } else if (filter !== 0) return null
      decoded[y * stride + x] = (value + predictor) & 255
    }
  }
  const rgb = Buffer.alloc(width * height * 3)
  const alpha = colorType === 6 ? Buffer.alloc(width * height) : null
  for (let i = 0; i < width * height; i++) {
    decoded.copy(rgb, i * 3, i * channels, i * channels + 3)
    if (alpha) alpha[i] = decoded[i * 4 + 3]
  }
  return { width, height, rgb: deflateSync(rgb), alpha: alpha ? deflateSync(alpha) : null }
}

export function createCertificateSvg(record, publicOrigin, imageAssets = {}) {
  const data = record.certificateData
  const dataUri = (content) => content ? `data:image/png;base64,${content.toString('base64')}` : ''
  const logoUrl = dataUri(imageAssets.logo) || `${publicOrigin}/assets/weblox-logo-light.png`
  const lines = wrapText(data.description || 'For outstanding dedication, practical contribution, and successful completion of the WEBLOX Internship Program.', 78, 3)
  const description = lines.map((line, index) => `<tspan x="600" dy="${index ? 26 : 0}">${xml(line)}</tspan>`).join('')
  const signature = (content, x) => content ? `<image x="${x}" y="638" width="280" height="55" preserveAspectRatio="xMidYMid meet" xlink:href="${xml(dataUri(content))}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="820" viewBox="0 0 1200 820"><defs><linearGradient id="paper" x2="1" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#f8f5ff"/></linearGradient></defs><rect width="1200" height="820" fill="url(#paper)"/><rect x="28" y="28" width="1144" height="764" rx="20" fill="none" stroke="#7140d8" stroke-width="3"/><rect x="44" y="44" width="1112" height="732" rx="14" fill="none" stroke="#d9c8ff" stroke-width="2"/><image x="500" y="260" width="200" height="200" opacity=".055" xlink:href="${xml(logoUrl)}"/><image x="92" y="75" width="74" height="74" preserveAspectRatio="xMidYMid meet" xlink:href="${xml(logoUrl)}"/><text x="188" y="108" font-family="Arial,sans-serif" font-weight="700" font-size="25" fill="#17131b">WEBLOX STUDIOS</text><text x="188" y="140" font-family="Arial,sans-serif" font-size="15" letter-spacing="4" fill="#7550bd">INTERNSHIP PROGRAM</text><text x="600" y="235" text-anchor="middle" font-family="Arial,sans-serif" font-size="19" letter-spacing="5" fill="#7040d2">CERTIFICATE OF INTERNSHIP</text><line x1="340" y1="258" x2="860" y2="258" stroke="#b79be8"/><text x="600" y="306" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" letter-spacing="3" fill="#77717f">THIS IS PROUDLY PRESENTED TO</text><text x="600" y="375" text-anchor="middle" font-family="Georgia,serif" font-size="45" font-weight="700" fill="#17131b">${xml(data.name)}</text><text x="600" y="421" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#60596a">${description}</text><text x="600" y="462" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#60596a">${xml(data.track)}${data.startDate || data.completionDate ? ` · ${xml(data.startDate || '')} – ${xml(data.completionDate || '')}` : ''}</text><line x1="118" y1="535" x2="1082" y2="535" stroke="#ded6e9"/><text x="120" y="585" font-family="Arial,sans-serif" font-size="13" letter-spacing="2" fill="#7b3ff2">CREDENTIAL ID</text><text x="120" y="617" font-family="Courier New,monospace" font-size="17" fill="#211735">${xml(data.credentialId)}</text><text x="1080" y="585" text-anchor="end" font-family="Arial,sans-serif" font-size="13" letter-spacing="2" fill="#7b3ff2">ISSUED</text><text x="1080" y="617" text-anchor="end" font-family="Arial,sans-serif" font-size="16" fill="#211735">${xml(data.issuedAt)}</text>${signature(imageAssets.signature1, 145)}${signature(imageAssets.signature2, 775)}<line x1="150" y1="700" x2="430" y2="700" stroke="#9488a6"/><line x1="770" y1="700" x2="1050" y2="700" stroke="#9488a6"/><text x="150" y="730" font-family="Arial,sans-serif" font-size="14" fill="#27222f">${xml(data.signatory1Name || data.signatoryName || 'WEBLOX Studios')}</text><text x="150" y="752" font-family="Arial,sans-serif" font-size="12" fill="#60596a">${xml(data.signatory1Title || data.signatoryTitle || 'Internship Program')}</text><text x="770" y="730" font-family="Arial,sans-serif" font-size="14" fill="#27222f">${xml(data.signatory2Name || '')}</text><text x="770" y="752" font-family="Arial,sans-serif" font-size="12" fill="#60596a">${xml(data.signatory2Title || '')}</text><text x="600" y="780" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#80798a">Verified WEBLOX Studios credential · ${xml(data.credentialId)}</text></svg>`
}

export function createCertificatePdfFromArtwork(png) {
  const artwork = decodePng(png)
  if (!artwork) throw new Error('Could not render the certificate artwork as a PDF.')
  const pageWidth = 842
  const pageHeight = 595
  const drawHeight = pageWidth * artwork.height / artwork.width
  const drawY = (pageHeight - drawHeight) / 2
  const stream = Buffer.from(`q ${pageWidth} 0 0 ${drawHeight.toFixed(4)} 0 ${drawY.toFixed(4)} cm /Artwork Do Q`, 'latin1')
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    null,
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    Buffer.from(`<< /Length ${stream.length} >>\nstream\n${stream.toString('latin1')}\nendstream`),
  ]
  let alphaId = null
  let imageId
  if (artwork.alpha) {
    alphaId = objects.length + 1
    objects.push(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${artwork.width} /Height ${artwork.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${artwork.alpha.length} >>\nstream\n`), artwork.alpha, Buffer.from('\nendstream')]))
    imageId = objects.length + 1
  } else imageId = objects.length + 1
  const softMask = alphaId ? ` /SMask ${alphaId} 0 R` : ''
  objects.push(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${artwork.width} /Height ${artwork.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${softMask} /Length ${artwork.rgb.length} >>\nstream\n`), artwork.rgb, Buffer.from('\nendstream')]))
  objects[2] = Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Artwork ${imageId} 0 R >> >> /Contents 5 0 R >>`)
  const parts = [Buffer.from('%PDF-1.4\n%WEBLOX\n')]
  const offsets = [0]
  let length = parts[0].length
  for (let index = 0; index < objects.length; index++) {
    offsets.push(length)
    const object = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), objects[index], Buffer.from('\nendobj\n')])
    parts.push(object)
    length += object.length
  }
  const xrefOffset = length
  const xref = [`xref\n0 ${objects.length + 1}\n`, '0000000000 65535 f \n', ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)].join('')
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`))
  return Buffer.concat(parts)
}
