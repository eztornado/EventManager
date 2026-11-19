import { useState } from 'react'
import {
  ActionIcon,
  Button,
  Code,
  Group,
  Modal,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconGift,
  IconMailForward,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, toQuery } from '../../api/client'
import { EmptyState, PageHeader, SectionCard } from '../../components/Page'
import { StatusBadge } from '../../components/StatusBadge'
import type { EventItem, Gift } from '../../types'
import { formatDateTime, money } from '../../utils/format'

const statusOptions = [
  { value: 'available', label: 'Disponibles' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'claimed', label: 'Canjeados' },
  { value: 'cancelled', label: 'Cancelados' },
]

export function GiftsPage() {
  const queryClient = useQueryClient()
  const [eventId, setEventId] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Gift | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resending, setResending] = useState<number | null>(null)

  const query = toQuery({ eventId, status, search })

  const { data: events } = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => api.get<EventItem[]>('/admin/events'),
  })

  const { data: gifts, isLoading } = useQuery({
    queryKey: ['admin-gifts', query],
    queryFn: () => api.get<Gift[]>(`/admin/gifts${query}`),
  })

  const resend = async (gift: Gift) => {
    setResending(gift.id)
    try {
      await api.post(`/admin/gifts/${gift.id}/resend`)
      notifications.show({ color: 'teal', message: 'Correo del regalo reenviado.' })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido reenviar el correo.',
      })
    } finally {
      setResending(null)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/admin/gifts/${deleteTarget.id}`)
      notifications.show({ color: 'teal', message: 'Regalo eliminado.' })
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['admin-gifts'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido eliminar el regalo.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="Regalos"
        subtitle="Inscripciones regaladas, códigos de canje y estado de entrega."
      />

      <SectionCard>
        <Group align="flex-end">
          <Select
            label="Evento"
            placeholder="Todos los eventos"
            data={(events ?? []).map((event) => ({
              value: String(event.id),
              label: event.name,
            }))}
            value={eventId || null}
            onChange={(selected) => setEventId(selected ?? '')}
            clearable
            searchable
            w={{ base: '100%', sm: 280 }}
          />
          <Select
            label="Estado"
            placeholder="Todos"
            data={statusOptions}
            value={status}
            onChange={setStatus}
            clearable
            w={{ base: '100%', sm: 180 }}
          />
          <TextInput
            label="Buscar"
            placeholder="Código, nombre o correo"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
        </Group>
      </SectionCard>

      {isLoading ? (
        <Skeleton height={400} radius="lg" />
      ) : !gifts || gifts.length === 0 ? (
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconGift size={40} color="var(--mantine-color-gray-5)" />}
            title="Sin regalos"
            description="Los regalos aparecerán aquí cuando alguien regale una inscripción."
          />
        </Paper>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={1000}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Código</Table.Th>
                  <Table.Th>Evento</Table.Th>
                  <Table.Th>Compra</Table.Th>
                  <Table.Th>Destinatario</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th ta="right">Importe</Table.Th>
                  <Table.Th ta="right">Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {gifts.map((gift) => (
                  <Table.Tr key={gift.id}>
                    <Table.Td>
                      <Code fw={700}>{gift.code}</Code>
                      <Text size="xs" c="dimmed">
                        {formatDateTime(gift.createdAt)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1}>
                        {gift.eventName ?? '—'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {gift.modalityName ?? '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{gift.buyerName}</Text>
                      <Text size="xs" c="dimmed">
                        {gift.buyerEmail}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{gift.recipientName}</Text>
                      <Text size="xs" c="dimmed">
                        {gift.recipientEmail}
                      </Text>
                      {gift.claimedLocator ? (
                        <Text size="xs" c="teal.7">
                          Canjeado: {gift.claimedLocator}
                        </Text>
                      ) : null}
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={gift.status} kind="gift" />
                      {gift.claimedAt ? (
                        <Text size="xs" c="dimmed" mt={2}>
                          {formatDateTime(gift.claimedAt)}
                        </Text>
                      ) : null}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" fw={600}>
                        {money(gift.pricePaid)}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Group gap={2} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Reenviar correo">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            loading={resending === gift.id}
                            onClick={() => resend(gift)}
                          >
                            <IconMailForward size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Eliminar">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            disabled={gift.status === 'claimed'}
                            onClick={() => setDeleteTarget(gift)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}

      <Modal
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar regalo"
      >
        <Text size="sm">
          ¿Seguro que quieres eliminar el regalo <Code>{deleteTarget?.code}</Code>? Esta acción no se
          puede deshacer.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="subtle" color="gray" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button color="red" onClick={remove} loading={deleting}>
            Eliminar
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}
