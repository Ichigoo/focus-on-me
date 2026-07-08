// Generates the three gentle chimes as 16-bit mono WAV files.
// Run once: node scripts/gen-sounds.mjs
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/renderer/src/assets/sounds')
mkdirSync(OUT, { recursive: true })

const RATE = 44100

function renderNotes(notes, totalSec) {
  const n = Math.floor(RATE * totalSec)
  const buf = new Float64Array(n)
  for (const { freq, start, dur, gain } of notes) {
    const s0 = Math.floor(start * RATE)
    const len = Math.floor(dur * RATE)
    for (let i = 0; i < len && s0 + i < n; i++) {
      const t = i / RATE
      const attack = Math.min(1, t / 0.015)
      const decay = Math.exp(-3.2 * (t / dur))
      const env = attack * decay * gain
      // fundamental + soft partials for a bell-ish timbre
      const v =
        Math.sin(2 * Math.PI * freq * t) * 0.7 +
        Math.sin(2 * Math.PI * freq * 2.0 * t) * 0.18 +
        Math.sin(2 * Math.PI * freq * 2.99 * t) * 0.08
      buf[s0 + i] += v * env
    }
  }
  // normalize with headroom
  let peak = 0
  for (const v of buf) peak = Math.max(peak, Math.abs(v))
  const scale = peak > 0 ? 0.55 / peak : 1
  return buf.map((v) => v * scale)
}

function toWav(samples) {
  const dataLen = samples.length * 2
  const wav = Buffer.alloc(44 + dataLen)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + dataLen, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20) // PCM
  wav.writeUInt16LE(1, 22) // mono
  wav.writeUInt32LE(RATE, 24)
  wav.writeUInt32LE(RATE * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(dataLen, 40)
  samples.forEach((v, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2))
  return wav
}

// pause-start: gentle descending pair — "let go"
writeFileSync(
  join(OUT, 'pause-start.wav'),
  toWav(
    renderNotes(
      [
        { freq: 659.26, start: 0, dur: 1.4, gain: 1.0 }, // E5
        { freq: 493.88, start: 0.35, dur: 1.6, gain: 0.9 } // B4
      ],
      2.2
    )
  )
)

// pause-end: gentle ascending pair — "back to it"
writeFileSync(
  join(OUT, 'pause-end.wav'),
  toWav(
    renderNotes(
      [
        { freq: 493.88, start: 0, dur: 1.3, gain: 0.9 }, // B4
        { freq: 659.26, start: 0.35, dur: 1.6, gain: 1.0 } // E5
      ],
      2.2
    )
  )
)

// warning: single soft ping
writeFileSync(
  join(OUT, 'warning.wav'),
  toWav(renderNotes([{ freq: 587.33, start: 0, dur: 1.2, gain: 0.8 }], 1.5)) // D5
)

console.log('chimes written to', OUT)
