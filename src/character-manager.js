const { app, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

// Fallback chain: when a custom character lacks a state, try these in order
const FALLBACK_CHAIN = {
  // Basic
  blink: ['idle'],
  idle_look: ['idle'],
  idle_stretch: ['idle'],
  // Conversation
  reading: ['idle'],
  thinking: ['idle'],
  speaking: ['idle'],
  confused: ['idle'],
  error: ['idle'],
  // Memory
  recall: ['thinking', 'idle'],
  learn: ['happy', 'idle'],
  forget: ['confused', 'idle'],
  // Proactive
  want_to_talk: ['idle'],
  notify: ['want_to_talk', 'idle'],
  check_in: ['idle'],
  // User interaction
  typing: ['idle'],
  drag: ['idle'],
  thrown: ['drag', 'idle'],
  poked: ['surprised', 'idle'],
  petted: ['happy', 'idle'],
  // Emotion
  happy: ['idle'],
  excited: ['happy', 'idle'],
  sad: ['idle'],
  surprised: ['idle'],
  love: ['happy', 'idle'],
  comfort: ['happy', 'idle'],
  // Environment
  sleepy: ['idle'],
  sleeping: ['sleepy', 'idle'],
  wakeup: ['idle'],
  greeting: ['happy', 'idle'],
  curious: ['idle_look', 'idle'],
  bored: ['idle'],
  // Movement
  walk: ['idle'],
  jump: ['idle'],
  fall: ['idle'],
  // Multimedia
  listening: ['idle'],
  voice_reply: ['speaking', 'idle'],
  viewing: ['reading', 'idle'],
  show_image: ['speaking', 'idle'],
}

const ALL_STATE_NAMES = [
  'idle', 'blink', 'idle_look', 'idle_stretch',
  'reading', 'thinking', 'speaking', 'confused', 'error',
  'recall', 'learn', 'forget',
  'want_to_talk', 'notify', 'check_in',
  'typing', 'drag', 'thrown', 'poked', 'petted',
  'happy', 'excited', 'sad', 'surprised', 'love', 'comfort',
  'sleepy', 'sleeping', 'wakeup', 'greeting', 'curious', 'bored',
  'walk', 'jump', 'fall',
  'listening', 'voice_reply', 'viewing', 'show_image',
]

let customStoragePath = null

function setStoragePath(p) {
  customStoragePath = p || null
}

function getStorageBase() {
  return customStoragePath || app.getPath('userData')
}

function getCharactersDir() {
  return path.join(getStorageBase(), 'characters')
}

function getOverridesDir() {
  return path.join(getStorageBase(), 'state-overrides')
}

function ensureCharactersDir() {
  const dir = getCharactersDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function listCharacters() {
  const dir = getCharactersDir()
  if (!fs.existsSync(dir)) return []

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const list = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const meta = getMeta(entry.name)
    if (meta) {
      list.push({ id: entry.name, ...meta })
    }
  }
  return list
}

function getMeta(charId) {
  const jsonPath = path.join(getCharactersDir(), charId, 'character.json')
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  } catch {
    return null
  }
}

function validatePack(packPath) {
  // Check if idle state exists in some form
  const sheetsDir = path.join(packPath, '_sheets')
  const hasSheetIdle = fs.existsSync(path.join(sheetsDir, 'idle_sheet.png'))
  const hasFrameIdle = fs.existsSync(path.join(packPath, 'idle')) &&
    fs.readdirSync(path.join(packPath, 'idle')).some(f => f.endsWith('.png'))
  const hasRootIdle = fs.existsSync(path.join(packPath, 'idle_sheet.png'))

  if (!hasSheetIdle && !hasFrameIdle && !hasRootIdle) {
    return { valid: false, error: 'missing_idle' }
  }
  return { valid: true }
}

