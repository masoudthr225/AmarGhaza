import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// آمار — فقط رکوردهای فعال + تعداد سطل بازیافت
export async function GET() {
  try {
    const active = { deletedAt: null } as const

    const [
      totalRecords,
      totalWeight,
      avgKarat,
      standardCount,
      highCount,
      lowCount,
      elangoCount,
      rikhtehiCount,
      byWorkType,
      trashCount,
    ] = await Promise.all([
      db.reyGiri.count({ where: active }),
      db.reyGiri.aggregate({ where: active, _sum: { numericWeight: true } }),
      db.reyGiri.aggregate({ where: active, _avg: { numericKarat: true } }),
      db.reyGiri.count({ where: { ...active, karatStatus: { contains: 'استاندارد' } } }),
      db.reyGiri.count({ where: { ...active, karatStatus: { contains: 'بالا' } } }),
      db.reyGiri.count({ where: { ...active, karatStatus: { contains: 'پایین' } } }),
      db.reyGiri.count({ where: { ...active, workType: 'النگو' } }),
      db.reyGiri.count({ where: { ...active, workType: 'ریخته ای' } }),
      db.reyGiri.groupBy({
        by: ['workType'],
        where: active,
        _sum: { numericWeight: true },
        _count: true,
      }),
      db.reyGiri.count({ where: { deletedAt: { not: null } } }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        totalRecords,
        totalWeight: totalWeight._sum.numericWeight || 0,
        avgKarat: Math.round((avgKarat._avg.numericKarat || 0) * 100) / 100,
        distribution: {
          standard: standardCount,
          high: highCount,
          low: lowCount,
        },
        byWorkType: {
          elango: elangoCount,
          rikhtehi: rikhtehiCount,
        },
        workTypeStats: byWorkType,
        trashCount,
      },
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { success: false, error: 'خطا در دریافت آمار' },
      { status: 500 }
    )
  }
}
