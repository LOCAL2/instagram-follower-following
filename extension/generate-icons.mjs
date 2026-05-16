// Run: node extension/generate-icons.mjs
// Generates icon16.png, icon48.png, icon128.png using sharp or canvas
// Since we don't want extra deps, we'll create simple SVG-based icons as data

import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Simple SVG icon for the extension
function makeSVG(size) {
  const r = size * 0.18  // corner radius
  const stroke = Math.max(1.5, size * 0.08)
  const cx = size / 2
  const cr = size * 0.18  // circle radius
  const dotR = size * 0.07
  const dotX = size * 0.73
  const dotY = size * 0.27

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#f09433"/>
      <stop offset="25%"  stop-color="#e6683c"/>
      <stop offset="50%"  stop-color="#dc2743"/>
      <stop offset="75%"  stop-color="#cc2366"/>
      <stop offset="100%" stop-color="#bc1888"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <rect x="${size*0.08}" y="${size*0.08}" width="${size*0.84}" height="${size*0.84}" rx="${r*0.7}"
        fill="none" stroke="white" stroke-width="${stroke}"/>
  <circle cx="${cx}" cy="${cx}" r="${cr}" fill="none" stroke="white" stroke-width="${stroke}"/>
  <circle cx="${dotX}" cy="${dotY}" r="${dotR}" fill="white"/>
</svg>`
}

// Write SVG files (browsers can use SVG icons too, but we'll write them as-is)
// For PNG we'd need a renderer — write SVGs and rename for simplicity
for (const size of [16, 48, 128]) {
  const svg = makeSVG(size)
  writeFileSync(path.join(__dirname, `icon${size}.svg`), svg)
  console.log(`✅ icon${size}.svg created`)
}

console.log('\nNote: Chrome extensions need PNG icons.')
console.log('Convert the SVG files to PNG using any online converter or:')
console.log('  npx sharp-cli --input icon128.svg --output icon128.png')
console.log('\nOr just use the SVG files directly by updating manifest.json to reference .svg files.')
console.log('Chrome supports SVG icons in Manifest V3.')
