'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Download,
  RefreshCw,
  BarChart3,
  TableIcon,
  FileText,
  Trash2,
  RotateCcw,
  Edit,
  Upload,
  ArrowUpDown,
  Scale,
  Gem,
  CalendarIcon,
} from 'lucide-react'
import { format, addDays } from 'date-fns'
import { faIR } from 'date-fns/locale'
import * as jalaali from 'jalaali-js'

interface ReyGiriRecord {
  id: string
  rowNumber: number
  packetNumber: string
  date: string
  workType: string
  modelCode: string
  modelFull: string
  reyWeight: string
  numericWeight: number
  meltNumber: string | null
  description: string | null
  karatReceived: number | null
  numericKarat: number | null
  karatStatus: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

interface StatsData {
  totalRecords: number
  totalWeight: number
  avgKarat: number
  distribution: {
    standard: number
    high: number
    low: number
  }
  byWorkType: {
    elango: number
    rikhtehi: number
  }
  workTypeStats: Array<{
    workType: string
    _sum: { numericWeight: number | null }
    _count: number
  }>
  trashCount: number
}

// Convert Gregorian to Jalali (simplified)
function toJalali(gDate: Date): string {
  const gy = gDate.getFullYear()
  const gm = gDate.getMonth() + 1
  const gd = gDate.getDate()
  
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  let gy2 = (gm > 2) ? (gy + 1) : gy
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1]
  
  let jy = -1595 + (33 * Math.floor(days / 12053))
  days %= 12053
  jy += 4 * Math.floor(days / 1461)
  days %= 1461
  
