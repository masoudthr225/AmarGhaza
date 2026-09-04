// کلاینت Prisma از داخل خود پروژه (src/generated/prisma) — بدون نیاز به prisma generate اینترنتی
import { PrismaClient } from '@/generated/prisma'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import path from 'node:path'
import fs from 'node:fs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/** مسیر مطلق دیتابیس اصلی — نسبت به ریشهٔ پروژه */
export function getDbPath(): string {
  return path.join(process.cwd(), 'db', 'custom.db')
}

/** ساخت کلاینت برای مسیر دلخواه (برای اعتبارسنجی فایل بکاپ) */
export function createClientForPath(dbPath: string): PrismaClient {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const adapter = new PrismaLibSQL({ url: 'file:' + dbPath })
  return new PrismaClient({ adapter })
}

function createDb(): PrismaClient {
  return createClientForPath(getDbPath())
}

if (!globalForPrisma.prisma) globalForPrisma.prisma = createDb()

/**
 * db همیشه به نسخهٔ فعلی کلاینت هدایت می‌شود (Proxy) —
 * بعد از «بازیابی از بکاپ» می‌توان اتصال را بدون ری‌استارت سرور عوض کرد.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = globalForPrisma.prisma as any
    if (!client) return undefined
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

/** قطع اتصال فعلی و ساخت اتصال تازه (بعد از جایگزینی فایل دیتابیس) */
export async function reconnectDb(): Promise<PrismaClient> {
  try { await globalForPrisma.prisma?.$disconnect() } catch {}
  globalForPrisma.prisma = createDb()
  return globalForPrisma.prisma
}