function stitchFrames(framePaths, outPath) {
  if (framePaths.length === 0) return null

  // Sort frames numerically
  framePaths.sort((a, b) => {
    const numA = parseInt(path.basename(a).replace(/\D/g, '') || '0')
    const numB = parseInt(path.basename(b).replace(/\D/g, '') || '0')
    return numA - numB
  })

  const images = framePaths.map(f => nativeImage.createFromPath(f))
  const validImages = images.filter(img => !img.isEmpty())
  if (validImages.length === 0) return null

  const fw = validImages[0].getSize().width
  const fh = validImages[0].getSize().height
  const totalW = fw * validImages.length

  // Create combined bitmap (RGBA)
  const bitmap = Buffer.alloc(totalW * fh * 4, 0)
  for (let i = 0; i < validImages.length; i++) {
    const raw = validImages[i].toBitmap()
    for (let y = 0; y < fh; y++) {
      const srcOffset = y * fw * 4
      const dstOffset = (y * totalW + i * fw) * 4
      raw.copy(bitmap, dstOffset, srcOffset, srcOffset + fw * 4)
    }
  }

  const combined = nativeImage.createFromBitmap(bitmap, { width: totalW, height: fh })
  fs.writeFileSync(outPath, combined.toPNG())
  return { frameWidth: fw, frameHeight: fh, frameCount: validImages.length }
}

function autoGenerateJson(packPath) {
  const sheetsDir = path.join(packPath, '_sheets')
  const states = []
  let frameWidth = 32
  let frameHeight = 40

  // Detect available states from _sheets directory
  if (fs.existsSync(sheetsDir)) {
    const files = fs.readdirSync(sheetsDir)
    for (const f of files) {
      const m = f.match(/^(.+)_sheet\.png$/)
      if (m && ALL_STATE_NAMES.includes(m[1])) {
        states.push(m[1])
      }
    }
    // Read frame dimensions from idle sheet
    const idleSheet = path.join(sheetsDir, 'idle_sheet.png')
    if (fs.existsSync(idleSheet)) {
      const img = nativeImage.createFromPath(idleSheet)
      if (!img.isEmpty()) {
        const size = img.getSize()
        // Assume frames in idle: try common counts (3-8)
        // Best guess: height is frameHeight, width / frameCount = frameWidth
        frameHeight = size.height
        // Try to detect frameWidth by checking if width is divisible by common frame widths
        if (size.width % 32 === 0) frameWidth = 32
        else if (size.width % 48 === 0) frameWidth = 48
        else if (size.width % 64 === 0) frameWidth = 64
        else frameWidth = size.height // Square frames as fallback
      }
    }
  }

  const name = path.basename(packPath)
  const meta = {
    name,
    frameWidth,
    frameHeight,
    bottomPadding: 12,
    renderingMode: 'pixelated',
    states,
  }

  fs.writeFileSync(path.join(packPath, 'character.json'), JSON.stringify(meta, null, 2))
  return meta
}

function importPack(sourcePath) {
  const validation = validatePack(sourcePath)
  if (!validation.valid) return validation

  const charName = path.basename(sourcePath)
  const charId = charName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() + '_' + Date.now()
  const destDir = path.join(ensureCharactersDir(), charId)
  const sheetsDir = path.join(destDir, '_sheets')

  fs.mkdirSync(sheetsDir, { recursive: true })

  let detectedFw = 32, detectedFh = 40

  // Process each potential state
  for (const stateName of ALL_STATE_NAMES) {
    // Priority 1: pre-made sheet in _sheets/
    const srcSheet = path.join(sourcePath, '_sheets', `${stateName}_sheet.png`)
    if (fs.existsSync(srcSheet)) {
      fs.copyFileSync(srcSheet, path.join(sheetsDir, `${stateName}_sheet.png`))
      if (stateName === 'idle') {
        const img = nativeImage.createFromPath(srcSheet)
        if (!img.isEmpty()) {
          detectedFh = img.getSize().height
        }
      }
      continue
    }

    // Priority 2: pre-made sheet in root
    const rootSheet = path.join(sourcePath, `${stateName}_sheet.png`)
    if (fs.existsSync(rootSheet)) {
      fs.copyFileSync(rootSheet, path.join(sheetsDir, `${stateName}_sheet.png`))
      if (stateName === 'idle') {
        const img = nativeImage.createFromPath(rootSheet)
        if (!img.isEmpty()) {
          detectedFh = img.getSize().height
        }
      }
      continue
    }

    // Priority 3: individual frames in state subfolder → stitch
    const framesDir = path.join(sourcePath, stateName)
    if (fs.existsSync(framesDir) && fs.statSync(framesDir).isDirectory()) {
      const framePaths = fs.readdirSync(framesDir)
        .filter(f => f.endsWith('.png'))
        .map(f => path.join(framesDir, f))

      if (framePaths.length > 0) {
        const result = stitchFrames(framePaths, path.join(sheetsDir, `${stateName}_sheet.png`))
        if (result && stateName === 'idle') {
          detectedFw = result.frameWidth
          detectedFh = result.frameHeight
        }
      }
    }
  }

  // Copy character.json if exists, otherwise auto-generate
  const srcJson = path.join(sourcePath, 'character.json')
  if (fs.existsSync(srcJson)) {
    fs.copyFileSync(srcJson, path.join(destDir, 'character.json'))
  } else {
    // Auto-detect and generate
    const meta = autoGenerateJson(destDir)
    meta.frameWidth = detectedFw
    meta.frameHeight = detectedFh
    fs.writeFileSync(path.join(destDir, 'character.json'), JSON.stringify(meta, null, 2))
  }

  const meta = getMeta(charId)
  return { valid: true, id: charId, meta }
}

