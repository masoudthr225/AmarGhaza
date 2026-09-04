#!/usr/bin/env node
/**
 * 🥇 نگهبان سیستم ری‌گیری طلا — scripts/launcher.mjs
 * اجرای بی‌صدا (بدون پنجرهٔ CMD) با «اجرای برنامه.vbs» فراخوانی می‌شود:
 *   ۱) جلوگیری از اجرای همزمان دو نسخه (تک‌نمونه)
 *   ۲) نصب وابستگی‌ها در اولین اجرا
 *   ۳) پشتیبان‌گیری خودکار از دیتابیس قبل از هر اجرا (نگهداری ۲۰ نسخهٔ آخر)
 *   ۴) ساخت مجدد خودکار اگر فایل‌های برنامه تغییر کرده باشند
 *   ۵) اجرای مخفی سرور روی 127.0.0.1:3000
 *   ۶) باز کردن خودکار مرورگر
 *   ۷) نگهبان: اگر سروَر بسته شود خودش دوباره بالا می‌آورد
 *      (۳ کرش در ۶۰ ثانیه → پیام خطا و توقف)
 *   ۸) STOP.bat → توقف کامل و تمیز
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.PORT || 3000)
const HOST = '127.0.0.1'
const URL = `http://${HOST}:${PORT}`

const LOG_DIR = path.join(ROOT, 'logs')
const LOG_FILE = path.join(LOG_DIR, 'launcher.log')
const DB_FILE = path.join(ROOT, 'db', 'custom.db')
const BACKUP_DIR = path.join(ROOT, 'db', 'backups')
const LOCK_FILE = path.join(ROOT, '.run.lock')
const STOP_FLAG = path.join(ROOT, 'stop.flag')
const BUILD_ID = path.join(ROOT, '.next', 'BUILD_ID')
const MAX_BACKUPS = 20

for (const d of [LOG_DIR, BACKUP_DIR]) {
  try { fs.mkdirSync(d, { recursive: true }) } catch {}
}

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const RUN_OPTS = { cwd: ROOT, windowsHide: true }

function log(msg) {
  const line = `[${new Date().toLocaleString('fa-IR')}] ${msg}`
  try { fs.appendFileSync(LOG_FILE, line + '\n') } catch {}
  console.log(line)
}

/** باز کردن آدرس در مرورگر پیش‌فرض — حتی اگر opener وجود نداشته باشد کرش نمی‌کند */
function openWith(url) {
  try {
    const child =
      process.platform === 'win32'
        ? spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true })
        : process.platform === 'darwin'
          ? spawn('open', [url], { detached: true, stdio: 'ignore' })
          : spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
    child.on('error', () => {}) // مثلاً xdg-open نصب نیست — مهم نیست
    child.unref()
  } catch {}
}

/** پیام‌گرافیکی خطا (ویندوز: PowerShell MessageBox) */
function msgBox(title, text) {
  try {
    if (process.platform === 'win32') {
      const c = spawn(
        'powershell.exe',
        [
          '-NoProfile', '-Command',
          `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${text.replace(/'/g, "''")}', '${title.replace(/'/g, "''")}')`,
        ],
        { detached: true, stdio: 'ignore', windowsHide: true }
      )
      c.on('error', () => {})
      c.unref()
    } else {
      log(`⛔ ${title}: ${text}`)
    }
  } catch {}
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function isAlive(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

/** تک‌نمونه — اگر نمونهٔ دیگری در حال اجراست فقط مرورگر را باز کن و خارج شو */
function ensureSingleInstance() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = Number(fs.readFileSync(LOCK_FILE, 'utf8').trim())
      if (pid && pid !== process.pid && isAlive(pid)) {
        log('نمونهٔ دیگری از برنامه در حال اجراست — فقط مرورگر باز می‌شود')
        openWith(URL)
        process.exit(0)
      }
    }
  } catch {}
  try { fs.writeFileSync(LOCK_FILE, String(process.pid)) } catch {}
}

