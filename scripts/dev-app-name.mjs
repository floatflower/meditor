// `npm run dev` runs the stock node_modules/electron/dist/Electron.app, and macOS shows that bundle's
// own name ("Electron") in the menu bar and the Dock whatever the code says. This renames the dev
// bundle to the app's name. macOS only, development only (a packaged build is already named
// correctly), and safe to run repeatedly. Re-installing Electron puts the original name back; the
// next `npm run dev` simply applies it again.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

if (process.platform !== 'darwin') process.exit(0)

const bundle = 'node_modules/electron/dist/Electron.app'
const plist = `${bundle}/Contents/Info.plist`
if (!existsSync(plist)) process.exit(0)

const name = JSON.parse(readFileSync('package.json', 'utf8')).productName
const read = (key) => {
  try {
    return execFileSync('plutil', ['-extract', key, 'raw', plist], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

let changed = false
for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  if (name && read(key) !== name) {
    execFileSync('plutil', ['-replace', key, '-string', name, plist])
    changed = true
  }
}
// LaunchServices remembers the old name until it is told the bundle changed.
if (changed) {
  const lsregister =
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
  try {
    execFileSync(lsregister, ['-f', bundle])
  } catch {
    /* only the cache refresh failed; the name is still changed */
  }
  console.log(`dev app renamed to "${name}"`)
}
