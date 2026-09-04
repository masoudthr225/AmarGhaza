import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

// خروجی اکسل — فقط رکوردهای فعال (سطل بازیافت شامل نمی‌شود)
export async function GET(request: NextRequest) {
  try {
    const records = await db.reyGiri.findMany({
      where: { deletedAt: null },
      orderBy: { rowNumber: 'asc' },
    })

    if (!records || records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'داده‌ای برای خروجی وجود ندارد' },
        { status: 404 }
      )
    }

    // Transform records for Excel export
    const excelData = records.map((r, index) => ({
      'ردیف': r.rowNumber || index + 1,
      'شماره پاکت': r.packetNumber || '',
      'تاریخ': r.date || '',
      'نوع کار': r.workType || '',
      'کد مدل': r.modelCode || '',
      'مدل کامل': r.modelFull || '',
      'وزن ری': r.reyWeight || '',
      'مقدار عددی وزن': r.numericWeight || 0,
      'شماره ذوب': r.meltNumber || '',
      'توضیحات': r.description || '',
      'عیار دریافتی': r.karatReceived || '',
      'مقدار عددی عیار': r.numericKarat || '',
      'وضعیت عیار': r.karatStatus || '',
    }))

    // Create workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(excelData)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 6 },   // ردیف
      { wch: 12 }, // شماره پاکت
      { wch: 12 }, // تاریخ
      { wch: 10 }, // نوع کار
      { wch: 8 },  // کد مدل
      { wch: 8 },  // مدل کامل
      { wch: 8 },  // وزن ری
      { wch: 14 }, // مقدار عددی وزن
      { wch: 10 }, // شماره ذوب
      { wch: 15 }, // توضیحات
      { wch: 12 }, // عیار دریافتی
      { wch: 14 }, // مقدار عددی عیار
      { wch: 16 }, // وضعیت عیار
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ری‌گیری طلا')

    // Generate buffer
    const buffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      cellStyles: true
    })

    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0]
    const filename = `rey-giri-export-${today}.xlsx`

    // Return as Excel file download
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در ایجاد فایل اکسل' },
      { status: 500 }
    )
  }
}