/** اجرای یک فرمان و انتظار برای پایان آن (خروجی در لاگ) — با محدودیت زمانی اختیاری */
function run(cmd, args, label, timeoutMs = 0) {
  return new Promise((resolve) => {
    log(`${label}...`)
    let out = ''
    let timedOut = false
    const child = spawn(cmd, args, { ...RUN_OPTS, stdio: ['ignore', 'pipe', 'pipe'] })
    const collect = (d) => {
      out += d.toString()
      if (out.length > 300000) out = out.slice(-150000) // جلوگیری از بزرگ شدن بی‌رویه
    }
    child.stdout?.on('data', collect)
    child.stderr?.on('data', collect)
    let timer = null
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true
        try { child.kill('SIGKILL') } catch {}
      }, timeoutMs)
    }
    child.on('error', (e) => {
      if (timer) clearTimeout(timer)
      log(`❌ خطا در ${label}: ${e.message}`)
      resolve(false)
    })
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      if (timedOut) {
        log(`❌ ${label} بیش از حد معمول طول کشید و متوقف شد`)
        resolve(false)
      } else if (code === 0) {
        log(`✅ ${label} تمام شد`)
        resolve(true)
      } else {
        log(`❌ ${label} با کد ${code} تمام شد:\n${out.slice(-3000)}`)
        resolve(false)
      }
    })
  })
}

/** بررسی نسخهٔ Node.js — حداقل ۲۰ */
async function checkNodeVersion() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--version'], { ...RUN_OPTS, stdio: ['pipe', 'ignore', 'ignore'] })
    let out = ''
    child.stdout?.on('data', (d) => { out += d.toString() })
    child.on('error', () => resolve(true)) // مشخص نیست — بگذ ادامه دهد
    child.on('close', () => {
      const m = out.match(/v(\d+)/)
      if (m && Number(m[1]) < 20) {
        const ver = out.trim()
        log(`⛔ نسخهٔ Node.js قدیمی است: ${ver} — حداقل نسخهٔ ۲۰ لازم است`)
        msgBox(
          'سیستم ری‌گیری طلا — نسخهٔ Node.js قدیمی',
          `نسخهٔ Node.js شما ${ver} است ولی این برنامه حداقل نسخهٔ ۲۰ لازم دارد.\n\nلطفاً از nodejs.org جدیدترین نسخهٔ LTS را نصب و کامپیوتر را ری‌استارت کنید.`
        )
        resolve(false)
      } else {
        log(`✓ Node.js ${out.trim()}`)
        resolve(true)
      }
    })
  })
}

/** پشتیبان‌گیری از دیتابیس — نگهداری ۲۰ نسخهٔ آخر در db/backups */
function backupDb() {
  try {
    if (!fs.existsSync(DB_FILE)) return
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
    const dest = path.join(BACKUP_DIR, `gold-backup-${stamp}.db`)
    fs.copyFileSync(DB_FILE, dest)
    const all = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('gold-backup-')).sort()
    while (all.length > MAX_BACKUPS) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, all.shift())) } catch {}
    }
    log(`💾 پشتیبان دیتابیس: ${path.basename(dest)}`)
  } catch (e) {
    log(`⚠️ پشتیبان‌گیری ناموفق: ${e.message}`)
  }
}

/** آیا باید دوباره build گرفته شود؟ (BUILD_ID نباشد یا فایلی جدیدتر از آن باشد) */
function isBuildStale() {
  try {
    if (!fs.existsSync(BUILD_ID)) return true
    const builtAt = fs.statSync(BUILD_ID).mtimeMs

    let newest = 0
    const walk = (p) => {
      for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const full = path.join(p, entry.name)
        if (entry.isDirectory()) walk(full)
        else {
          try { newest = Math.max(newest, fs.statSync(full).mtimeMs) } catch {}
        }
      }
    }
    for (const d of ['src', 'prisma', 'public']) {
      const dir = path.join(ROOT, d)
      if (fs.existsSync(dir)) walk(dir)
    }
    if (newest > builtAt) return true

    for (const f of ['package.json', 'next.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'postcss.config.mjs']) {
      const full = path.join(ROOT, f)
      try {
        if (fs.existsSync(full) && fs.statSync(full).mtimeMs > builtAt) return true
      } catch {}
    }
    return false
  } catch {
    return true
  }
}

