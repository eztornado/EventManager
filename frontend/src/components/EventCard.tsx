import { Badge, Box, Card, Group, Progress, Stack, Text } from '@mantine/core'
import { IconCalendar, IconMapPin, IconUsers } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import type { EventItem } from '../types'
import { formatDate, money } from '../utils/format'
import { EventCover } from './EventCover'
import { StatusBadge } from './StatusBadge'

export function EventCard({ event }: { event: EventItem }) {
  const navigate = useNavigate()
  const filled =
    event.maxParticipants && event.maxParticipants > 0
      ? Math.min(100, Math.round((event.registrationCount / event.maxParticipants) * 100))
      : 0

  return (
    <Card
      withBorder
      radius="lg"
      p={0}
      onClick={() => navigate(`/eventos/${event.slug}`)}
      style={{ cursor: 'pointer', transition: 'transform 150ms ease, box-shadow 150ms ease' }}
      onMouseEnter={(element) => {
        element.currentTarget.style.transform = 'translateY(-2px)'
        element.currentTarget.style.boxShadow = '0 12px 30px rgba(15, 23, 42, 0.10)'
      }}
      onMouseLeave={(element) => {
        element.currentTarget.style.transform = 'translateY(0)'
        element.currentTarget.style.boxShadow = 'none'
      }}
    >
      <EventCover id={event.id} name={event.name} height={150} radius="0" />
      <Stack gap="sm" p="md">
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <StatusBadge status={event.statusLabel ?? event.status} kind="event" />
          {event.registrationOpen ? (
            <Badge color="teal" variant="dot" size="sm">
              Inscripciones abiertas
            </Badge>
          ) : null}
        </Group>
        <Box>
          <Group gap={6} wrap="nowrap">
            <IconCalendar size={15} color="var(--mantine-color-gray-6)" />
            <Text size="sm" c="dimmed">
              {formatDate(event.startDate)}
            </Text>
          </Group>
          <Group gap={6} wrap="nowrap" mt={2}>
            <IconMapPin size={15} color="var(--mantine-color-gray-6)" />
            <Text size="sm" c="dimmed" lineClamp={1}>
              {event.city}
              {event.province && event.province !== event.city ? ` · ${event.province}` : ''}
            </Text>
          </Group>
        </Box>
        <Group justify="space-between" align="flex-end">
          <Box>
            <Text size="xs" c="dimmed">
              Desde
            </Text>
            <Text fw={700} size="lg" c="teal.7">
              {event.minPrice ? money(event.minPrice) : 'Próximamente'}
            </Text>
          </Box>
          <Group gap={5}>
            <IconUsers size={15} color="var(--mantine-color-gray-6)" />
            <Text size="sm" c="dimmed">
              {event.registrationCount} inscritos
            </Text>
          </Group>
        </Group>
        {event.maxParticipants ? (
          <Box>
            <Progress value={filled} size="xs" radius="xl" color="teal" />
            <Text size="xs" c="dimmed" mt={4}>
              {event.registrationCount} / {event.maxParticipants} plazas
            </Text>
          </Box>
        ) : null}
      </Stack>
    </Card>
  )
}
