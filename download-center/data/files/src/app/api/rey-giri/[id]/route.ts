import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calcKaratStatus } from '@/lib/karat'

// GET single record
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const record = await db.reyGiri.findUnique({
      where: { id },
    })

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'رکورد یافت نشد' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: record })
  } catch (error) {
    console.error('Error fetching ReyGiri record:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در دریافت رکورد' },
      { status: 500 }
    )
  }
}

// PUT update record
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // وضعیت عیار با برچسب استاندارد (فقط وقتی خودکار محاسبه شود)
    let karatStatus = body.karatStatus
    if (body.numericKarat !== undefined && !karatStatus) {
      karatStatus = calcKaratStatus(parseFloat(body.numericKarat)) || undefined
    }

    const record = await db.reyGiri.update({
      where: { id },
      data: {
        ...(body.packetNumber !== undefined && { packetNumber: body.packetNumber }),
        ...(body.date !== undefined && { date: body.date }),
        ...(body.workType !== undefined && { workType: body.workType }),
        ...(body.modelCode !== undefined && { modelCode: body.modelCode }),
        ...(body.modelFull !== undefined && { modelFull: body.modelFull }),
        ...(body.reyWeight !== undefined && { reyWeight: body.reyWeight }),
        ...(body.numericWeight !== undefined && { numericWeight: parseFloat(body.numericWeight) || 0 }),
        ...(body.meltNumber !== undefined && { meltNumber: body.meltNumber || null }),
        ...(body.description !== undefined && { description: body.description || null }),
        ...(body.karatReceived !== undefined && { karatReceived: parseFloat(body.karatReceived) || null }),
        ...(body.numericKarat !== undefined && { numericKarat: parseFloat(body.numericKarat) || null }),
        ...(karatStatus !== undefined && { karatStatus }),
      },
    })

    return NextResponse.json({
      success: true,
      data: record,
      message: 'رکورد با موفقیت بروزرسانی شد',
    })
  } catch (error) {
    console.error('Error updating ReyGiri record:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در بروزرسانی رکورد' },
      { status: 500 }
    )
  }
}

// DELETE record — حذف نرم: رکورد به سطل بازیافت می‌رود و با «بازیابی» برمی‌گردد
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.reyGiri.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      message: 'رکورد به سطل بازیافت منتقل شد',
    })
  } catch (error) {
    console.error('Error deleting ReyGiri record:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در حذف رکورد' },
      { status: 500 }
    )
  }
}
