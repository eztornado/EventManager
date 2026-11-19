import dayjs from 'dayjs'
import 'dayjs/locale/es'

dayjs.locale('es')

const currency = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
})

export function money(value: number | null | undefined) {
  return currency.format(Number(value ?? 0))
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return dayjs(value).format('D MMM YYYY')
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return dayjs(value).format('D MMM YYYY · HH:mm')
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return '—'
  return dayjs(value).format('D MMM')
}

export function toInputDateTime(value: string | null | undefined) {
  if (!value) return ''
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DDTHH:mm') : ''
}

export function toInputDate(value: string | null | undefined) {
  if (!value) return ''
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD') : ''
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function statusLabel(status: string, kind: 'registration' | 'order' | 'gift' | 'event' | 'coupon' = 'registration') {
  const maps: Record<string, Record<string, string>> = {
    registration: { paid: 'Pagada', pending: 'Pendiente', cancelled: 'Cancelada' },
    order: { completed: 'Completado', pending: 'Pendiente', cancelled: 'Cancelado' },
    gift: { available: 'Disponible', claimed: 'Canjeado', pending: 'Pendiente', cancelled: 'Cancelado' },
    event: {
      'Inscripciones abiertas': 'Inscripciones abiertas',
      Programada: 'Programada',
      Pausa: 'En pausa',
      'Inscripciones cerradas': 'Inscripciones cerradas',
      'Sin modalidades asignadas': 'Sin modalidades',
      Borrador: 'Borrador',
      Cancelado: 'Cancelado',
    },
    coupon: { active: 'Activo', inactive: 'Inactivo', exhausted: 'Agotado' },
  }
  return maps[kind]?.[status] ?? status
}
