// Simple proxy server that forwards requests to Instagram API
// with the user-provided cookie (so CORS is bypassed server-side)
//
// Run: node server.mjs
// Then open: http://localhost:3000

import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 3000

app.use(cors({ origin: '*' }))
app.use(express.json())

// Proxy endpoint — receives { path, cookie } and forwards to Instagram
app.post('/proxy', async (req, res) => {
  const { path: igPath, cookie } = req.body

  if (!igPath || !cookie) {
    return res.status(400).json({ error: 'Missing path or cookie' })
  }

  // Only allow Instagram API paths
  if (!igPath.startsWith('/api/v1/')) {
    return res.status(403).json({ error: 'Forbidden path' })
  }

  const url = `https://www.instagram.com${igPath}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': cookie,
        'X-IG-App-ID': '936619743392459',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/',
        'Origin': 'https://www.instagram.com',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })

    const text = await response.text()
    console.log(`[proxy] ${response.status} ${igPath}`)
    if (!response.ok) {
      console.log(`[proxy] response body:`, text.slice(0, 300))
    }

    let data
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    res.json(data)
  } catch (err) {
    console.error('[proxy] fetch error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Serve the built React app
app.use(express.static(path.join(__dirname, 'dist')))
app.get('/{*splat}', (_, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

createServer(app).listen(PORT, () => {
  console.log(`\n✅ Server running at http://localhost:${PORT}`)
  console.log(`   Open the URL above in your browser\n`)
})
