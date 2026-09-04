// برچسب‌های استاندارد وضعیت عیار — تنها منبع حقیقت (single source of truth)
// استفاده در همهٔ مسیرهای API تا برچسب‌ها همیشه یکسان باشند

export const KARAT_LABELS = {
  standard: 'استاندارد (750)',
  high: 'بالا (>750)',
  low: 'پایین (<750)',
} as const

/**
 * محاسبهٔ وضعیت عیار از مقدار عددی
 * 750 → «استاندارد (750)» | بالاتر از 750 → «بالا (>750)» | پایین‌تر از 750 → «پایین (<750)»
 * اگر عیار نامعتبر باشد null برمی‌گردد.
 */
export function calcKaratStatus(numericKarat: number | null | undefined): string | null {
  if (numericKarat === null || numericKarat === undefined || isNaN(numericKarat as number) || (numericKarat as number) <= 0) {
    return null
  }
  if ((numericKarat as number) > 750) return KARAT_LABELS.high
  if ((numericKarat as number) < 750) return KARAT_LABELS.low
  return KARAT_LABELS.standard
}
