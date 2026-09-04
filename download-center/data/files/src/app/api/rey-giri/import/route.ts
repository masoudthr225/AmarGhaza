import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// تبدیل ارقام انگلیسی به فارسی برای پیام‌ها
function toFa(n: number): string {
  const fa = '۰۱۲۳۴۵۶۷۸۹'
  return String(n).replace(/\d/g, (d) => fa[Number(d)])
}

// وارد کردن داده‌های اولیه — بدون پاک شدن داده‌های فعلی
// رکوردهای تکراری (بر اساس شماره پاکت) رد می‌شوند؛ هیچ داده‌ای حذف نمی‌شود
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true' // برای سازگاری با نسخه‌های قبل — دیگر چیزی را پاک نمی‌کند

    // Data extracted from the Excel file
    const excelData = [
      { rowNumber: 1, packetNumber: "51904", date: "1405/02/21", workType: "النگو", modelCode: "970", modelFull: "970", reyWeight: "0.24", numericWeight: 0.24, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 2, packetNumber: "51905", date: "1405/02/19", workType: "ریخته ای", modelCode: "155", modelFull: "155", reyWeight: "0.12", numericWeight: 0.12, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 3, packetNumber: "51601", date: "1405/02/21", workType: "ریخته ای", modelCode: "155", modelFull: "155", reyWeight: "0.24", numericWeight: 0.24, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 4, packetNumber: "51602", date: "1405/02/24", workType: "ریخته ای", modelCode: "155", modelFull: "155", reyWeight: "0.24", numericWeight: 0.24, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 5, packetNumber: "51603", date: "1405/02/26", workType: "ریخته ای", modelCode: "155", modelFull: "155", reyWeight: "0.30", numericWeight: 0.30, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 6, packetNumber: "51604", date: "1405/02/28", workType: "ریخته ای", modelCode: "107", modelFull: "107", reyWeight: "0.21", numericWeight: 0.21, karatReceived: 751.0, numericKarat: 751.0, karatStatus: "بالا (>750)" },
      { rowNumber: 7, packetNumber: "51605", date: "1405/02/29", workType: "ریخته ای", modelCode: "125", modelFull: "125", reyWeight: "0.20", numericWeight: 0.20, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 8, packetNumber: "51606", date: "1405/04/30", workType: "ریخته ای", modelCode: "107", modelFull: "107", reyWeight: "0.30", numericWeight: 0.30, karatReceived: 751.0, numericKarat: 751.0, karatStatus: "بالا (>750)" },
      { rowNumber: 9, packetNumber: "51607", date: "1405/02/30", workType: "ریخته ای", modelCode: "125", modelFull: "125", reyWeight: "0.30", numericWeight: 0.30, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 10, packetNumber: "51608", date: "1405/03/03", workType: "ریخته ای", modelCode: "150", modelFull: "150", reyWeight: "0.24", numericWeight: 0.24, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 11, packetNumber: "51609", date: "1405/03/04", workType: "ریخته ای", modelCode: "115", modelFull: "115", reyWeight: "0.02", numericWeight: 0.02, karatReceived: 750.5, numericKarat: 750.5, karatStatus: "بالا (>750)" },
      { rowNumber: 12, packetNumber: "51610", date: "1405/03/10", workType: "ریخته ای", modelCode: "125", modelFull: "125", reyWeight: "0.24", numericWeight: 0.24, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 13, packetNumber: "51611", date: "1405/03/10", workType: "ریخته ای", modelCode: "155", modelFull: "155", reyWeight: "0.29", numericWeight: 0.29, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 14, packetNumber: "51612", date: "1405/03/10", workType: "ریخته ای", modelCode: "170", modelFull: "170", reyWeight: "0.14", numericWeight: 0.14, karatReceived: 751.0, numericKarat: 751.0, karatStatus: "بالا (>750)" },
      { rowNumber: 15, packetNumber: "51613", date: "1405/03/12", workType: "ریخته ای", modelCode: "170", modelFull: "170", reyWeight: "0.19", numericWeight: 0.19, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 16, packetNumber: "51614", date: "1405/03/17", workType: "النگو", modelCode: "520", modelFull: "520", reyWeight: "0.35", numericWeight: 0.35, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 17, packetNumber: "51615", date: "1405/03/17", workType: "النگو", modelCode: "625", modelFull: "625", reyWeight: "0.24", numericWeight: 0.24, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 18, packetNumber: "51616", date: "1405/03/18", workType: "ریخته ای", modelCode: "175", modelFull: "175", reyWeight: "0.23", numericWeight: 0.23, karatReceived: 749.5, numericKarat: 749.5, karatStatus: "پایین (<750)" },
      { rowNumber: 19, packetNumber: "51617", date: "1405/03/23", workType: "ریخته ای", modelCode: "175", modelFull: "175", reyWeight: "0.23", numericWeight: 0.23, karatReceived: 749.0, numericKarat: 749.0, karatStatus: "پایین (<750)" },
      { rowNumber: 20, packetNumber: "51618", date: "1405/03/25", workType: "ریخته ای", modelCode: "170", modelFull: "170", reyWeight: "0.21", numericWeight: 0.21, karatReceived: 751.0, numericKarat: 751.0, karatStatus: "بالا (>750)" },
      { rowNumber: 21, packetNumber: "51619", date: "1405/03/25", workType: "ریخته ای", modelCode: "150", modelFull: "150", reyWeight: "0.22", numericWeight: 0.22, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 22, packetNumber: "51620", date: "1405/03/27", workType: "ریخته ای", modelCode: "115", modelFull: "115", reyWeight: "0.25", numericWeight: 0.25, karatReceived: 749.5, numericKarat: 749.5, karatStatus: "پایین (<750)" },
      { rowNumber: 23, packetNumber: "51621", date: "1405/03/29", workType: "ریخته ای", modelCode: "120", modelFull: "120", reyWeight: "0.26", numericWeight: 0.26, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 24, packetNumber: "51622", date: "1405/03/30", workType: "ریخته ای", modelCode: "135", modelFull: "135", reyWeight: "0.18", numericWeight: 0.18, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 25, packetNumber: "51623", date: "1405/04/01", workType: "ریخته ای", modelCode: "145", modelFull: "145", reyWeight: "0.20", numericWeight: 0.20, karatReceived: 751.0, numericKarat: 751.0, karatStatus: "بالا (>750)" },
      { rowNumber: 26, packetNumber: "51624", date: "1405/04/03", workType: "النگو", modelCode: "980", modelFull: "980", reyWeight: "0.28", numericWeight: 0.28, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 27, packetNumber: "51625", date: "1405/04/05", workType: "ریخته ای", modelCode: "160", modelFull: "160", reyWeight: "0.15", numericWeight: 0.15, karatReceived: 749.0, numericKarat: 749.0, karatStatus: "پایین (<750)" },
      { rowNumber: 28, packetNumber: "51626", date: "1405/04/08", workType: "ریخته ای", modelCode: "130", modelFull: "130", reyWeight: "0.22", numericWeight: 0.22, karatReceived: 750.5, numericKarat: 750.5, karatStatus: "بالا (>750)" },
      { rowNumber: 29, packetNumber: "51627", date: "1405/04/10", workType: "النگو", modelCode: "750", modelFull: "750", reyWeight: "0.32", numericWeight: 0.32, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
      { rowNumber: 30, packetNumber: "51628", date: "1405/04/12", workType: "ریخته ای", modelCode: "140", modelFull: "140", reyWeight: "0.19", numericWeight: 0.19, karatReceived: 751.0, numericKarat: 751.0, karatStatus: "بالا (>750)" },
      { rowNumber: 31, packetNumber: "51629", date: "1405/04/15", workType: "ریخته ای", modelCode: "165", modelFull: "165", reyWeight: "0.24", numericWeight: 0.24, karatReceived: 749.5, numericKarat: 749.5, karatStatus: "پایین (<750)" },
      { rowNumber: 32, packetNumber: "51630", date: "1405/04/18", workType: "النگو", modelCode: "890", modelFull: "890", reyWeight: "0.30", numericWeight: 0.30, karatReceived: 750.0, numericKarat: 750.0, karatStatus: "استاندارد (750)" },
    ]

    // ⛔ هیچ داده‌ای پاک نمی‌شود — فقط رکوردهای جدید وارد می‌شوند
    const existingPackets = new Set(
      (await db.reyGiri.findMany({ select: { packetNumber: true } }))
        .map((r) => r.packetNumber.trim())
    )

    const lastRecord = await db.reyGiri.findFirst({
      orderBy: { rowNumber: 'desc' },
    })
    let nextRowNumber = lastRecord ? lastRecord.rowNumber + 1 : 1

    const toInsert = excelData
      .filter((item) => !existingPackets.has(item.packetNumber.trim()))
      .map((item) => ({
        rowNumber: nextRowNumber++,
        packetNumber: item.packetNumber,
        date: item.date,
        workType: item.workType,
        modelCode: item.modelCode,
        modelFull: item.modelFull,
        reyWeight: item.reyWeight,
        numericWeight: item.numericWeight,
        meltNumber: null,
        description: null,
        karatReceived: item.karatReceived,
        numericKarat: item.numericKarat,
        karatStatus: item.karatStatus,
      }))

    const duplicates = excelData.length - toInsert.length

    if (toInsert.length > 0) {
      await db.reyGiri.createMany({ data: toInsert })
    }

    let message: string
    if (toInsert.length > 0 && duplicates > 0) {
      message = `${toFa(toInsert.length)} رکورد با موفقیت از فایل وارد شد — ${toFa(duplicates)} رکورد تکراری رد شد`
    } else if (toInsert.length > 0) {
      message = `${toFa(toInsert.length)} رکورد با موفقیت وارد شد`
    } else {
      message = `همهٔ رکوردهای این فایل قبلاً ثبت شده‌اند (${toFa(duplicates)} رکورد تکراری رد شد)`
    }

    return NextResponse.json({
      success: true,
      message,
      count: toInsert.length,
      duplicates,
    })
  } catch (error) {
    console.error('Error importing ReyGiri data:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در وارد کردن داده‌ها' },
      { status: 500 }
    )
  }
}
