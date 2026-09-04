'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as jalaali from 'jalaali-js'

// Persian month names
const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
]

// Persian weekday names (short)
const PERSIAN_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

interface JalaliDatePickerProps {
  value?: string  // Format: YYYY/MM/DD
  onChange: (date: string) => void
  placeholder?: string
}

export function JalaliDatePicker({ value, onChange, placeholder = 'انتخاب تاریخ شمسی' }: JalaliDatePickerProps) {
  // Parse current date or use today
  const today = useMemo(() => {
    const now = new Date()
    return jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  }, [])

  const [selectedYear, setSelectedYear] = useState(() => {
    if (value) {
      const [y] = value.split('/').map(Number)
      return y || today.jy
    }
    return today.jy
  })

  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (value) {
      const [, m] = value.split('/').map(Number)
      return (m || today.jm) - 1
    }
    return today.jm - 1
  })

  const [selectedDay, setSelectedDay] = useState(() => {
    if (value) {
      const [, , d] = value.split('/').map(Number)
      return d || today.jd
    }
    return today.jd
  })

  // Generate year options (10 years before and after current)
  const yearOptions = useMemo(() => {
    const years = []
    const currentYear = today.jy
    for (let y = currentYear - 5; y <= currentYear + 5; y++) {
      years.push(y)
    }
    return years
  }, [today.jy])

  // Get number of days in selected month
  const daysInMonth = useMemo(() => {
    return jalaali.jalaaliMonthLength(selectedYear, selectedMonth + 1)
  }, [selectedYear, selectedMonth])

  // Get the day of week for the first day of the month
  const firstDayOfWeek = useMemo(() => {
    const gDate = jalaali.toGregorian(selectedYear, selectedMonth + 1, 1)
    const date = new Date(gDate.gy, gDate.gm - 1, gDate.gd)
    // Convert to Persian weekday (0 = Saturday)
    return (date.getDay() + 1) % 7
  }, [selectedYear, selectedMonth])

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = []
    
    // Add empty cells for days before first day of month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d)
    }
    
    return days
  }, [firstDayOfWeek, daysInMonth])

  // Handle date selection
  const handleDayClick = (day: number) => {
    setSelectedDay(day)
    const dateStr = `${selectedYear}/${String(selectedMonth + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}`
    onChange(dateStr)
  }

  // Navigate to previous/next month
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedYear(selectedYear - 1)
      setSelectedMonth(11)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedYear(selectedYear + 1)
      setSelectedMonth(0)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }

  // Check if a date is selected
  const isDateSelected = value && 
    parseInt(value.split('/')[0]) === selectedYear && 
    parseInt(value.split('/')[1]) === selectedMonth + 1 && 
    parseInt(value.split('/')[2]) === selectedDay

  // Check if it's today
  const isToday = (day: number) => {
    return day === today.jd && 
           selectedMonth === today.jm - 1 && 
           selectedYear === today.jy
  }

  return (
    <div className="w-full space-y-3 p-3 bg-white rounded-lg border" dir="rtl">
      {/* Year and Month Selectors */}
      <div className="flex gap-2 items-center">
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[100px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(year => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
          <SelectTrigger className="flex-1 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERSIAN_MONTHS.map((month, idx) => (
              <SelectItem key={idx} value={String(idx)}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {PERSIAN_MONTHS[selectedMonth]} {selectedYear}
        </span>
        <Button variant="ghost" size="sm" onClick={handleNextMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1">
        {PERSIAN_WEEKDAYS.map((day, idx) => (
          <div key={idx} className="text-center text-xs font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => (
          <Button
            key={idx}
            variant={day && isDateSelected && day === selectedDay ? "default" : "ghost"}
            size="sm"
            className={`h-8 w-8 p-0 text-sm ${
              !day ? 'invisible' : ''
            } ${
              day && isToday(day) ? 'border-2 border-blue-500' : ''
            }`}
            disabled={!day}
            onClick={() => day && handleDayClick(day)}
          >
            {day || ''}
          </Button>
        ))}
      </div>

      {/* Selected Date Display */}
      {value && (
        <div className="text-center text-sm text-gray-600 pt-2 border-t">
          تاریخ انتخاب شده: {value}
        </div>
      )}
    </div>
  )
}
