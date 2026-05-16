// Run: node scripts/zip-extension.mjs
// Zips the extension/ folder into public/extension.zip so the website can serve it for download.

import { createWriteStream, readdirSync, statSync, readFileSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = join(fileURLToPath(import.meta.url), '../..')
const EXT_DIR = join(__dirname, 'extension')
const OUT_FILE = join(__dirname, 'public', 'extension.zip')

// Minimal ZIP writer (no dependencies needed)
function toBytes(str) {
  return Buffer.from(str, 'binary')
}

function uint16LE(n) {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n)
  return b
}

function uint32LE(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n)
  return b
}

// CRC-32 table
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function getAllFiles(dir, base = dir) {
  const results = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      results.push(...getAllFiles(full, base))
    } else {
      results.push({ full, rel: relative(base, full).replace(/\\/g, '/') })
    }
  }
  return results
}

const files = getAllFiles(EXT_DIR)
const entries = []
const centralDir = []
let offset = 0

const out = createWriteStream(OUT_FILE)

function write(buf) {
  out.write(buf)
  offset += buf.length
}

const now = new Date()
const dosDate =
  (((now.getFullYear() - 1980) & 0x7f) << 9) |
  (((now.getMonth() + 1) & 0x0f) << 5) |
  (now.getDate() & 0x1f)
const dosTime =
  ((now.getHours() & 0x1f) << 11) |
  ((now.getMinutes() & 0x3f) << 5) |
  ((Math.floor(now.getSeconds() / 2)) & 0x1f)

for (const { full, rel } of files) {
  const data = readFileSync(full)
  const crc = crc32(data)
  const nameBytes = Buffer.from(rel)
  const localHeaderOffset = offset

  // Local file header
  write(Buffer.from([0x50, 0x4b, 0x03, 0x04])) // signature
  write(uint16LE(20))           // version needed
  write(uint16LE(0))            // flags
  write(uint16LE(0))            // compression (stored)
  write(uint16LE(dosTime))
  write(uint16LE(dosDate))
  write(uint32LE(crc))
  write(uint32LE(data.length))  // compressed size
  write(uint32LE(data.length))  // uncompressed size
  write(uint16LE(nameBytes.length))
  write(uint16LE(0))            // extra field length
  write(nameBytes)
  write(data)

  entries.push({ rel, nameBytes, crc, size: data.length, localHeaderOffset })
}

const centralDirOffset = offset

for (const { nameBytes, crc, size, localHeaderOffset } of entries) {
  write(Buffer.from([0x50, 0x4b, 0x01, 0x02])) // signature
  write(uint16LE(20))           // version made by
  write(uint16LE(20))           // version needed
  write(uint16LE(0))            // flags
  write(uint16LE(0))            // compression
  write(uint16LE(dosTime))
  write(uint16LE(dosDate))
  write(uint32LE(crc))
  write(uint32LE(size))
  write(uint32LE(size))
  write(uint16LE(nameBytes.length))
  write(uint16LE(0))            // extra
  write(uint16LE(0))            // comment
  write(uint16LE(0))            // disk start
  write(uint16LE(0))            // internal attr
  write(uint32LE(0))            // external attr
  write(uint32LE(localHeaderOffset))
  write(nameBytes)
}

const centralDirSize = offset - centralDirOffset

// End of central directory
write(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
write(uint16LE(0))
write(uint16LE(0))
write(uint16LE(entries.length))
write(uint16LE(entries.length))
write(uint32LE(centralDirSize))
write(uint32LE(centralDirOffset))
write(uint16LE(0))

out.end(() => {
  console.log(`✅ extension.zip created → public/extension.zip (${entries.length} files)`)
})