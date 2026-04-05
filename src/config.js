const { app, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')
const APP_CATEGORIES_PATH = path.join(app.getPath('userData'), 'app-categories.json')
const DEFAULT_APP_CATEGORIES_PATH = path.join(__dirname, 'data', 'app-categories.json')

let _configCache = null

function load() {
  if (_configCache) return _configCache
  try {
    _configCache = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    _configCache = {}
  }
  return _configCache
}

function save(data) {
  const existing = load()
  const merged = { ...existing, ...data }
  _configCache = merged
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2))
}

function loadAppCategories() {
  try {
    if (fs.existsSync(APP_CATEGORIES_PATH)) {
      return JSON.parse(fs.readFileSync(APP_CATEGORIES_PATH, 'utf-8'))
    }
    const defaultContent = fs.readFileSync(DEFAULT_APP_CATEGORIES_PATH, 'utf-8')
    fs.writeFileSync(APP_CATEGORIES_PATH, defaultContent)
    return JSON.parse(defaultContent)
  } catch {
    return { categories: {} }
  }
}

function saveAppCategories(data) {
  fs.writeFileSync(APP_CATEGORIES_PATH, JSON.stringify(data, null, 2))
}

function isEncryptionAvailable() {
  return safeStorage.isEncryptionAvailable()
}

function encryptApiKey(plain) {
  if (!plain) return ''
  if (isEncryptionAvailable()) {
    return safeStorage.encryptString(plain).toString('base64')
  }
  return plain
}

function decryptApiKey(stored) {
  if (!stored) return ''
  if (isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(stored, 'base64'))
    } catch {
      return ''
    }
  }
  return stored
}

module.exports = { load, save, loadAppCategories, saveAppCategories, encryptApiKey, decryptApiKey, isEncryptionAvailable }
