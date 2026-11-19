/** Tests for the theme preference logic. Run with: npm run test:theme */
const t = await import('../src/lib/theme')
const out: string[] = []
const check = (n: string, p: boolean) => out.push(`${p ? 'PASS' : 'FAIL'}  ${n}`)

check('storage key is the shared one', t.THEME_KEY === 'wayamesh-theme')
check('"light" and "dark" parse as themselves', t.parsePref('light') === 'light' && t.parsePref('dark') === 'dark')
check('"system" parses as system', t.parsePref('system') === 'system')
for (const junk of [null, undefined, '', 'Light', 'DARK', 'auto', 'sepia', 1, {}, ['dark']]) check(`junk ${JSON.stringify(junk)} falls back to system`, t.parsePref(junk) === 'system')
check('explicit light wins over a dark system', t.resolveTheme('light', false) === 'light')
check('explicit dark wins over a light system', t.resolveTheme('dark', true) === 'dark')
check('system follows a light device', t.resolveTheme('system', true) === 'light')
check('system follows a dark device', t.resolveTheme('system', false) === 'dark')
check('readPref without storage does not throw and returns system', t.readPref() === 'system')
t.setThemePref('light')
t.toggleTheme()
check('setThemePref and toggleTheme without a DOM or storage do not throw', true)

// theme-init.js must agree with the TypeScript logic for every input.
const fs = await import('node:fs')
const src = fs.readFileSync(new URL('../public/theme-init.js', import.meta.url), 'utf8')
for (const stored of [null, 'light', 'dark', 'system', 'junk']) {
  for (const systemLight of [true, false]) {
    const attrs: Record<string, string> = {}
    const win = { matchMedia: () => ({ matches: systemLight }) }
    const doc = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v), style: {} as Record<string, string> }, querySelector: () => null }
    new Function('localStorage', 'window', 'document', src)({ getItem: () => stored }, win, doc)
    const expected = t.resolveTheme(t.parsePref(stored), systemLight)
    check(`theme-init.js stored=${stored} systemLight=${systemLight} -> ${expected}`, attrs['data-theme'] === expected && doc.documentElement.style.colorScheme === expected)
  }
}
const brokenStorage = { getItem: () => { throw new Error('blocked') } }
const a: Record<string, string> = {}
new Function('localStorage', 'window', 'document', src)(brokenStorage, { matchMedia: () => ({ matches: false }) }, { documentElement: { setAttribute: (k: string, v: string) => (a[k] = v), style: {} }, querySelector: () => null })
check('theme-init.js survives blocked storage and defaults to dark', a['data-theme'] === 'dark')

console.log(out.join('\n'))
const failed = out.filter((l) => l.startsWith('FAIL')).length
console.log(failed ? `\n${failed} FAILED` : `\nALL ${out.length} PASSED`)
process.exit(failed ? 1 : 0)
