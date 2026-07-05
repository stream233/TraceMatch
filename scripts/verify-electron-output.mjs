import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const requiredFiles = [
  path.join(root, 'out', 'main', 'index.js'),
  path.join(root, 'out', 'preload', 'index.cjs'),
  path.join(root, 'out', 'renderer', 'index.html')
]

await Promise.all(requiredFiles.map((file) => access(file)))

const mainBundle = await readFile(requiredFiles[0], 'utf8')
if (!mainBundle.includes('../preload/index.cjs')) {
  throw new Error('Main bundle does not reference the generated preload/index.cjs file.')
}

const preloadBundle = await readFile(requiredFiles[1], 'utf8')
if (!preloadBundle.includes('require("electron")')) {
  throw new Error('Preload bundle must load Electron as a runtime external.')
}
if (preloadBundle.includes('child_process') || preloadBundle.includes('Downloading Electron binary')) {
  throw new Error('Preload bundle incorrectly contains the Electron npm launcher.')
}

console.log('Electron output verified: main, preload, and renderer entry points are aligned.')
