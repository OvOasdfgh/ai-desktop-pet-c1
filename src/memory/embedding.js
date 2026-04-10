const path = require('path')

let env, pipeline
try {
  const transformers = require('@xenova/transformers')
  env = transformers.env
  pipeline = transformers.pipeline
} catch {
  // @xenova/transformers not available — all calls will return null
}

const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'
const IDLE_TIMEOUT = 60_000

let extractor = null
let unloadTimer = null

function setModelPath(appPath) {
  if (!env) return
  env.localModelPath = path.join(appPath, 'models')
  env.allowRemoteModels = false
  env.allowLocalModels = true
  // Disable WASM proxy (not needed in Node.js main process)
  env.backends.onnx.wasm.proxy = false
}

async function getExtractor() {
  if (!pipeline) return null
  if (unloadTimer) clearTimeout(unloadTimer)
  if (!extractor) {
    extractor = await pipeline('feature-extraction', MODEL_NAME, { quantized: true })
  }
  scheduleUnload()
  return extractor
}

async function generateEmbedding(text) {
  if (!text || !pipeline) return null
  try {
    const ext = await getExtractor()
    if (!ext) return null
    const output = await ext(text, { pooling: 'mean', normalize: true })
    return Array.from(output.data)
  } catch {
    return null
  }
}

function scheduleUnload() {
  if (unloadTimer) clearTimeout(unloadTimer)
  unloadTimer = setTimeout(() => {
    if (extractor) {
      extractor.dispose?.()
      extractor = null
    }
  }, IDLE_TIMEOUT)
}

function dispose() {
  if (unloadTimer) clearTimeout(unloadTimer)
  unloadTimer = null
  if (extractor) {
    extractor.dispose?.()
    extractor = null
  }
}

module.exports = { setModelPath, generateEmbedding, dispose }
