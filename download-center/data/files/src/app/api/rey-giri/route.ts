import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcKaratStatus } from '@/lib/karat'

// GET all records
// ?trash=1 → فقط رکوردهای سطل بازیافت | پیش‌فرض → فقط رکوردهای فعال
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const workType = searchParams.get('workType') || ''
    const karatStatus = searchParams.get('karatStatus') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const trash = searchParams.get('trash') === '1'

    const where: any = { deletedAt: trash ? { not: null } : null }

    if (search) {
      where.OR = [
        { packetNumber: { contains: search } },
        { modelCode: { contains: search } },
        { modelFull: { contains: search } },
        { date: { contains: search } },
        { meltNumber: { contains: search } },
      ]
    }

    if (workType) {
      where.workType = workType
    }

    if (karatStatus) {
      where.karatStatus = { contains: karatStatus }
    }

    const orderBy: any = {}
    if (sortBy === 'rowNumber') {
      orderBy.rowNumber = sortOrder
    } else if (sortBy === 'date') {
      orderBy.date = sortOrder
    } else if (sortBy === 'packetNumber') {
      orderBy.packetNumber = sortOrder
    } else if (sortBy === 'numericWeight') {
      orderBy.numericWeight = sortOrder
    } else if (sortBy === 'numericKarat') {
      orderBy.numericKarat = sortOrder
    } else {
      orderBy.createdAt = sortOrder
    }

    const [records, total] = await Promise.all([
      db.reyGiri.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.reyGiri.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching ReyGiri records:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در دریافت داده‌ها' },
      { status: 500 }
    )
  }
}

// POST new record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // شماره ردیف بعدی بر اساس بزرگ‌ترین ردیف موجود (شامل سطل بازیافت تا تداخل پیش نیاید)
    const lastRecord = await db.reyGiri.findFirst({
      orderBy: { rowNumber: 'desc' },
    })
    const nextRowNumber = lastRecord ? lastRecord.rowNumber + 1 : 1

    // وضعیت عیار به‌صورت خودکار و با برچسب استاندارد
    const karatStatus = body.karatStatus || calcKaratStatus(body.numericKarat)

    const record = await db.reyGiri.create({
      data: {
        rowNumber: body.rowNumber || nextRowNumber,
        packetNumber: body.packetNumber,
        date: body.date,
        workType: body.workType,
        modelCode: body.modelCode,
        modelFull: body.modelFull || body.modelCode,
        reyWeight: String(body.numericWeight || body.reyWeight),
        numericWeight: parseFloat(body.numericWeight) || 0,
        meltNumber: body.meltNumber || null,
        description: body.description || null,
        karatReceived: parseFloat(body.karatReceived) || null,
        numericKarat: parseFloat(body.numericKarat) || null,
        karatStatus,
      },
    })

    return NextResponse.json({
      success: true,
      data: record,
      message: 'رکورد با موفقیت ثبت شد',
    })
  } catch (error) {
    console.error('Error creating ReyGiri record:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در ثبت رکورد' },
      { status: 500 }
    )
  }
}
