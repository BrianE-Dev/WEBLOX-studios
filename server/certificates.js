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

export function createCertificateSvg(record, publicOrigin) {
  const data = record.certificateData
  const logoUrl = `${publicOrigin}/assets/weblox-logo-light.png`
  const lines = wrapText(data.description || 'For outstanding dedication, practical contribution, and successful completion of the WEBLOX Internship Program.', 78, 3)
  const description = lines.map((line, index) => `<tspan x="600" dy="${index ? 26 : 0}">${xml(line)}</tspan>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="820" viewBox="0 0 1200 820"><defs><linearGradient id="paper" x2="1" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#f8f5ff"/></linearGradient></defs><rect width="1200" height="820" fill="url(#paper)"/><rect x="28" y="28" width="1144" height="764" rx="20" fill="none" stroke="#7140d8" stroke-width="3"/><rect x="44" y="44" width="1112" height="732" rx="14" fill="none" stroke="#d9c8ff" stroke-width="2"/><image x="500" y="260" width="200" height="200" opacity=".055" xlink:href="${xml(logoUrl)}"/><image x="92" y="75" width="74" height="74" xlink:href="${xml(logoUrl)}"/><text x="188" y="108" font-family="Arial,sans-serif" font-weight="700" font-size="25" fill="#17131b">WEBLOX STUDIOS</text><text x="188" y="140" font-family="Arial,sans-serif" font-size="15" letter-spacing="4" fill="#7550bd">INTERNSHIP PROGRAM</text><text x="600" y="235" text-anchor="middle" font-family="Arial,sans-serif" font-size="19" letter-spacing="5" fill="#7040d2">CERTIFICATE OF INTERNSHIP</text><line x1="340" y1="258" x2="860" y2="258" stroke="#b79be8"/><text x="600" y="306" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" letter-spacing="3" fill="#77717f">THIS IS PROUDLY PRESENTED TO</text><text x="600" y="375" text-anchor="middle" font-family="Georgia,serif" font-size="45" font-weight="700" fill="#17131b">${xml(data.name)}</text><text x="600" y="421" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#60596a">${description}</text><text x="600" y="462" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#60596a">${xml(data.track)}${data.startDate || data.completionDate ? ` · ${xml(data.startDate || '')} – ${xml(data.completionDate || '')}` : ''}</text><line x1="118" y1="535" x2="1082" y2="535" stroke="#ded6e9"/><text x="120" y="585" font-family="Arial,sans-serif" font-size="13" letter-spacing="2" fill="#7b3ff2">CREDENTIAL ID</text><text x="120" y="617" font-family="Courier New,monospace" font-size="17" fill="#211735">${xml(data.credentialId)}</text><text x="1080" y="585" text-anchor="end" font-family="Arial,sans-serif" font-size="13" letter-spacing="2" fill="#7b3ff2">ISSUED</text><text x="1080" y="617" text-anchor="end" font-family="Arial,sans-serif" font-size="16" fill="#211735">${xml(data.issuedAt)}</text><line x1="150" y1="700" x2="430" y2="700" stroke="#9488a6"/><line x1="770" y1="700" x2="1050" y2="700" stroke="#9488a6"/><text x="150" y="730" font-family="Arial,sans-serif" font-size="14" fill="#27222f">${xml(data.signatoryName || 'WEBLOX Studios')}</text><text x="770" y="730" font-family="Arial,sans-serif" font-size="14" fill="#27222f">${xml(data.signatoryTitle || 'Internship Program')}</text><text x="600" y="770" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#80798a">Verified WEBLOX Studios credential · ${xml(data.credentialId)}</text></svg>`
}

function escapePdf(value) {
  return clean(value, 500).replace(/([\\()])/g, '\\$1')
}

export function createCertificatePdf(data) {
  const ops = []
  const text = (value, x, y, size, color = '0.16 0.12 0.22', font = 'F1') => {
    ops.push(`${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`)
  }
  ops.push('0.99 0.98 1 rg 0 0 842 595 re f', '0.46 0.25 0.82 RG 2 w 22 22 798 551 re S', '0.84 0.77 0.94 RG 0.7 w 32 32 778 531 re S')
  text('WEBLOX', 310, 272, 86, '0.96 0.93 0.99', 'F2')
  text('WX', 365, 302, 112, '0.96 0.93 0.99', 'F2')
  text('W', 62, 505, 38, '0.48 0.20 0.88', 'F2')
  text('X', 88, 505, 38, '0.12 0.11 0.15', 'F2')
  text('WEBLOX STUDIOS', 140, 526, 17, '0.10 0.08 0.12', 'F2')
  text('INTERNSHIP PROGRAM', 140, 505, 9, '0.43 0.30 0.67')
  text('CERTIFICATE OF INTERNSHIP', 286, 452, 19, '0.39 0.22 0.73', 'F2')
  ops.push('0.70 0.61 0.84 RG 0.8 w 205 438 m 637 438 l S')
  text('THIS IS PROUDLY PRESENTED TO', 315, 403, 9, '0.43 0.41 0.47')
  text(data.name, 250, 357, 28, '0.10 0.08 0.12', 'F2')
  wrapText(data.description || 'For outstanding dedication, practical contribution, and successful completion of the WEBLOX Internship Program.', 86, 3).forEach((line, index) => text(line, 180, 326 - index * 15, 10, '0.35 0.33 0.38'))
  text(`Program: ${data.track}`, 250, 276, 10)
  text(`Period: ${data.startDate || '—'} to ${data.completionDate || '—'}`, 250, 258, 10)
  ops.push('0.86 0.82 0.90 RG 0.6 w 65 223 m 777 223 l S')
  text(`CREDENTIAL ID  ${data.credentialId}`, 65, 193, 10, '0.36 0.22 0.56', 'F2')
  text(`ISSUED  ${data.issuedAt}`, 610, 193, 10, '0.36 0.22 0.56', 'F2')
  ops.push('0.50 0.46 0.56 RG 0.7 w 82 92 m 300 92 l S 542 92 m 760 92 l S')
  text(data.signatoryName || 'WEBLOX Studios', 82, 74, 10)
  text(data.signatoryTitle || 'Internship Program', 542, 74, 10)
  text(`Verified WEBLOX Studios credential  |  ${data.credentialId}`, 260, 42, 8, '0.48 0.44 0.52')
  const stream = Buffer.from(ops.join('\n'), 'latin1')
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>'),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
    Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from('\nendstream')]),
  ]
  const parts = [Buffer.from('%PDF-1.4\n%WEBLOX\n')]
  const offsets = [0]
  let length = parts[0].length
  for (let i = 0; i < objects.length; i++) {
    offsets.push(length)
    const object = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), objects[i], Buffer.from('\nendobj\n')])
    parts.push(object); length += object.length
  }
  const xrefOffset = length
  const xref = [`xref\n0 ${objects.length + 1}\n`, '0000000000 65535 f \n', ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)].join('')
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`))
  return Buffer.concat(parts)
}
