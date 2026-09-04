import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST — بازیابی رکورد از سطل بازیافت (حذف نرم را برگردان)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const record = await db.reyGiri.findUnique({ where: { id } })
    if (!record) {
      return NextResponse.json(
        { success: false, error: 'رکورد یافت نشد' },
        { status: 404 }
      )
    }
    if (!record.deletedAt) {
      return NextResponse.json(
        { success: false, error: 'این رکورد در سطل بازیافت نیست' },
        { status: 400 }
      )
    }

    await db.reyGiri.update({
      where: { id },
      data: { deletedAt: null },
    })

    return NextResponse.json({
      success: true,
      message: 'رکورد با موفقیت بازیابی شد',
    })
  } catch (error) {
    console.error('Error restoring ReyGiri record:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در بازیابی رکورد' },
      { status: 500 }
    )
  }
}
