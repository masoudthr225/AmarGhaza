import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { db, getDbPath } from '@/lib/db'

const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')

function ensureBackupDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

/** GET — دانلود فایل بکاپ دیتابیس (کل وضعیت فعلی برنامه) */
export async function GET() {
  try {
    const dbPath = getDbPath()
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { success: false, error: 'فایل دیتابیس پیدا نشد' },
        { status: 404 }
      )
    }
    const buffer = fs.readFileSync(dbPath)
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const filename = `gold-backup-${stamp}.db`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Error downloading backup:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در تهیهٔ فایل بکاپ' },
      { status: 500 }
    )
  }
}

/** POST — گرفتن نسخهٔ پشتیبان داخل برنامه (ذخیره در db/backups) */
export async function POST() {
  try {
    ensureBackupDir()
    const dbPath = getDbPath()
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { success: false, error: 'فایل دیتابیس پیدا نشد' },
        { status: 404 }
      )
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    // نام «gold-manual-» دارد تا نگهبان، بکاپ‌های دستی را خودکار پاک نکند
    const name = `gold-manual-${stamp}.db`
    fs.copyFileSync(dbPath, path.join(BACKUP_DIR, name))

    const count = await db.reyGiri.count({ where: { deletedAt: null } })

    return NextResponse.json({
      success: true,
      message: `نسخهٔ پشتیبان با موفقیت ساخته شد (${count.toLocaleString('fa-IR')} رکورد)`,
      name,
      count,
      size: fs.statSync(path.join(BACKUP_DIR, name)).size,
    })
  } catch (error) {
    console.error('Error creating backup:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در ساخت نسخهٔ پشتیبان' },
      { status: 500 }
    )
  }
}
