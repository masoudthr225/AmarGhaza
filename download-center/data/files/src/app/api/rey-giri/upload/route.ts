import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { calcKaratStatus } from '@/lib/karat'

// تبدیل ارقام انگلیسی به فارسی برای پیام‌ها
function toFa(n: number): string {
  const fa = '۰۱۲۳۴۵۶۷۸۹'
  return String(n).replace(/\d/g, (d) => fa[Number(d)])
}

// آپلود فایل اکسل — بدون پاک شدن داده‌های قبلی
// رکوردهای تکراری (بر اساس شماره پاکت) رد می‌شوند و فقط رکوردهای جدید وارد می‌شوند
export async function POST(request: NextRequest) {
  console.log('[UPLOAD] Upload request received')

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.log('[UPLOAD] No file provided')
      return NextResponse.json(
        { success: false, error: 'فایلی انتخاب نشده است' },
        { status: 400 }
      )
    }

    console.log('[UPLOAD] File received:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    // Get file extension
    const fileName = file.name.toLowerCase()
    const ext = fileName.endsWith('.xlsx') ? '.xlsx' :
                fileName.endsWith('.xls') ? '.xls' :
                fileName.endsWith('.csv') ? '.csv' : ''

    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      console.log('[UPLOAD] Invalid file extension:', ext)
      return NextResponse.json(
        { success: false, error: 'فرمت فایل پشتیبانی نمی‌شود. لطفاً فایل .xlsx یا .csv انتخاب کنید' },
        { status: 400 }
      )
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    console.log('[UPLOAD] Buffer size:', buffer.length)

    // Parse Excel/CSV file using xlsx library
    let records: any[] = []

    try {
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false
      })

      // Get first sheet
      const sheetName = workbook.SheetNames[0]
      console.log('[UPLOAD] Sheet name:', sheetName)

      const worksheet = workbook.Sheets[sheetName]

      // Convert to JSON
      records = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
        raw: false
      })

      console.log('[UPLOAD] Records parsed:', records.length)

    } catch (parseError) {
      console.error('[UPLOAD] Error parsing file:', parseError)
      return NextResponse.json(
        { success: false, error: 'خطا در خواندن فایل. مطمئن شوید فایل سالم است.' },
        { status: 400 }
      )
    }

    if (!Array.isArray(records) || records.length === 0) {
      console.log('[UPLOAD] No records found in file')
      return NextResponse.json(
        { success: false, error: 'داده‌ای در فایل یافت نشد' },
        { status: 400 }
      )
    }

    console.log('[UPLOAD] First record sample:', records[0])

    // Validate and transform records
    const validRecords = transformRecords(records)
    console.log('[UPLOAD] Valid records after transform:', validRecords.length)

    if (validRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'رکورد معتبری در فایل یافت نشد. مطمئن شوید ستون‌ها شامل: شماره پاکت، تاریخ، نوع کار، کد مدل و...' },
        { status: 400 }
      )
    }

    // ⛔ هیچ داده‌ای پاک نمی‌شود — فقط رکوردهای جدید وارد می‌شوند
    const existingPackets = new Set(
      (await db.reyGiri.findMany({ select: { packetNumber: true } }))
        .map((r) => r.packetNumber.trim())
    )

    // شماره ردیف بعدی (بزرگ‌ترین ردیف موجود + ۱ — شامل سطل بازیافت تا تداخل نشود)
    const lastRecord = await db.reyGiri.findFirst({
      orderBy: { rowNumber: 'desc' },
    })
    let nextRowNumber = lastRecord ? lastRecord.rowNumber + 1 : 1

    const seenInFile = new Set<string>()
    const toInsert: any[] = []
    let duplicates = 0

    for (const rec of validRecords) {
      const key = rec.packetNumber.trim()
      // رکورد تکراری = قبلاً در دیتابیس بوده یا در همین فایل دوبار آمده
      if (existingPackets.has(key) || seenInFile.has(key)) {
        duplicates++
        continue
      }
      seenInFile.add(key)
      toInsert.push({ ...rec, rowNumber: nextRowNumber++ })
    }

    if (toInsert.length > 0) {
      await db.reyGiri.createMany({ data: toInsert })
    }

    console.log('[UPLOAD] Inserted:', toInsert.length, '| Duplicates skipped:', duplicates)

    let message: string
    if (toInsert.length > 0 && duplicates > 0) {
      message = `${toFa(toInsert.length)} رکورد با موفقیت از فایل وارد شد — ${toFa(duplicates)} رکورد تکراری رد شد`
    } else if (toInsert.length > 0) {
      message = `${toFa(toInsert.length)} رکورد با موفقیت از فایل وارد شد`
    } else {
      message = `همهٔ رکوردهای این فایل قبلاً ثبت شده‌اند (${toFa(duplicates)} رکورد تکراری رد شد)`
    }

    return NextResponse.json({
      success: true,
      message,
      count: toInsert.length,
      duplicates,
      fileName: file.name,
    })
  } catch (error) {
    console.error('[UPLOAD] Error uploading file:', error)

    return NextResponse.json(
      { success: false, error: `خطا در پردازش فایل: ${error instanceof Error ? error.message : 'خطای ناشناخته'}` },
      { status: 500 }
    )
  }
}