/** انتظار تا سرور جواب بدهد */
function waitUntilReady(timeoutMs = 90000) {
  return new Promise((resolve) => {
    const started = Date.now()
    const tick = () => {
      if (fs.existsSync(STOP_FLAG)) return resolve(false)
      if (Date.now() - started > timeoutMs) return resolve(false)
      const req = http.get(URL, { timeout: 3000 }, (res) => {
        res.resume()
        resolve(true)
      })
      req.on('error', () => setTimeout(tick, 1200))
      req.on('timeout', () => {
        req.destroy()
        setTimeout(tick, 1200)
      })
    }
    tick()
  })
}

let server = null
let stopping = false
let openedBrowser = false
let crashTimes = []

// حالت «فقط نصب اولیه» — با --setup-only از طرف اجرای برنامه.vbs فراخوانی می‌شود
const SETUP_ONLY = process.argv.includes('--setup-only')

function startServer() {
  const logFd = fs.openSync(LOG_FILE, 'a')
  server = spawn(
    process.execPath,
    [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-H', HOST, '-p', String(PORT)],
    { ...RUN_OPTS, stdio: ['ignore', logFd, logFd] }
  )
  log(`🚀 سرور راه‌اندازی شد (pid ${server.pid})`)
  server.on('exit', (code) => {
    if (stopping) return
    if (fs.existsSync(STOP_FLAG)) {
      log('سرور به درخواست کاربر متوقف شد.')
      cleanExit(0)
      return
    }
    log(`⚠️ سرور بسته شد (کد ${code}) — راه‌اندازی مجدد...`)
    handleCrash()
  })
}

async function handleCrash() {
  if (stopping) return
  if (fs.existsSync(STOP_FLAG)) {
    log('سرور به درخواست کاربر متوقف شد.')
    cleanExit(0)
    return
  }
  const now = Date.now()
  crashTimes = crashTimes.filter((t) => now - t < 60000)
  crashTimes.push(now)
  if (crashTimes.length >= 3) {
    log('⛔ سرور ۳ بار در ۶۰ ثانیه متوقف شد — اجرا متوقف می‌شود')
    msgBox(
      'سیستم ری‌گیری طلا — خطا',
      'برنامه پس از ۳ بار تلاش متوقف شد. برای بررسی، فایل logs/launcher.log را ببینید یا START.bat را اجرا کنید.'
    )
    cleanExit(1)
    return
  }
  await sleep(2500)
  if (stopping) return
  startServer()
  const ready = await waitUntilReady(60000)
  if (ready && !openedBrowser) {
    openedBrowser = true
    openWith(URL)
  }
}

function cleanExit(code) {
  stopping = true
  try {
    if (server && server.exitCode === null) server.kill()
  } catch {}
  try { fs.unlinkSync(LOCK_FILE) } catch {}
  try { fs.unlinkSync(STOP_FLAG) } catch {}
  process.exit(code)
}

process.on('SIGINT', () => cleanExit(0))
process.on('SIGTERM', () => cleanExit(0))

// خطاهای غیرمنتظره برنامه را از کار نینداز — فقط ثبت شوند
process.on('uncaughtException', (e) => log(`⚠️ خطای غیرمنتظره: ${e?.message || e} — ادامه می‌دهیم`))
process.on('unhandledRejection', (e) => log(`⚠️ رد شدن Promise: ${e} — ادامه می‌دهیم`))

async function main() {
  log('━━━ شروع launcher ━━━')

  // ۰) بررسی نسخهٔ Node.js (حداقل ۲۰)
  if (!(await checkNodeVersion())) return cleanExit(2)

  ensureSingleInstance()

  // ۱) وابستگی‌ها — با حداکثر ۲۰ دقیقه وقت (اینترنت کند)
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    log('اولین اجرا: نصب وابستگی‌ها آغاز شد')
    const ok = await run(NPM, ['install', '--no-audit', '--no-fund'], 'نصب وابستگی‌ها (اولین اجرا — چند دقیقه صبر کنید)', 20 * 60 * 1000)
    if (!ok) {
      msgBox(
        'سیستم ری‌گیری طلا — خطا در نصب',
        'نصب وابستگی‌ها ناموفق بود یا بیش از حد طول کشید.\n\n۱) اتصال اینترنت را بررسی کنید\n۲) آنتی‌ویروس/فایروال را موقتاً غیرفعال کنید\n۳) دوباره «اجرای برنامه.vbs» را اجرا کنید\n\nجزئیات: logs/launcher.log'
      )
      return cleanExit(2)
    }
  }

  // ۲) کلاینت دیتابیس — از قبل داخل پروژه است (src/generated/prisma)؛
  //    فقط اگر به‌هرعلتی نبود، با prisma generate ساخته می‌شود
  if (!fs.existsSync(path.join(ROOT, 'src', 'generated', 'prisma', 'index.js'))) {
    const ok = await run(NPM, ['run', 'db:generate'], 'ساخت کلاینت دیتابیس', 5 * 60 * 1000)
    if (!ok) {
      msgBox(
        'سیستم ری‌گیری طلا — خطا در کلاینت دیتابیس',
        'ساخت کلاینت دیتابیس ناموفق بود.\n\nجزئیات: logs/launcher.log\nیا با START.bat اجرا کنید.'
      )
      return cleanExit(2)
    }
  }

  // ۳) پشتیبان دیتابیس (لایهٔ دوم محافظت داده)
  backupDb()

  // ۴) ساخت در صورت نیاز
  if (isBuildStale()) {
    const ok = await run(NPM, ['run', 'build'], 'ساخت نسخهٔ اجرایی برنامه (اولین بار طول می‌کشد)', 30 * 60 * 1000)
    if (!ok) {
      msgBox(
        'سیستم ری‌گیری طلا — خطا در ساخت برنامه',
        'ساخت برنامه ناموفق بود.\n\n۱) سایر برنامه‌ها را ببندید (رم بیشتر آزاد شود)\n۲) دوباره «اجرای برنامه.vbs» را اجرا کنید\n\nجزئیات: logs/launcher.log'
      )
      return cleanExit(2)
    }
  }

  // ۵) حالت «فقط نصب» — بعد از نصب و ساخت خارج می‌شود؛ خودِ برنامه در اجرای بعدی (مخفی) بالا می‌آید
  if (SETUP_ONLY) {
    log('✅ نصب اولیه کامل شد — برنامه در حال راه‌اندازی (پنجرهٔ مخفی)')
    return cleanExit(0)
  }

  // ۶) اجرای مخفی سرور
  startServer()
  const ready = await waitUntilReady()
  if (ready) {
    log(`✅ برنامه آماده است: ${URL}`)
    openWith(URL)
    openedBrowser = true
  } else if (fs.existsSync(STOP_FLAG)) {
    log('سرور به درخواست کاربر متوقف شد.')
    return cleanExit(0)
  } else {
    log('⚠️ سرور در زمان مقرر پاسخ نداد — نگهبان فعال می‌ماند')
  }

  // ۷) حلقهٔ نگهبان — stop.flag را زیر نظر بگیر
  setInterval(() => {
    if (fs.existsSync(STOP_FLAG)) {
      log('سرور به درخواست کاربر متوقف شد.')
      cleanExit(0)
    }
  }, 1500)
}

main()
