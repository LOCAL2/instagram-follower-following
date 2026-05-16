// Generates PNG icons for the Chrome extension using pure Node.js (no deps)
// Draws the Instagram camera icon with gradient background

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Minimal PNG encoder ───────────────────────────────────────────────────────

function crc32(buf) {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  let crc = 0xffffffff
  for (const b of buf) crc = t[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function u32be(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const d = Buffer.from(data)
  const len = u32be(d.length)
  const crcBuf = Buffer.concat([t, d])
  const c = u32be(crc32(crcBuf))
  return Buffer.from([...len, ...t, ...d, ...c])
}

function encodePNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA, row by row
  const raw = []
  for (let y = 0; y < height; y++) {
    raw.push(0) // filter type None
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      raw.push(pixels[i], pixels[i+1], pixels[i+2], pixels[i+3])
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(raw))
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),          // PNG signature
    chunk('IHDR', [...u32be(width), ...u32be(height), 8, 2, 0, 0, 0]), // RGB — wait, use 8,6 for RGBA
    chunk('IDAT', compressed),
    chunk('IEND', []),
  ])
}

// Fix: IHDR color type 6 = RGBA
function encodePNGRGBA(width, height, pixels) {
  const raw = []
  for (let y = 0; y < height; y++) {
    raw.push(0)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      raw.push(pixels[i], pixels[i+1], pixels[i+2], pixels[i+3])
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(raw))
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', [...u32be(width), ...u32be(height), 8, 6, 0, 0, 0]),
    chunk('IDAT', compressed),
    chunk('IEND', []),
  ])
}

// ── Draw icon ─────────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t }

function igGradient(x, y, size) {
  // Instagram gradient: bottom-left yellow → top-right purple
  // radial from bottom-left
  const dx = x / size
  const dy = 1 - y / size
  const t  = (dx * 0.4 + dy * 0.6)

  // stops: 0=yellow, 0.2=orange, 0.5=red, 0.7=pink, 1=purple-blue
  const stops = [
    [253, 244, 151],  // #fdf497
    [253, 89,  73],   // #fd5949
    [214, 36,  159],  // #d6249f
    [40,  90,  235],  // #285AEB
  ]
  const n = stops.length - 1
  const i = Math.min(Math.floor(t * n), n - 1)
  const f = t * n - i
  return [
    Math.round(lerp(stops[i][0], stops[i+1][0], f)),
    Math.round(lerp(stops[i][1], stops[i+1][1], f)),
    Math.round(lerp(stops[i][2], stops[i+1][2], f)),
  ]
}

