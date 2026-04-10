const fs = require('fs')
const path = require('path')

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

class VectorStore {
  constructor() {
    this.vectors = []
    this.filePath = null
    this.dirty = false
    this.saveTimer = null
  }

  init(memoryBasePath) {
    this.filePath = path.join(memoryBasePath, 'vectors.json')
    this.load()
  }

  load() {
    if (!this.filePath) return
    try {
      if (fs.existsSync(this.filePath)) {
        this.vectors = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
      }
    } catch { this.vectors = [] }
  }

  save() {
    if (!this.filePath || !this.dirty) return
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(this.vectors))
      this.dirty = false
    } catch { /* silent */ }
  }

  scheduleSave() {
    this.dirty = true
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.save(), 2000)
  }

  add(source, sourceId, text, embedding) {
    if (!embedding) return
    // Deduplicate: remove existing entry with same source+sourceId
    this.vectors = this.vectors.filter(v => !(v.source === source && v.sourceId === sourceId))
    this.vectors.push({
      id: `${source}:${sourceId}`,
      source,
      sourceId,
      text: (text || '').slice(0, 200),
      embedding
    })
    this.scheduleSave()
  }

  removeBySource(source, sourceId) {
    const before = this.vectors.length
    if (sourceId !== undefined) {
      this.vectors = this.vectors.filter(v => !(v.source === source && v.sourceId === sourceId))
    } else {
      this.vectors = this.vectors.filter(v => v.source !== source)
    }
    if (this.vectors.length !== before) this.scheduleSave()
  }

  removeBySourcePrefix(source, prefix) {
    const before = this.vectors.length
    this.vectors = this.vectors.filter(v => !(v.source === source && v.sourceId.startsWith(prefix)))
    if (this.vectors.length !== before) this.scheduleSave()
  }

  removeAll() {
    this.vectors = []
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.dirty = false
    if (this.filePath) {
      try { if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath) } catch { /* silent */ }
    }
  }

  search(queryEmbedding, topK = 10) {
    if (!queryEmbedding || this.vectors.length === 0) return []
    return this.vectors
      .map(v => ({ source: v.source, sourceId: v.sourceId, text: v.text, score: cosineSimilarity(queryEmbedding, v.embedding) }))
      .filter(v => v.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  reinit(newMemoryBasePath) {
    this.save()
    this.init(newMemoryBasePath)
  }

  dispose() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.save()
  }
}

module.exports = { VectorStore }