  if (days > 365) {
    jy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  
  const jm = (days < 186) ? (1 + Math.floor(days / 31)) : (7 + Math.floor((days - 186) / 30))
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30))
  
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`
}

// Convert Jalali to Gregorian (simplified)
function jalaliToGregorian(jDate: string): Date {
  const [jy, jm, jd] = jDate.split('/').map(Number)
  
  const jy1 = jy - 979
  const jm1 = jm - 1
  const jd1 = jd - 1
  
  let j_day_no = 365 * jy1 + Math.floor(jy1 / 33) * 8 + Math.floor((jy1 % 33 + 3) / 4) + jd1
  
  if (jm1 < 6) {
    j_day_no += 31 * jm1
  } else {
    j_day_no += (6 * 31) + 30 * (jm1 - 6)
  }
  
  let g_day_no = j_day_no + 79
  
  let gy = 400 * Math.floor(g_day_no / 146097)
  g_day_no %= 146097
  
  if (g_day_no >= 36525) {
    g_day_no--
    gy += 100 * Math.floor(g_day_no / 36524)
    g_day_no %= 36524
    
    if (g_day_no >= 365) {
      g_day_no++
    }
  }
  
  gy += 4 * Math.floor(g_day_no / 1461)
  g_day_no %= 1461
  
  if (g_day_no >= 366) {
    g_day_no--
    gy += Math.floor(g_day_no / 365)
    g_day_no %= 365
  }
  
  let gd = g_day_no + 1
  
  const sal_a = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 0
  
  while (gm < 13 && gd > sal_a[gm]) {
    gd -= sal_a[gm]
    gm++
  }
  
  return new Date(gy, gm - 1, gd)
}

// Storage keys for persistence
const STORAGE_KEYS = {
  FORM_DATA: 'reygiri_form_data',
  FORM_EDIT_ID: 'reygiri_edit_id',
  SEARCH_TERM: 'reygiri_search',
  WORK_TYPE_FILTER: 'reygiri_worktype_filter',
  KARAT_STATUS_FILTER: 'reygiri_karat_filter',
  SORT_BY: 'reygiri_sort_by',
  SORT_ORDER: 'reygiri_sort_order',
}

export default function ReyGiriApp() {
  // Initialize state from localStorage for persistence
  const [records, setRecords] = useState<ReyGiriRecord[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.SEARCH_TERM) || ''
    }
    return ''
  })
  const [workTypeFilter, setWorkTypeFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.WORK_TYPE_FILTER) || ''
    }
    return ''
  })
  const [karatStatusFilter, setKaratStatusFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.KARAT_STATUS_FILTER) || ''
    }
    return ''
  })
  const [sortBy, setSortBy] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.SORT_BY) || 'rowNumber'
    }
    return 'rowNumber'
  })
  const [sortOrder, setSortOrder] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.SORT_ORDER) || 'desc'
    }
    return 'desc'
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecordsCount, setTotalRecordsCount] = useState(0)

  // سطل بازیافت — نمایش رکوردهای حذف‌شده (حذف نرم)
  const [showTrash, setShowTrash] = useState(false)
  
  // Form state - initialize from localStorage for persistence
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.FORM_EDIT_ID)
    }
    return null
  })
  const [formData, setFormData] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEYS.FORM_DATA)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          // Invalid data, return default
        }
      }
    }
    return {
      packetNumber: '',
      date: '',
      workType: '',
      modelCode: '',
      modelFull: '',
      numericWeight: '',
      meltNumber: '',
      description: '',
      numericKarat: '',
    }
  })
  const [submitting, setSubmitting] = useState(false)
  const [duplicateError, setDuplicateError] = useState(false)
  
  // Date picker state
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>()
  
  // Track if form has unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // Refs for Enter key navigation
  const inputRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>([])
  const submitButtonRef = useRef<HTMLButtonElement>(null)

  // Fetch records
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        search: searchTerm,
        workType: workTypeFilter,
        karatStatus: karatStatusFilter,
        sortBy,
        sortOrder,
        page: currentPage.toString(),
        limit: '50',
      })
      if (showTrash) params.set('trash', '1')
      
      const response = await fetch(`/api/rey-giri?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setRecords(result.data)
        setTotalPages(result.pagination.pages)
        setTotalRecordsCount(result.pagination.total)
      }
    } catch (error) {
      toast.error('خطا در دریافت داده‌ها')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, workTypeFilter, karatStatusFilter, sortBy, sortOrder, currentPage, showTrash])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/rey-giri/stats')
      const result = await response.json()
      
      if (result.success) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Persist search and filter settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SEARCH_TERM, searchTerm)
      localStorage.setItem(STORAGE_KEYS.WORK_TYPE_FILTER, workTypeFilter)
      localStorage.setItem(STORAGE_KEYS.KARAT_STATUS_FILTER, karatStatusFilter)
      localStorage.setItem(STORAGE_KEYS.SORT_BY, sortBy)
      localStorage.setItem(STORAGE_KEYS.SORT_ORDER, sortOrder)
    }
  }, [searchTerm, workTypeFilter, karatStatusFilter, sortBy, sortOrder])

  // Persist form data to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && formData) {
      localStorage.setItem(STORAGE_KEYS.FORM_DATA, JSON.stringify(formData))
    }
  }, [formData])

  // Persist editing ID to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (editingId) {
        localStorage.setItem(STORAGE_KEYS.FORM_EDIT_ID, editingId)
      } else {
        localStorage.removeItem(STORAGE_KEYS.FORM_EDIT_ID)
      }
    }
  }, [editingId])

  // Warn user before leaving page with unsaved form data
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && formOpen) {
        e.preventDefault()
        e.returnValue = ''
        return ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges, formOpen])

  // Insert keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Insert' && !formOpen) {
        e.preventDefault()
        resetForm()
        setFormOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [formOpen])

  // Handle sort toggle for columns
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // Check duplicate packet number
  const checkDuplicatePacket = async (packetNumber: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/rey-giri?search=${packetNumber}&limit=1000`)
      const result = await response.json()
      
      if (result.success && result.data.length > 0) {
        const exists = result.data.some(
          (r: ReyGiriRecord) => r.packetNumber === packetNumber && r.id !== editingId
        )
        return exists
      }
      return false
    } catch (error) {
      return false
    }
  }

  // Handle packet number change
  const handlePacketNumberChange = async (value: string) => {
    setFormData({ ...formData, packetNumber: value })
    setHasUnsavedChanges(true)
    
    if (value.trim()) {
      const isDuplicate = await checkDuplicatePacket(value.trim())
      setDuplicateError(isDuplicate)
    } else {
      setDuplicateError(false)
    }
  }

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate unique packet number
    if (!editingId && formData.packetNumber.trim()) {
      const isDuplicate = await checkDuplicatePacket(formData.packetNumber.trim())
      if (isDuplicate) {
        setDuplicateError(true)
        toast.error('شماره پاکت تکراری است!')
        return
      }
    }
    
    setSubmitting(true)

    try {
      const url = editingId 
        ? `/api/rey-giri/${editingId}`
        : '/api/rey-giri'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(editingId ? 'رکورد بروزرسانی شد' : 'رکورد جدید ثبت شد')
        setHasUnsavedChanges(false)
        setFormOpen(false)
        resetForm()
        fetchRecords()
        fetchStats()
      } else {
        toast.error(result.error || 'خطا در عملیات')
      }
    } catch (error) {
      toast.error('خطا در ارتباط با سرور')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle delete — حذف نرم: رکورد به سطل بازیافت می‌رود و قابل بازگردانی است
  const handleDelete = async (id: string) => {
    if (!confirm('این رکورد به سطل بازیافت منتقل شود؟ (قابل بازگردانی است)')) return

    try {
      const response = await fetch(`/api/rey-giri/${id}`, { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        toast.success('رکورد به سطل بازیافت منتقل شد', {
          description: 'برای بازگردانی، روی «سطل بازیافت» کلیک کنید',
        })
        fetchRecords()
        fetchStats()
      } else {
        toast.error(result.error || 'خطا در حذف رکورد')
      }
    } catch (error) {
      toast.error('خطا در ارتباط با سرور')
    }
  }

  // Handle restore — بازیابی رکورد از سطل بازیافت
  const handleRestore = async (id: string) => {
    try {
      const response = await fetch(`/api/rey-giri/${id}/restore`, { method: 'POST' })
      const result = await response.json()

      if (result.success) {
        toast.success('رکورد با موفقیت بازیابی شد')
        fetchRecords()
        fetchStats()
      } else {
        toast.error(result.error || 'خطا در بازیابی رکورد')
      }
    } catch (error) {
      toast.error('خطا در ارتباط با سرور')
    }
  }

  // Toggle trash view — رفت‌وآمد بین لیست اصلی و سطل بازیافت
  const toggleTrash = () => {
    setCurrentPage(1)
    setShowTrash((v) => !v)
  }

  // Handle edit
  const handleEdit = (record: ReyGiriRecord) => {
    setEditingId(record.id)
    setFormData({
      packetNumber: record.packetNumber,
      date: record.date,
      workType: record.workType,
      modelCode: record.modelCode,
      modelFull: record.modelFull,
      numericWeight: String(record.numericWeight),
      meltNumber: record.meltNumber || '',
      description: record.description || '',
      numericKarat: record.numericKarat ? String(record.numericKarat) : '',
    })
    // Set selected date for date picker
    try {
      const gDate = jalaliToGregorian(record.date)
      setSelectedDate(gDate)
    } catch {
      setSelectedDate(undefined)
    }
    setFormOpen(true)
    setDuplicateError(false)
  }

  // Reset form
  const resetForm = () => {
    setEditingId(null)
    setFormData({
      packetNumber: '',
      date: '',
      workType: '',
      modelCode: '',
      modelFull: '',
      numericWeight: '',
      meltNumber: '',
      description: '',
      numericKarat: '',
    })
    setSelectedDate(undefined)
    setDatePickerOpen(false)
    setDuplicateError(false)
    setHasUnsavedChanges(false)
    // Clear persisted form data
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.FORM_DATA)
      localStorage.removeItem(STORAGE_KEYS.FORM_EDIT_ID)
    }
  }

  // Import data
  const handleImport = async (forceImport = false) => {
    try {
      const url = forceImport 
        ? '/api/rey-giri/import?force=true'
        : '/api/rey-giri/import'
      const response = await fetch(url, { method: 'POST' })
      const result = await response.json()

      if (result.success) {
        toast.success(result.message || 'داده‌ها با موفقیت وارد شدند')
        fetchRecords()
        fetchStats()
      } else {
        if (result.canForce) {
          toast.error(result.error, {
            duration: 5000,
            action: {
              label: 'وارد کردن مجدد',
              onClick: () => handleImport(true),
            },
          })
        } else {
          toast.error(result.error || 'خطا در وارد کردن داده‌ها')
        }
      }
    } catch (error) {
      toast.error('خطا در ارتباط با سرور')
    }
  }

  // Export data - creates real Excel file with SAVE DIALOG
  const handleExport = async () => {
    try {
      toast.loading('در حال ایجاد فایل اکسل...')
      
      // Fetch the Excel file
      const response = await fetch('/api/rey-giri/export')
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'خطا در دریافت داده‌ها')
      }
      
      // Get blob from response
      const blob = await response.blob()
      
      if (blob.size === 0) {
        throw new Error('فایل خالی است')
      }
      
      // Generate filename with current date
      const today = new Date().toISOString().split('T')[0]
      const filename = `rey-giri-export-${today}.xlsx`
      
      // Try to use File System Access API for Save Dialog (Windows 11, Chrome, Edge)
      if ('showSaveFilePicker' in window) {
        try {
          // Show native Save As dialog
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'فایل Excel',
              accept: {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              },
            }],
          })
          
          // Write file to selected location
          const writable = await fileHandle.createWritable()
          await writable.write(blob)
          await writable.close()
          
          toast.dismiss()
          toast.success('فایل اکسل با موفقیت ذخیره شد', {
            description: 'در محل انتخاب شده ذخیره گردید',
            duration: 4000,
          })
          return
        } catch (pickerError) {
          // User cancelled or error - try fallback
          if ((pickerError as Error).name === 'AbortError') {
            toast.dismiss()
            return // User cancelled, don't show error
          }
          console.log('Save dialog failed, using fallback:', pickerError)
        }
      }
      
      // Fallback: Use traditional download method
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.style.display = 'none'
      anchor.download = filename
      
      document.body.appendChild(anchor)
      anchor.click()
      
      setTimeout(() => {
        document.body.removeChild(anchor)
        window.URL.revokeObjectURL(url)
      }, 200)
      
      toast.dismiss()
      toast.success('فایل اکسل آماده دانلود شد', {
        description: 'اگر پنجره ذخیره‌سازی باز نشد، مرورگر را تنظیم کنید',
        duration: 5000,
      })
    } catch (error) {
      console.error('Export error:', error)
      toast.dismiss()
      toast.error(error instanceof Error ? error.message : 'خطا در خروجی گرفتن')
    }
  }

  // File upload handler for import - using label approach for better browser compatibility
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file extension
    const fileName = file.name.toLowerCase()
    const validExtensions = ['.xlsx', '.xls', '.csv']
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))
    
    if (!hasValidExtension) {
      toast.error('لطفاً فایل اکسل (.xlsx) یا CSV انتخاب کنید')
      // Reset input
      e.target.value = ''
      return
    }

    try {
      toast.loading('در حال پردازش فایل... لطفاً صبر کنید')
      
      const formData = new FormData()
      formData.append('file', file)
      
      console.log('Uploading file:', file.name, 'Size:', file.size)
      
      const response = await fetch('/api/rey-giri/upload', {
        method: 'POST',
        body: formData,
      })
      
      console.log('Response status:', response.status)
      
      const result = await response.json()
      console.log('Response data:', result)
      
      if (result.success) {
        toast.dismiss()
        toast.success(result.message || `${result.count} رکورد وارد شد`, {
          duration: 5000,
        })
        fetchRecords()
        fetchStats()
      } else {
        toast.dismiss()
        toast.error(result.error || 'خطا در پردازش فایل', {
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.dismiss()
      toast.error('خطا در ارتباط با سرور. مطمئن شوید سرور در حال اجراست.', {
        duration: 5000,
      })
    }
    
    // Reset input so same file can be uploaded again
    e.target.value = ''
  }

  // Get karat color based on value
  const getKaratColor = (karat: number | null) => {
    if (karat === null) return 'text-gray-500'
    if (karat === 750) return 'text-green-600 font-bold bg-green-50 px-2 py-1 rounded'
    if (karat < 750) return 'text-red-600 font-bold bg-red-50 px-2 py-1 rounded'
    return 'text-yellow-600 font-bold bg-yellow-50 px-2 py-1 rounded'
  }

  // Get karat status badge color
  const getKaratBadgeVariant = (status: string | null) => {
    if (!status) return 'secondary'
    if (status.includes('استاندارد')) return 'default'
    if (status.includes('بالا')) return 'default'
    if (status.includes('پایین')) return 'destructive'
    return 'secondary'
  }

  // Handle Enter key as Tab in form
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Find next input element
      const nextIndex = index + 1
      if (inputRefs.current[nextIndex]) {
        inputRefs.current[nextIndex]?.focus()
      }
    }
  }

  // Handle date select from Jalali DatePicker
  const handleDateSelect = (jalaliDate: string) => {
    setFormData({ ...formData, date: jalaliDate })
    setDatePickerOpen(false)
  }

  // Sort icon component
  const SortIcon = ({ column }: { column: string }) => (
    <ArrowUpDown 
      className={`inline-block mr-1 h-4 w-4 ${sortBy === column ? 'text-indigo-600' : 'text-gray-400'}`}
    />
  )

  return (
    <div 
      dir="rtl" 
      className="min-h-screen relative"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        width: '100%',
        height: '100%',
        minHeight: '100vh',
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]" />
      
      {/* Content wrapper - positioned above overlay */}
      <div className="relative z-10">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md shadow-sm border-b border-indigo-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg">
                <Scale className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">سیستم ثبت ری‌گیری طلا</h1>
                <p className="text-sm text-gray-500">مدیریت و پیگیری نمونه‌های ری‌گیری</p>
                <p className="text-xs text-indigo-600 mt-1">کلید میانبر ثبت جدید: Insert</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* File Upload Button - Windows 11 Compatible */}
              <input
                id="file-upload-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <Button 
                variant="outline" 
                size="sm" 
                type="button"
                onClick={() => {
                  const fileInput = document.getElementById('file-upload-input') as HTMLInputElement
                  if (fileInput) {
                    fileInput.click()
                  }
                }}
              >
                <Upload className="ml-2 h-4 w-4" />
                آپلود فایل
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  handleExport()
                }}
              >
                <Download className="ml-2 h-4 w-4" />
                خروجی Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                className={showTrash ? 'bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200' : ''}
                onClick={toggleTrash}
                title={showTrash ? 'بازگشت به لیست اصلی' : 'نمایش رکوردهای حذف‌شده'}
              >
                <Trash2 className="ml-2 h-4 w-4" />
                {showTrash ? 'لیست اصلی' : 'سطل بازیافت'}
                {stats && stats.trashCount > 0 && (
                  <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${showTrash ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}`}>
                    {stats.trashCount.toLocaleString('fa-IR')}
                  </span>
                )}
              </Button>
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                onClick={() => { resetForm(); setFormOpen(true); }}
              >
                <Plus className="ml-2 h-4 w-4" />
                ثبت جدید
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-white border-indigo-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">کل رکوردها</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalRecords}</p>
                  </div>
                  <div className="bg-indigo-100 p-3 rounded-full">
                    <FileText className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-indigo-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">مجموع وزن (گرم)</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalWeight.toFixed(2)}</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-full">
                    <Scale className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-indigo-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">میانگین عیار</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.avgKarat}</p>
                  </div>
                  <div className="bg-violet-100 p-3 rounded-full">
                    <Gem className="h-6 w-6 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>


          </div>
        )}

        {/* Work Type Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card className="bg-white border-indigo-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gem className="h-5 w-5 text-indigo-500" />
                  آمار بر اساس نوع کار
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                    <span className="font-medium">النگو</span>
                    <Badge variant="outline" className="border-indigo-300">
                      {stats.byWorkType.elango} رکورد
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="font-medium">ریخته‌ای</span>
                    <Badge variant="outline" className="border-purple-300">
                      {stats.byWorkType.rikhtehi} رکورد
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-indigo-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-500" />
                  وزن بر اساس نوع کار
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.workTypeStats.map((stat) => (
                    <div key={stat.workType} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{stat.workType}</span>
                        <span className="font-medium">{stat._sum.numericWeight?.toFixed(2) || 0} گرم</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-indigo-400 to-purple-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(stat._sum.numericWeight || 0) / (stats.totalWeight || 1) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card className="bg-white border-indigo-200 shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="جستجو..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={workTypeFilter || 'all'} onValueChange={(value) => setWorkTypeFilter(value === 'all' ? '' : value)}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="نوع کار" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="النگو">النگو</SelectItem>
                  <SelectItem value="ریخته ای">ریخته‌ای</SelectItem>
                </SelectContent>
              </Select>
              <Select value={karatStatusFilter || 'all'} onValueChange={(value) => setKaratStatusFilter(value === 'all' ? '' : value)}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="وضعیت عیار" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="استاندارد">استاندارد</SelectItem>
                  <SelectItem value="بالا">بالا</SelectItem>
                  <SelectItem value="پایین">پایین</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { setCurrentPage(1); fetchRecords(); }}>
                <RefreshCw className="ml-2 h-4 w-4" />
                بروزرسانی
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="bg-white border-indigo-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Trash2 className="h-5 w-5 text-amber-500" />
                    سطل بازیافت
                    <Badge variant="secondary" className="mr-2 bg-amber-100 text-amber-800">
                      {totalRecordsCount} رکورد
                    </Badge>
                  </>
                ) : (
                  <>
                    <TableIcon className="h-5 w-5 text-indigo-500" />
                    لیست رکوردها
                    <Badge variant="secondary" className="mr-2">
                      {totalRecordsCount} رکورد
                    </Badge>
                  </>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  {showTrash ? 'سطل بازیافت خالی است' : 'رکوردی یافت نشد'}
                </h3>
                <p className="text-gray-500">
                  {showTrash
                    ? 'هیچ رکورد حذف‌شده‌ای وجود ندارد. رکوردهای حذف‌شده اینجا نمایش داده می‌شوند و قابل بازگردانی هستند.'
                    : 'برای شروع، روی دکمه "ثبت جدید" کلیک کنید یا کلید Insert را فشار دهید.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-indigo-100 to-purple-100 hover:from-indigo-100 hover:to-purple-100">
                      <TableHead 
                        className="font-bold cursor-pointer hover:bg-indigo-200 transition-colors text-center min-w-[60px]"
                        onClick={() => handleSort('rowNumber')}
                      >
                        <span className="flex items-center justify-center">
                          <SortIcon column="rowNumber" />ردیف
                        </span>
                      </TableHead>
                      <TableHead 
                        className="font-bold cursor-pointer hover:bg-indigo-200 transition-colors text-center min-w-[110px]"
                        onClick={() => handleSort('packetNumber')}
                      >
                        <span className="flex items-center justify-center">
                          <SortIcon column="packetNumber" />شماره پاکت
                        </span>
                      </TableHead>
                      <TableHead 
                        className="font-bold cursor-pointer hover:bg-indigo-200 transition-colors text-center min-w-[100px]"
                        onClick={() => handleSort('date')}
                      >
                        <span className="flex items-center justify-center">
                          <SortIcon column="date" />تاریخ
                        </span>
                      </TableHead>
                      <TableHead 
                        className="font-bold cursor-pointer hover:bg-indigo-200 transition-colors text-center min-w-[90px]"
                        onClick={() => handleSort('workType')}
                      >
                        <span className="flex items-center justify-center">
                          <SortIcon column="workType" />نوع کار
                        </span>
                      </TableHead>
                      <TableHead 
                        className="font-bold cursor-pointer hover:bg-indigo-200 transition-colors text-center min-w-[80px]"
                        onClick={() => handleSort('modelCode')}
                      >
                        <span className="flex items-center justify-center">
                          <SortIcon column="modelCode" />کد مدل
                        </span>
                      </TableHead>
                      <TableHead 
                        className="font-bold cursor-pointer hover:bg-indigo-200 transition-colors text-center min-w-[90px]"
                        onClick={() => handleSort('numericWeight')}
                      >
                        <span className="flex items-center justify-center">
                          <SortIcon column="numericWeight" />وزن (گرم)
                        </span>
                      </TableHead>
                      <TableHead 
                        className="font-bold cursor-pointer hover:bg-indigo-200 transition-colors text-center min-w-[80px]"
                        onClick={() => handleSort('numericKarat')}
                      >
                        <span className="flex items-center justify-center">
                          <SortIcon column="numericKarat" />عیار
                        </span>
                      </TableHead>
                      <TableHead 
                        className="font-bold cursor-pointer hover:bg-indigo-200 transition-colors text-center min-w-[130px]"
                        onClick={() => handleSort('karatStatus')}
                      >
                        <span className="flex items-center justify-center">
                          <SortIcon column="karatStatus" />وضعیت
                        </span>
                      </TableHead>
                      <TableHead className="font-bold text-left min-w-[100px]">عملیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow
                        key={record.id}
                        className={`transition-colors ${showTrash ? 'opacity-70 bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-indigo-50/50'}`}
                      >
                        <TableCell className="text-center font-medium">{record.rowNumber}</TableCell>
                        <TableCell className="text-center">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {record.packetNumber}
                          </code>
                        </TableCell>
                        <TableCell className="text-center">{record.date}</TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={record.workType === 'النگو' ? 'default' : 'secondary'}
                            className={record.workType === 'النگو' ? 'bg-indigo-500 hover:bg-indigo-600' : ''}
                          >
                            {record.workType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono">{record.modelCode}</TableCell>
                        <TableCell className="text-center font-mono">{record.numericWeight.toFixed(2)}</TableCell>
                        <TableCell className={`text-center ${getKaratColor(record.numericKarat)}`}>
                          {record.numericKarat || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={getKaratBadgeVariant(record.karatStatus)} className="gap-1">
                            {record.karatStatus || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex gap-1 justify-end">
                            {showTrash ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                title="بازیابی رکورد"
                                onClick={() => handleRestore(record.id)}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(record)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDelete(record.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">
                  صفحه {currentPage} از {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    قبلی
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    بعدی
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { 
        setFormOpen(open); 
        if (!open) resetForm(); 
      }}>
        <DialogContent className="sm:max-w-[550px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-500" />
              {editingId ? 'بروزرسانی رکورد' : 'ثبت رکورد جدید'}
            </DialogTitle>
            <DialogDescription>
              {editingId ? 'اطلاعات رکورد را ویرایش کنید' : 'اطلاعات جدید را وارد کنید'}
            </DialogDescription>
          </DialogHeader>
          
          {/* Show notification if there's saved form data */}
          {!editingId && formData.packetNumber && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-amber-700">
                ✨ داده‌های ذخیره شده قبلی بازیابی شدند
              </span>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                onClick={resetForm}
                className="text-amber-600 hover:text-amber-800"
              >
                پاک کردن
              </Button>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="packetNumber">شماره پاکت *</Label>
                <Input
                  ref={(el) => { inputRefs.current[0] = el; }}
                  id="packetNumber"
                  value={formData.packetNumber}
                  onChange={(e) => handlePacketNumberChange(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 0)}
                  className={duplicateError ? 'border-red-500 focus:border-red-500' : ''}
                  required
                  autoFocus={!editingId}
                />
                {duplicateError && (
                  <p className="text-red-500 text-xs">این شماره پاکت قبلاً ثبت شده است!</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">تاریخ *</Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      ref={(el) => { inputRefs.current[1] = el; }}
                      variant="outline"
                      className="w-full justify-start text-right font-normal"
                      onKeyDown={(e) => handleKeyDown(e, 1)}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {formData.date ? formData.date : <span className="text-muted-foreground">انتخاب تاریخ شمسی</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <JalaliDatePicker
                      value={formData.date}
                      onChange={handleDateSelect}
                      placeholder="انتخاب تاریخ شمسی"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workType">نوع کار *</Label>
                <Select 
                  value={formData.workType} 
                  onValueChange={(value) => setFormData({ ...formData, workType: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="النگو">النگو</SelectItem>
                    <SelectItem value="ریخته ای">ریخته‌ای</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelCode">کد مدل *</Label>
                <Input
                  ref={(el) => { inputRefs.current[2] = el; }}
                  id="modelCode"
                  value={formData.modelCode}
                  onChange={(e) => setFormData({ ...formData, modelCode: e.target.value })}
                  onKeyDown={(e) => handleKeyDown(e, 2)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numericWeight">وزن ری (گرم) *</Label>
              <Input
                ref={(el) => { inputRefs.current[3] = el; }}
                id="numericWeight"
                type="number"
                step="0.01"
                value={formData.numericWeight}
                onChange={(e) => setFormData({ ...formData, numericWeight: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 3)}
                required
                className="w-32"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meltNumber">شماره ذوب</Label>
                <Input
                  ref={(el) => { inputRefs.current[4] = el; }}
                  id="meltNumber"
                  value={formData.meltNumber}
                  onChange={(e) => setFormData({ ...formData, meltNumber: e.target.value })}
                  onKeyDown={(e) => handleKeyDown(e, 4)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numericKarat">عیار دریافتی</Label>
                <Input
                  ref={(el) => { inputRefs.current[5] = el; }}
                  id="numericKarat"
                  type="number"
                  step="0.5"
                  value={formData.numericKarat}
                  onChange={(e) => setFormData({ ...formData, numericKarat: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submitButtonRef.current?.click()
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">توضیحات</Label>
              <Textarea
                ref={(el) => { inputRefs.current[6] = el; }}
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                ref={submitButtonRef}
                type="submit"
                disabled={submitting || duplicateError}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                    در حال ارسال...
                  </>
                ) : editingId ? (
                  'بروزرسانی'
                ) : (
                  'ثبت رکورد'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setFormOpen(false); resetForm(); }}
              >
                انصراف
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