function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const r  = size / 2        // outer radius for rounded rect
  const rr = size * 0.22     // corner radius of rounded square

  function setPixel(x, y, r2, g2, b2, a2) {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 4
    // Alpha blend over existing
    const alpha = a2 / 255
    pixels[i]   = Math.round(pixels[i]   * (1 - alpha) + r2 * alpha)
    pixels[i+1] = Math.round(pixels[i+1] * (1 - alpha) + g2 * alpha)
    pixels[i+2] = Math.round(pixels[i+2] * (1 - alpha) + b2 * alpha)
    pixels[i+3] = Math.min(255, pixels[i+3] + a2)
  }

  // Anti-aliased rounded rect check
  function inRoundedRect(x, y, margin = 0) {
    const pad = size * 0.06 + margin
    const rx = rr - margin
    const x0 = pad, y0 = pad, x1 = size - pad, y1 = size - pad
    if (x < x0 || x > x1 || y < y0 || y > y1) return 0
    // Check corners
    const corners = [[x0+rx,y0+rx],[x1-rx,y0+rx],[x0+rx,y1-rx],[x1-rx,y1-rx]]
    for (const [cx2,cy2] of corners) {
      if (x < cx2 && y < cy2 && Math.hypot(x-cx2,y-cy2) > rx) return 0
      if (x > size-cx2+rx && y < cy2 && Math.hypot(x-(size-cx2+rx),y-cy2) > rx) return 0
    }
    return 1
  }

  // 1. Draw gradient background with rounded corners (anti-aliased)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Super-sample 2x2
      let coverage = 0
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const fx = x + sx * 0.5 + 0.25
          const fy = y + sy * 0.5 + 0.25
          const pad = size * 0.06
          const rx2 = rr
          const x0 = pad, y0 = pad, x1 = size - pad, y1 = size - pad
          let inside = fx >= x0 && fx <= x1 && fy >= y0 && fy <= y1
          if (inside) {
            const corners2 = [
              [x0+rx2, y0+rx2], [x1-rx2, y0+rx2],
              [x0+rx2, y1-rx2], [x1-rx2, y1-rx2],
            ]
            for (const [ccx, ccy] of corners2) {
              if (fx < ccx && fy < ccy && Math.hypot(fx-ccx, fy-ccy) > rx2) { inside = false; break }
              if (fx > x1-(x0+rx2-x0) && fy < ccy) { /* handled */ }
            }
          }
          if (inside) coverage++
        }
      }
      if (coverage > 0) {
        const [gr, gg, gb] = igGradient(x, y, size)
        const a = Math.round(coverage / 4 * 255)
        setPixel(x, y, gr, gg, gb, a)
      }
    }
  }

  // Helper: draw anti-aliased circle stroke
  function drawCircleStroke(ocx, ocy, radius, strokeW, r2, g2, b2) {
    const inner = radius - strokeW / 2
    const outer = radius + strokeW / 2
    for (let y = Math.floor(ocy - outer - 1); y <= Math.ceil(ocy + outer + 1); y++) {
      for (let x = Math.floor(ocx - outer - 1); x <= Math.ceil(ocx + outer + 1); x++) {
        const d = Math.hypot(x - ocx, y - ocy)
        const dist = Math.abs(d - radius)
        const alpha = Math.max(0, 1 - dist / (strokeW / 2)) * 255
        if (alpha > 0) setPixel(x, y, r2, g2, b2, alpha)
      }
    }
  }

  // Helper: draw anti-aliased rounded rect stroke
  function drawRRStroke(x0, y0, w, h, cr, strokeW, r2, g2, b2) {
    const x1 = x0 + w, y1 = y0 + h
    const steps = size * 8
    // Trace the outline
    for (let i = 0; i <= steps; i++) {
      const t2 = i / steps
      let px, py
      const perim = 2*(w+h) - 8*cr + 2*Math.PI*cr
      const pos = t2 * perim
      const seg1 = w - 2*cr, seg2 = h - 2*cr
      // top edge
      if (pos < seg1) { px = x0+cr+pos; py = y0 }
      // top-right corner
      else if (pos < seg1 + Math.PI/2*cr) { const a = -(Math.PI/2) + (pos-seg1)/cr; px = x1-cr+Math.cos(a)*cr; py = y0+cr+Math.sin(a)*cr }
      // right edge
      else if (pos < seg1 + Math.PI/2*cr + seg2) { px = x1; py = y0+cr+(pos-seg1-Math.PI/2*cr) }
      // bottom-right
      else if (pos < seg1 + Math.PI*cr + seg2) { const a = (pos-seg1-Math.PI/2*cr-seg2)/cr; px = x1-cr+Math.cos(a)*cr; py = y1-cr+Math.sin(a)*cr }
      // bottom edge
      else if (pos < 2*seg1 + Math.PI*cr + seg2) { px = x1-cr-(pos-seg1-Math.PI*cr-seg2); py = y1 }
      // bottom-left
      else if (pos < 2*seg1 + 3*Math.PI/2*cr + seg2) { const a = Math.PI/2+(pos-2*seg1-Math.PI*cr-seg2)/cr; px = x0+cr+Math.cos(a)*cr; py = y1-cr+Math.sin(a)*cr }
      // left edge
      else if (pos < 2*seg1 + 3*Math.PI/2*cr + 2*seg2) { px = x0; py = y1-cr-(pos-2*seg1-3*Math.PI/2*cr-seg2) }
      // top-left
      else { const a = Math.PI+(pos-2*seg1-3*Math.PI/2*cr-2*seg2)/cr; px = x0+cr+Math.cos(a)*cr; py = y0+cr+Math.sin(a)*cr }

      // Paint stroke around this point
      for (let dy = -Math.ceil(strokeW); dy <= Math.ceil(strokeW); dy++) {
        for (let dx = -Math.ceil(strokeW); dx <= Math.ceil(strokeW); dx++) {
          const d = Math.hypot(dx, dy)
          const alpha = Math.max(0, 1 - Math.max(0, d - strokeW/2)) * 255
          if (alpha > 4) setPixel(Math.round(px+dx), Math.round(py+dy), r2, g2, b2, alpha)
        }
      }
    }
  }

  const pad    = size * 0.06
  const sw     = Math.max(1.5, size * 0.075)  // stroke width
  const inner  = pad + sw * 1.5
  const boxW   = size - inner * 2
  const boxCR  = rr * 0.55

  // 2. Outer rounded rect border
  drawRRStroke(inner, inner, boxW, boxW, boxCR, sw, 255, 255, 255)

  // 3. Center circle
  const circR  = size * 0.185
  drawCircleStroke(cx, cy, circR, sw, 255, 255, 255)

  // 4. Dot (top-right)
  const dotR   = size * 0.055
  const dotX   = size * 0.725
  const dotY   = size * 0.275
  for (let y = Math.floor(dotY - dotR - 1); y <= Math.ceil(dotY + dotR + 1); y++) {
    for (let x = Math.floor(dotX - dotR - 1); x <= Math.ceil(dotX + dotR + 1); x++) {
      const d = Math.hypot(x - dotX, y - dotY)
      const alpha = Math.max(0, 1 - Math.max(0, d - dotR + 0.5)) * 255
      if (alpha > 0) setPixel(x, y, 255, 255, 255, alpha)
    }
  }

  return pixels
}

// ── Generate icons ────────────────────────────────────────────────────────────
for (const size of [16, 48, 128]) {
  const pixels = drawIcon(size)
  const png    = encodePNGRGBA(size, size, pixels)
  const out    = join(__dir, '..', 'extension', `icon${size}.png`)
  writeFileSync(out, png)
  console.log(`✅ icon${size}.png (${png.length} bytes)`)
}
