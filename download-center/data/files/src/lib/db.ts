import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import path from 'node:path'
import fs from 'node:fs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  // مسیر مطلق دیتابیس نسبت به ریشهٔ پروژه — مستقل از پوشهٔ اجرای فرمان
  const dbPath = path.join(process.cwd(), 'db', 'custom.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const adapter = new PrismaLibSQL({ url: 'file:' + dbPath })
  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