function transformRecords(records: any[]): any[] {
  return records
    .map((row: any, index: number) => {
      // Try different possible column names for weight
      let numericWeight = 0
      const weightValue = row['مقدار عددی وزن'] || row['وزن ری'] || row['numericWeight'] || row['reyWeight'] || 0
      numericWeight = parseFloat(String(weightValue).replace(/,/g, ''))

      // Try different possible column names for karat
      let numericKarat: number | null = null
      const karatValue = row['مقدار عددی عیار'] || row['عیار دریافتی'] || row['karatReceived'] || row['numericKarat']
      if (karatValue !== null && karatValue !== undefined && karatValue !== '') {
        numericKarat = parseFloat(String(karatValue).replace(/,/g, ''))
        if (isNaN(numericKarat)) numericKarat = null
      }

      // وضعیت عیار با برچسب استاندارد (استاندارد (750) / بالا (>750) / پایین (<750))
      const karatStatus = calcKaratStatus(numericKarat)

      // Get packet number - try various column names
      const packetNumber = String(row['شماره پاکت'] || row['packetNumber'] || '').trim()

      // Get date - try various column names
      const date = String(row['تاریخ'] || row['date'] || '').trim()

      // Get work type
      const workType = String(row['نوع کار'] || row['workType'] || '').trim()

      // Get model code
      const modelCode = String(row['کد مدل'] || row['modelCode'] || '').trim()

      // Get model full
      const modelFull = String(row['مدل کامل'] || row['modelFull'] || '').trim()

      // Get melt number
      let meltNumber: string | null = null
      const meltVal = row['شماره ذوب'] || row['meltNumber']
      if (meltVal !== null && meltVal !== undefined && meltVal !== '') {
        meltNumber = String(meltVal).trim()
      }

      // Get description
      let description: string | null = null
      const descVal = row['توضیحات'] || row['description']
      if (descVal !== null && descVal !== undefined && descVal !== '') {
        description = String(descVal).trim()
      }

      return {
        rowNumber: parseInt(String(row['ردیف'] || row['rowNumber'] || index + 1)),
        packetNumber,
        date,
        workType,
        modelCode,
        modelFull,
        reyWeight: String(row['وزن ری'] || numericWeight),
        numericWeight: isNaN(numericWeight) ? 0 : numericWeight,
        meltNumber,
        description,
        karatReceived: numericKarat,
        numericKarat,
        karatStatus,
      }
    })
    .filter((r: any) => r.packetNumber && r.date)
}
