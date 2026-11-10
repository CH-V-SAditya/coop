// Serves Supabase's URL layout locally: /rest/v1/* -> PostgREST. Started by local-stack.mjs.
import http from 'node:http'

const port = Number(process.env.PROXY_PORT ?? 54321)
const upstream = Number(process.env.POSTGREST_PORT ?? 54330)
const agent = new http.Agent({ keepAlive: true, maxSockets: 256 })

http
  .createServer((req, res) => {
    if (!req.url?.startsWith('/rest/v1')) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: 'The local stack only serves /rest/v1 (no Supabase Auth locally)' }))
      return
    }
    const path = req.url.slice('/rest/v1'.length) || '/'
    const out = http.request(
      { host: '127.0.0.1', port: upstream, path, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${upstream}` }, agent },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers)
        up.pipe(res)
      },
    )
    out.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: `PostgREST unreachable: ${err.message}` }))
    })
    req.pipe(out)
  })
  .listen(port, '127.0.0.1')
