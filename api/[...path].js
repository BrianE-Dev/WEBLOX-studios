const maxRequestBytes = 5 * 1024 * 1024

export const config = {
  api: { bodyParser: false },
}

async function readRequestBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxRequestBytes) throw new Error('Request body is too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  let apiOrigin
  try {
    const configuredOrigin = new URL(process.env.API_ORIGIN)
    if (!['http:', 'https:'].includes(configuredOrigin.protocol)) throw new Error()
    apiOrigin = configuredOrigin.origin
  } catch {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ error: 'The API proxy is not configured.' }))
  }

  let target
  try {
    target = new URL(req.url, `${apiOrigin}/`)
    if (target.origin !== apiOrigin) throw new Error()
  } catch {
    res.statusCode = 400
    return res.end('Invalid API path.')
  }

  const headers = new Headers()
  for (const name of ['accept', 'content-type', 'cookie', 'origin']) {
    const value = req.headers[name]
    if (typeof value === 'string') headers.set(name, value)
  }

  try {
    const method = req.method || 'GET'
    const body = ['GET', 'HEAD'].includes(method) ? undefined : await readRequestBody(req)
    const upstream = await fetch(target, { method, headers, body, redirect: 'manual' })

    for (const name of ['content-type', 'cache-control', 'etag', 'last-modified', 'location', 'vary']) {
      const value = upstream.headers.get(name)
      if (value) res.setHeader(name, value)
    }

    const cookies = upstream.headers.getSetCookie?.()
    if (cookies?.length) res.setHeader('set-cookie', cookies)
    else {
      const cookie = upstream.headers.get('set-cookie')
      if (cookie) res.setHeader('set-cookie', cookie)
    }

    res.statusCode = upstream.status
    if (method === 'HEAD' || upstream.status === 204 || upstream.status === 304) return res.end()
    return res.end(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    console.error('API proxy request failed:', error.message)
    res.statusCode = error.message === 'Request body is too large' ? 413 : 502
    res.setHeader('content-type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ error: error.message === 'Request body is too large' ? error.message : 'The API is temporarily unavailable.' }))
  }
}
