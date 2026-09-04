import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')

/** GET — فهرست همهٔ نسخه‌های پشتیبان موجود (دستی و خودکار) */
export async function GET() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return NextResponse.json({ success: true, data: [] })
    }

    const backups = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db') && !f.startsWith('.'))
      .map((f) => {
        const st = fs.statSync(path.join(BACKUP_DIR, f))
        return {
          name: f,
          size: st.size,
          createdAt: st.mtime.toISOString(),
          manual: f.startsWith('gold-manual-'),
        }
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

    return NextResponse.json({ success: true, data: backups })
  } catch (error) {
    console.error('Error listing backups:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در دریافت فهرست بکاپ‌ها' },
      { status: 500 }
    )
  }
}
