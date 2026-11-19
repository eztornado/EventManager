import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Modal,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconCalendarPlus,
  IconChartBar,
  IconDots,
  IconEdit,
  IconExternalLink,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, PageHeader, SectionCard } from '../../components/Page'
import { StatusBadge } from '../../components/StatusBadge'
import type { EventItem, Organizer } from '../../types'
import { formatDate, money } from '../../utils/format'
import {
  EventFormFields,
  emptyEventForm,
  eventPayload,
  eventStatuses,
  type EventFormValue,
} from './EventFormFields'

export function EventsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const isOrganizer = user?.role === 'organizer'

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<EventFormValue>(emptyEventForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: events, isLoading } = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => api.get<EventItem[]>('/admin/events'),
  })

  const { data: organizers } = useQuery({
    queryKey: ['admin-organizers'],
    queryFn: () => api.get<Organizer[]>('/admin/organizers'),
    enabled: !isOrganizer,
  })

  const filtered = useMemo(() => {
    if (!events) return []
    const needle = search.trim().toLowerCase()
    return events.filter((event) => {
      if (status && (event.statusLabel ?? event.status) !== status) return false
      if (!needle) return true
      return (
        event.name.toLowerCase().includes(needle) ||
        event.city.toLowerCase().includes(needle) ||
        event.province.toLowerCase().includes(needle) ||
        (event.organizer?.name ?? '').toLowerCase().includes(needle)
      )
    })
  }, [events, search, status])

  const openCreate = () => {
    setForm({
      ...emptyEventForm,
      organizerId: isOrganizer ? null : (organizers?.[0]?.id ?? null),
    })
    setCreateOpen(true)
  }

  const createEvent = async () => {
    if (!form.name.trim() || !form.startDate) {
      notifications.show({ color: 'red', message: 'El nombre y la fecha de inicio son obligatorios.' })
      return
    }
    if (!isOrganizer && !form.organizerId) {
      notifications.show({ color: 'red', message: 'Selecciona un organizador.' })
      return
    }
    setSaving(true)
    try {
      const created = await api.post<EventItem>('/admin/events', eventPayload(form))
      notifications.show({ color: 'teal', message: 'Evento creado correctamente.' })
      setCreateOpen(false)
      queryClient.invalidateQueries({ queryKey: ['admin-events'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate(`/admin/eventos/${created.id}`)
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido crear el evento.',
      })
    } finally {
      setSaving(false)
    }
  }

  const removeEvent = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/admin/events/${deleteTarget.id}`)
      notifications.show({ color: 'teal', message: 'Evento eliminado.' })
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['admin-events'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido eliminar el evento.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="Eventos"
        subtitle="Crea y gestiona los eventos, sus modalidades, tarifas y cupones."
        actions={
          <Button leftSection={<IconCalendarPlus size={16} />} onClick={openCreate}>
            Nuevo evento
          </Button>
        }
      />

      <SectionCard>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput
            label="Buscar"
            placeholder="Nombre, ciudad u organizador"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Select
            label="Estado"
            placeholder="Todos"
            data={eventStatuses.map((item) => ({ value: item, label: item }))}
            value={status}
            onChange={setStatus}
            clearable
          />
          <Box style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Text size="sm" c="dimmed">
              {filtered.length} de {events?.length ?? 0} eventos
            </Text>
          </Box>
        </SimpleGrid>
      </SectionCard>

      {isLoading ? (
        <Skeleton height={420} radius="lg" />
      ) : filtered.length === 0 ? (
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconCalendarPlus size={40} color="var(--mantine-color-gray-5)" />}
            title={events?.length ? 'No hay eventos que coincidan' : 'Todavía no hay eventos'}
            description={
              events?.length
                ? 'Prueba con otra búsqueda o cambia el filtro de estado.'
                : 'Crea tu primer evento para empezar a recibir inscripciones.'
            }
            action={
              <Button variant="light" onClick={openCreate} leftSection={<IconCalendarPlus size={16} />}>
                Crear evento
              </Button>
            }
          />
        </Paper>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={900}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Evento</Table.Th>
                  {!isOrganizer ? <Table.Th>Organizador</Table.Th> : null}
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Modalidades</Table.Th>
                  <Table.Th>Ocupación</Table.Th>
                  <Table.Th ta="right">Ingresos</Table.Th>
                  <Table.Th ta="right">Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((event) => {
                  const filled =
                    event.maxParticipants && event.maxParticipants > 0
                      ? Math.min(100, (event.registrationCount / event.maxParticipants) * 100)
                      : 0
                  return (
                    <Table.Tr key={event.id}>
                      <Table.Td>
                        <Text
                          component={Link}
                          to={`/admin/eventos/${event.id}`}
                          fw={600}
                          size="sm"
                        >
                          {event.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatDate(event.startDate)}
                          {event.city ? ` · ${event.city}` : ''}
                        </Text>
                        {!event.published ? (
                          <Badge size="xs" color="gray" variant="light" mt={4}>
                            No publicado
                          </Badge>
                        ) : null}
                      </Table.Td>
                      {!isOrganizer ? (
                        <Table.Td>
                          <Text size="sm">{event.organizer?.name ?? '—'}</Text>
                        </Table.Td>
                      ) : null}
                      <Table.Td>
                        <StatusBadge status={event.statusLabel ?? event.status} kind="event" />
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="gray" radius="sm">
                          {event.modalityCount}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Box w={150}>
                          <Progress value={filled} size="sm" radius="xl" color="teal" />
                          <Text size="xs" c="dimmed" mt={4}>
                            {event.registrationCount}
                            {event.maxParticipants ? ` / ${event.maxParticipants}` : ''} inscritos
                          </Text>
                        </Box>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" fw={600}>
                          {money(event.revenue ?? 0)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {event.paidCount ?? 0} pagadas
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Ver dashboard del evento">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              component={Link}
                              to={`/admin/inscripciones?eventId=${event.id}`}
                            >
                              <IconChartBar size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Editar">
                            <ActionIcon
                              variant="subtle"
                              color="teal"
                              component={Link}
                              to={`/admin/eventos/${event.id}`}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Menu position="bottom-end">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray">
                                <IconDots size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                component={Link}
                                to={`/eventos/${event.slug}`}
                                target="_blank"
                                leftSection={<IconExternalLink size={15} />}
                              >
                                Ver en la tienda
                              </Menu.Item>
                              <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={15} />}
                                onClick={() => setDeleteTarget(event)}
                              >
                                Eliminar evento
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo evento"
        size="xl"
      >
        <Stack gap="md">
          <EventFormFields
            value={form}
            onChange={setForm}
            organizers={organizers ?? []}
            showOrganizer={!isOrganizer}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createEvent} loading={saving}>
              Crear evento
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar evento"
      >
        <Text size="sm">
          ¿Seguro que quieres eliminar «{deleteTarget?.name}»? Se eliminarán también sus
          modalidades, inscripciones, cupones y regalos asociados. Esta acción no se puede deshacer.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="subtle" color="gray" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button color="red" onClick={removeEvent} loading={deleting}>
            Eliminar
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}
