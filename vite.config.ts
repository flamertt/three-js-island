import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Yol düzenlemelerini doğrudan veri dosyasına yazan dev API
// GET  /api/road-edits → mevcut dosya (yoksa boş)
// POST /api/road-edits → gövdeyi public/data/road-edits.json'a yaz
function roadEditsApi(): Plugin {
  const fileFor = (reqUrl: string | undefined) => {
    const m = /city=([a-z0-9_-]+)/i.exec(reqUrl ?? '')
    const city = m ? m[1].toLowerCase() : 'shinjuku'
    // shinjuku → eski dosya adı (mevcut düzenlemeler korunur)
    const name = city === 'shinjuku' ? 'road-edits.json' : `road-edits-${city}.json`
    return resolve(__dirname, 'public/data', name)
  }
  return {
    name: 'road-edits-api',
    configureServer(server) {
      server.middlewares.use('/api/road-edits', (req, res) => {
        const file = fileFor(req.url)
        if (req.method === 'GET') {
          const body = existsSync(file) ? readFileSync(file, 'utf8') : '{"removed":[],"added":[]}'
          res.setHeader('Content-Type', 'application/json')
          res.end(body)
          return
        }
        if (req.method === 'POST') {
          let data = ''
          req.on('data', (c) => { data += c })
          req.on('end', () => {
            try {
              JSON.parse(data)                       // doğrula
              mkdirSync(dirname(file), { recursive: true })
              writeFileSync(file, data)
              res.statusCode = 200
              res.end('{"ok":true}')
            } catch {
              res.statusCode = 400
              res.end('{"ok":false}')
            }
          })
          return
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), roadEditsApi()],
})
