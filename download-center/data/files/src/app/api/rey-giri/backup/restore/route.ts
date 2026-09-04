import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { getDbPath, reconnectDb } from '@/lib/db'

const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function toFa(n: number): string {
  const fa = '۰۱۲۳۴۵۶۷۸۹'
  return String(n).replace(/\d/g, (d) => fa[Number(d)])
}

/** بررسی اینکه فایل واقعاً دیتابیس معتبر برنامه است (هدر SQLite + جدول ReyGiri) */
async function validateDbFile(filePath: string): Promise<number> {
  // ۱) هدر SQLite
  const header = Buffer.alloc(16)
  const fd = fs.openSync(filePath, 'r')
  fs.readSync(fd, header, 0, 16, 0)
  fs.closeSync(fd)
  if (header.toString('utf8').slice(0, 15) !== 'SQLite format 3') {
    throw new Error('این فایل یک دیتابیس SQLite معتبر نیست')
  }

  // ۲) جدول ReyGiri قابل خواندن باشد
  let client: PrismaClient | null = null
  try {
    const adapter = new PrismaLibSQL({ url: 'file:' + filePath })
    client = new PrismaClient({ adapter })
    const count = await client.reyGiri.count({ where: { deletedAt: null } })
    return count
  } finally {
    try { await client?.$disconnect() } catch {}
  }
}

/** جایگزینی فایل دیتابیس — با چند تلاش (ویندوز ممکن است لحظه‌ای فایل را قفل کند) */
async function replaceDbFile(source: string): Promise<void> {
  const dest = getDbPath()
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      fs.copyFileSync(source, dest)
      return
    } catch (e) {
      if (attempt === 5) throw e
      await sleep(400)
    }
  }
}

/**
 * POST — بازیابی از بکاپ
 * حالت ۱: multipart با فیلد file → بازیابی از فایل بکاپ آپلودی
 * حالت ۲: JSON با نام فایل → بازیابی از یکی از بکاپ‌های موجود در db/backups
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''
  let sourcePath: string
  let cleanupTemp: string | null = null

  try {
    let uploadedName = 'بکاپ'

    if (contentType.includes('multipart/form-data')) {
      // ─── حالت ۱: فایل آپلودی ───
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'فایلی انتخاب نشده است' },
          { status: 400 }
        )
      }
      if (!file.name.toLowerCase().endsWith('.db')) {
        return NextResponse.json(
          { success: false, error: 'فایل بکاپ باید با پسوند .db باشد' },
          { status: 400 }
        )
      }
      uploadedName = file.name
      const buffer = Buffer.from(await file.arrayBuffer())
      if (buffer.length < 100) {
        return NextResponse.json(
          { success: false, error: 'فایل بکاپ خیلی کوچک است — معتبر نیست' },
          { status: 400 }
        )
      }

      fs.mkdirSync(BACKUP_DIR, { recursive: true })
      const tmp = path.join(BACKUP_DIR, `.restore-tmp-${Date.now()}.db`)
      fs.writeFileSync(tmp, buffer)
      cleanupTemp = tmp
      sourcePath = tmp
    } else {
      // ─── حالت ۲: بکاپ موجود در db/backups ───
      const body = await request.json().catch(() => ({}))
      const name = String((body as any)?.name || '')
      // جلوگیری از مسیردهی خارج از پوشهٔ بکاپ‌ها
      if (!/^gold-(backup|manual)-[\w\-]+\.db$/.test(name)) {
        return NextResponse.json(
          { success: false, error: 'نام فایل بکاپ معتبر نیست' },
          { status: 400 }
        )
      }
      const full = path.join(BACKUP_DIR, name)
      if (!fs.existsSync(full)) {
        return NextResponse.json(
          { success: false, error: 'این نسخهٔ پشتیبان پیدا نشد' },
          { status: 404 }
        )
      }
      uploadedName = name
      sourcePath = full
    }

    // ۱) اعتبارسنجی فایل قبل از هر کاری
    let recordCount: number
    try {
      recordCount = await validateDbFile(sourcePath)
    } catch (e) {
      if (cleanupTemp) { try { fs.unlinkSync(cleanupTemp) } catch {} }
      return NextResponse.json(
        {
          success: false,
          error: `این فایل یک بکاپ معتبر برنامه نیست (${e instanceof Error ? e.message : 'خطای ناشناخته'})`,
        },
        { status: 400 }
      )
    }

    // ۲) قبل از بازیابی، از وضعیت فعلی نسخهٔ امن بگیر (لایهٔ محافظت)
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const dbPath = getDbPath()
    if (fs.existsSync(dbPath)) {
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      fs.copyFileSync(dbPath, path.join(BACKUP_DIR, `gold-backup-before-restore-${stamp}.db`))
    }

    // ۳) قطع اتصال → جایگزینی فایل → اتصال تازه (بدون ری‌استارت سرور)
    await reconnectDb()
    await replaceDbFile(sourcePath)
    await reconnectDb()

    if (cleanupTemp) { try { fs.unlinkSync(cleanupTemp) } catch {} }

    return NextResponse.json({
      success: true,
      message: `بکاپ «${uploadedName}» با موفقیت بازیابی شد — ${toFa(recordCount)} رکورد`,
      count: recordCount,
    })
  } catch (error) {
    if (cleanupTemp) { try { fs.unlinkSync(cleanupTemp) } catch {} }
    // اگر جایگزینی شکست خورد، اتصال به دیتابیس فعلی برگردد
    try { await reconnectDb() } catch {}
    console.error('Error restoring backup:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در بازیابی بکاپ — داده‌های فعلی دست‌نخورده باقی ماند' },
      { status: 500 }
    )
  }
}
