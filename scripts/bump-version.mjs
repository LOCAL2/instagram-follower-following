import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = join(fileURLToPath(import.meta.url), '../..')
const MANIFEST_PATH = join(__dirname, 'extension', 'manifest.json')
const UPDATES_PATH = join(__dirname, 'public', 'updates.xml')

try {
  // 1. Read manifest
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  const oldVersion = manifest.version

  // 2. Increment version (patch)
  const parts = oldVersion.split('.').map(Number)
  if (parts.length < 3) parts.push(0)
  parts[parts.length - 1] += 1
  const newVersion = parts.join('.')
  manifest.version = newVersion

  // 3. Save manifest
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`✅ Version bumped: ${oldVersion} → ${newVersion}`)

  // 4. Generate updates.xml
  const xml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='ig-follower-tracker'>
    <updatecheck codebase='https://instagram-follower-tracker.vercel.app/extension.zip' version='${newVersion}' />
  </app>
</gupdate>`

  writeFileSync(UPDATES_PATH, xml)
  console.log(`✅ updates.xml updated to v${newVersion}`)
} catch (err) {
  console.error('❌ Failed to bump version:', err.message)
  process.exit(1)
}
