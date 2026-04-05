class SpriteRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.cache = new Map()
    this._cacheVersion = 0
    this.FRAME_WIDTH = options.frameWidth || 32
    this.FRAME_HEIGHT = options.frameHeight || 40
    this.PADDING = 8
    this.flipped = false
    this.scale = 4
    this.renderingMode = options.renderingMode || 'pixelated'
    this._frameImageData = null // cached ImageData for hit-testing
    this.RENDER_WIDTH = this.FRAME_WIDTH * this.scale
    this.RENDER_HEIGHT = this.FRAME_HEIGHT * this.scale
  }

  setScale(scale) {
    this.scale = scale
    this.RENDER_WIDTH = this.FRAME_WIDTH * scale
    this.RENDER_HEIGHT = this.FRAME_HEIGHT * scale
    const cw = this.RENDER_WIDTH + this.PADDING * 2
    const ch = this.RENDER_HEIGHT + this.PADDING * 2
    this.canvas.width = cw
    this.canvas.height = ch
    this.canvas.style.width = cw + 'px'
    this.canvas.style.height = ch + 'px'
  }

  loadSheet(stateName) {
    if (this.cache.has(stateName)) {
      return Promise.resolve(this.cache.get(stateName))
    }
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.cache.set(stateName, img)
        resolve(img)
      }
      img.onerror = reject
      img.src = `sprite:///${stateName}_sheet.png?v=${this._cacheVersion}`
    })
  }

  preloadSheets(stateNames) {
    return Promise.all(stateNames.map(name => this.loadSheet(name)))
  }

  setFlipped(flipped) {
    this.flipped = flipped
  }

  drawFrame(stateName, frameIndex) {
    const sheet = this.cache.get(stateName)
    if (!sheet) return

    const cw = this.RENDER_WIDTH + this.PADDING * 2
    const ch = this.RENDER_HEIGHT + this.PADDING * 2
    this.ctx.clearRect(0, 0, cw, ch)
    this.ctx.imageSmoothingEnabled = (this.renderingMode === 'smooth')

    const sx = frameIndex * this.FRAME_WIDTH
    if (this.flipped) {
      this.ctx.save()
      this.ctx.translate(this.PADDING + this.RENDER_WIDTH, this.PADDING)
      this.ctx.scale(-1, 1)
      this.ctx.drawImage(
        sheet,
        sx, 0, this.FRAME_WIDTH, this.FRAME_HEIGHT,
        0, 0, this.RENDER_WIDTH, this.RENDER_HEIGHT
      )
      this.ctx.restore()
    } else {
      this.ctx.drawImage(
        sheet,
        sx, 0, this.FRAME_WIDTH, this.FRAME_HEIGHT,
        this.PADDING, this.PADDING, this.RENDER_WIDTH, this.RENDER_HEIGHT
      )
    }
    // Cache full-frame pixel data for hit-testing (avoids per-mousemove getImageData)
    this._frameImageData = this.ctx.getImageData(0, 0, cw, ch)
  }

  detectCharacterBounds(stateName, frameIndex = 0) {
    const sheet = this.cache.get(stateName)
    if (!sheet) return null

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = this.FRAME_WIDTH
    tempCanvas.height = this.FRAME_HEIGHT
    const ctx = tempCanvas.getContext('2d')

    const sx = frameIndex * this.FRAME_WIDTH
    ctx.drawImage(sheet, sx, 0, this.FRAME_WIDTH, this.FRAME_HEIGHT, 0, 0, this.FRAME_WIDTH, this.FRAME_HEIGHT)

    const imageData = ctx.getImageData(0, 0, this.FRAME_WIDTH, this.FRAME_HEIGHT)
    const data = imageData.data
    let top = this.FRAME_HEIGHT, bottom = 0
    let weightedX = 0, totalAlpha = 0

    for (let y = 0; y < this.FRAME_HEIGHT; y++) {
      for (let x = 0; x < this.FRAME_WIDTH; x++) {
        const alpha = data[(y * this.FRAME_WIDTH + x) * 4 + 3]
        if (alpha > 0) {
          if (y < top) top = y
          if (y > bottom) bottom = y
          weightedX += x * alpha
          totalAlpha += alpha
        }
      }
    }

    if (totalAlpha === 0) return null
    return { top, bottom: bottom + 1, centerX: weightedX / totalAlpha }
  }

  isPixelOpaque(x, y) {
    if (this._frameImageData) {
      const idx = (y * this._frameImageData.width + x) * 4 + 3
      return this._frameImageData.data[idx] > 0
    }
    const pixel = this.ctx.getImageData(x, y, 1, 1).data
    return pixel[3] > 0
  }

  clearCache() {
    this.cache.clear()
    this._cacheVersion++
  }

  updateMeta(options) {
    this.FRAME_WIDTH = options?.frameWidth || 32
    this.FRAME_HEIGHT = options?.frameHeight || 40
    this.renderingMode = options?.renderingMode || 'pixelated'
    this.setScale(this.scale)
  }
}
