import { Badge } from '@mantine/core'
import { statusLabel } from '../utils/format'

type Kind = 'registration' | 'order' | 'gift' | 'event' | 'coupon'

function colorFor(status: string, kind: Kind): string {
  if (kind === 'event') {
    if (status === 'Inscripciones abiertas') return 'teal'
    if (status === 'Programada') return 'blue'
    if (status === 'Pausa') return 'yellow'
    if (status === 'Inscripciones cerradas') return 'gray'
    if (status === 'Sin modalidades asignadas') return 'grape'
    return 'gray'
  }
  if (kind === 'gift') {
    if (status === 'available') return 'teal'
    if (status === 'claimed') return 'blue'
    if (status === 'pending') return 'yellow'
    return 'red'
  }
  if (kind === 'coupon') {
    if (status === 'active') return 'teal'
    if (status === 'exhausted') return 'orange'
    return 'gray'
  }
  if (status === 'paid' || status === 'completed') return 'teal'
  if (status === 'pending') return 'yellow'
  if (status === 'cancelled') return 'red'
  return 'gray'
}

export function StatusBadge({
  status,
  kind = 'registration',
  size = 'sm',
}: {
  status: string
  kind?: Kind
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  return (
    <Badge color={colorFor(status, kind)} variant="light" size={size} radius="sm">
      {statusLabel(status, kind)}
    </Badge>
  )
}