function deletePack(charId) {
  const dir = path.join(getCharactersDir(), charId)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
    return true
  }
  return false
}

function exportPack(charId, destPath) {
  const srcDir = path.join(getCharactersDir(), charId)
  if (!fs.existsSync(srcDir)) return false
  const meta = getMeta(charId)
  const folderName = (meta && meta.name) || charId
  const destDir = path.join(destPath, folderName)
  fs.cpSync(srcDir, destDir, { recursive: true })
  return true
}

function resolveSheetPath(charId, fileName, overrides) {
  // Extract state name from filename: "idle_sheet.png" → "idle"
  const match = fileName.match(/^(.+)_sheet\.png$/)
  if (!match) return path.join(__dirname, '..', 'output', 'sheets', fileName)
  const stateName = match[1]

  // Priority 1: user single-state override
  if (overrides && overrides[stateName]) {
    const p = overrides[stateName]
    if (fs.existsSync(p)) return p
  }

  // Priority 2: custom character's own sheet
  if (charId) {
    const charSheet = path.join(getCharactersDir(), charId, '_sheets', fileName)
    if (fs.existsSync(charSheet)) return charSheet
  }

  // Priority 3: fallback chain within custom character
  if (charId) {
    const chain = FALLBACK_CHAIN[stateName]
    if (chain) {
      for (const fb of chain) {
        const fbPath = path.join(getCharactersDir(), charId, '_sheets', `${fb}_sheet.png`)
        if (fs.existsSync(fbPath)) return fbPath
      }
    }
  }

  // Priority 4: built-in C1 sheet
  return path.join(__dirname, '..', 'output', 'sheets', fileName)
}

function buildResolvedStateMap(charId, overrides) {
  const map = {}
  for (const stateName of ALL_STATE_NAMES) {
    const fileName = `${stateName}_sheet.png`
    const resolved = resolveSheetPath(charId, fileName, overrides)
    // Determine source type
    if (overrides && overrides[stateName] && fs.existsSync(overrides[stateName])) {
      map[stateName] = { path: resolved, source: 'override' }
    } else if (charId) {
      const charSheet = path.join(getCharactersDir(), charId, '_sheets', fileName)
      if (fs.existsSync(charSheet)) {
        map[stateName] = { path: resolved, source: 'character' }
      } else {
        // Check if resolved via fallback
        const builtinPath = path.join(__dirname, '..', 'output', 'sheets', fileName)
        if (resolved === builtinPath) {
          map[stateName] = { path: resolved, source: 'builtin' }
        } else {
          // Resolved via fallback chain
          const fbName = path.basename(resolved).replace('_sheet.png', '')
          map[stateName] = { path: resolved, source: 'fallback', fallbackTo: fbName }
        }
      }
    } else {
      map[stateName] = { path: resolved, source: 'builtin' }
    }
  }
  return map
}

module.exports = {
  setStoragePath,
  getStorageBase,
  getCharactersDir,
  getOverridesDir,
  listCharacters,
  getMeta,
  validatePack,
  importPack,
  deletePack,
  exportPack,
  resolveSheetPath,
  buildResolvedStateMap,
  stitchFrames,
  FALLBACK_CHAIN,
  ALL_STATE_NAMES,
}
