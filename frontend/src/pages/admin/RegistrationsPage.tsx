import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Checkbox,
  Code,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconDownload,
  IconEdit,
  IconEye,
  IconFilterOff,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api, downloadCsv, openReceipt, toQuery } from '../../api/client'
import { EmptyState, PageHeader, SectionCard } from '../../components/Page'
import { StatusBadge } from '../../components/StatusBadge'
import type { DynamicField, EventItem, Registration } from '../../types'
import { formatDateTime, money } from '../../utils/format'

const genderOptions = [
  { value: 'Femenino', label: 'Femenino' },
  { value: 'Masculino', label: 'Masculino' },
  { value: 'No binario', label: 'No binario' },
  { value: 'Prefiero no decirlo', label: 'Prefiero no decirlo' },
]

const statusOptions = [
  { value: 'paid', label: 'Pagada' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'cancelled', label: 'Cancelada' },
]

export function RegistrationsPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [eventId, setEventId] = useState(params.get('eventId') ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [detailId, setDetailId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Registration | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    gender: '',
    documentId: '',
    province: '',
    country: '',
    clubId: null as number | null,
    clubName: '',
    status: 'pending',
    dynamicData: {} as Record<string, unknown>,
  })

  const query = toQuery({ eventId, status, search, from, to })

  const { data: events } = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => api.get<EventItem[]>('/admin/events'),
  })

  const { data: registrations, isLoading } = useQuery({
    queryKey: ['admin-registrations', query],
    queryFn: () => api.get<Registration[]>(`/admin/registrations${query}`),
  })

  const { data: detail } = useQuery({
    queryKey: ['admin-registration', detailId],
    queryFn: () => api.get<Registration>(`/admin/registrations/${detailId}`),
    enabled: Boolean(detailId),
  })

  useEffect(() => {
    if (!detail) return
    setEditForm({
      firstName: detail.firstName,
      lastName: detail.lastName,
      email: detail.email,
      phone: detail.phone,
      birthDate: detail.birthDate ? detail.birthDate.slice(0, 10) : '',
      gender: detail.gender,
      documentId: detail.documentId,
      province: detail.province,
      country: detail.country,
      clubId: detail.clubId,
      clubName: detail.clubName,
      status: detail.status,
      dynamicData: { ...detail.dynamicData },
    })
  }, [detail])

  const totals = useMemo(() => {
    if (!registrations) return { count: 0, paid: 0, amount: 0 }
    return {
      count: registrations.length,
      paid: registrations.filter((item) => item.status === 'paid').length,
      amount: registrations
        .filter((item) => item.status === 'paid')
        .reduce((sum, item) => sum + item.total, 0),
    }
  }, [registrations])

  const clearFilters = () => {
    setEventId('')
    setStatus(null)
    setSearch('')
    setFrom('')
    setTo('')
    setParams({})
  }

  const saveDetail = async () => {
    if (!detail) return
    setSaving(true)
    try {
      await api.put(`/admin/registrations/${detail.id}`, editForm)
      notifications.show({ color: 'teal', message: 'Inscripción actualizada.' })
      setDetailId(null)
      queryClient.invalidateQueries({ queryKey: ['admin-registrations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido guardar.',
      })
    } finally {
      setSaving(false)
    }
  }

  const removeRegistration = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/admin/registrations/${deleteTarget.id}`)
      notifications.show({ color: 'teal', message: 'Inscripción eliminada.' })
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['admin-registrations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido eliminar.',
      })
    } finally {
      setDeleting(false)
    }
  }

  const exportCsv = async () => {
    try {
      await downloadCsv(`/admin/registrations/export.csv${query}`, 'inscripciones.csv')
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido exportar.',
      })
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="Inscripciones"
        subtitle="Consulta, actualiza y exporta las inscripciones de tus eventos."
        actions={
          <Button variant="light" leftSection={<IconDownload size={16} />} onClick={exportCsv}>
            Exportar CSV
          </Button>
        }
      />

      <SectionCard>
        <Grid align="flex-end">
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
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
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 2 }}>
            <Select
              label="Estado"
              placeholder="Todos"
              data={statusOptions}
              value={status}
              onChange={setStatus}
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 2 }}>
            <TextInput
              label="Desde"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 2 }}>
            <TextInput
              label="Hasta"
              type="date"
              value={to}
              onChange={(event) => setTo(event.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 3 }}>
            <Group align="flex-end" gap="xs">
              <TextInput
                label="Buscar"
                placeholder="Localizador, nombre, correo o club"
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button variant="subtle" color="gray" onClick={clearFilters} px="xs">
                <IconFilterOff size={18} />
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </SectionCard>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Paper withBorder radius="lg" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Resultados
          </Text>
          <Text fw={800} size="xl">
            {totals.count}
          </Text>
        </Paper>
        <Paper withBorder radius="lg" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Pagadas
          </Text>
          <Text fw={800} size="xl">
            {totals.paid}
          </Text>
        </Paper>
        <Paper withBorder radius="lg" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Importe cobrado
          </Text>
          <Text fw={800} size="xl">
            {money(totals.amount)}
          </Text>
        </Paper>
      </SimpleGrid>

      {isLoading ? (
        <Skeleton height={420} radius="lg" />
      ) : !registrations || registrations.length === 0 ? (
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconSearch size={40} color="var(--mantine-color-gray-5)" />}
            title="Sin inscripciones"
            description="No hay inscripciones que coincidan con los filtros seleccionados."
            action={
              <Button variant="light" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            }
          />
        </Paper>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={980}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Participante</Table.Th>
                  <Table.Th>Evento / modalidad</Table.Th>
                  <Table.Th>Contacto</Table.Th>
                  <Table.Th>Club</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th ta="right">Importe</Table.Th>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th ta="right">Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {registrations.map((registration) => (
                  <Table.Tr key={registration.id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {registration.firstName} {registration.lastName}
                      </Text>
                      <Code>{registration.locator}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1}>
                        {registration.eventName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {registration.modalityName}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{registration.email}</Text>
                      <Text size="xs" c="dimmed">
                        {registration.phone || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{registration.clubName || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={registration.status} />
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" fw={600}>
                        {money(registration.total)}
                      </Text>
                      {registration.discount > 0 ? (
                        <Text size="xs" c="teal.7">
                          −{money(registration.discount)}
                        </Text>
                      ) : null}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {formatDateTime(registration.createdAt)}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Group gap={2} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Ver y editar">
                          <ActionIcon
                            variant="subtle"
                            color="teal"
                            onClick={() => setDetailId(registration.id)}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Recibo">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => openReceipt(registration.locator)}
                          >
                            <IconDownload size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Eliminar">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => setDeleteTarget(registration)}
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
        opened={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        title="Detalle de la inscripción"
        size="xl"
      >
        {!detail ? (
          <Skeleton height={360} radius="md" />
        ) : (
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Group gap="xs">
                  <StatusBadge status={detail.status} size="md" />
                  {detail.order ? <StatusBadge status={detail.order.status} kind="order" /> : null}
                </Group>
                <Text fw={700} mt="xs">
                  {detail.firstName} {detail.lastName}
                </Text>
                <Text size="sm" c="dimmed">
                  {detail.eventName} · {detail.modalityName}
                </Text>
              </Box>
              <Box ta="right">
                <Code fz="md" fw={700}>
                  {detail.locator}
                </Code>
                <Text size="xs" c="dimmed">
                  {formatDateTime(detail.createdAt)}
                </Text>
              </Box>
            </Group>

            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed">
                  Importe
                </Text>
                <Text fw={700}>{money(detail.total)}</Text>
              </Paper>
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed">
                  Descuento
                </Text>
                <Text fw={700}>{money(detail.discount)}</Text>
              </Paper>
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed">
                  Pedido
                </Text>
                <Text fw={700}>{detail.order?.code ?? '—'}</Text>
              </Paper>
              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed">
                  Pagado el
                </Text>
                <Text fw={700}>{formatDateTime(detail.order?.paidAt)}</Text>
              </Paper>
            </SimpleGrid>

            <Divider />

            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Nombre"
                  value={editForm.firstName}
                  onChange={(event) =>
                    setEditForm({ ...editForm, firstName: event.currentTarget.value })
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Apellidos"
                  value={editForm.lastName}
                  onChange={(event) =>
                    setEditForm({ ...editForm, lastName: event.currentTarget.value })
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Correo"
                  value={editForm.email}
                  onChange={(event) => setEditForm({ ...editForm, email: event.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Teléfono"
                  value={editForm.phone}
                  onChange={(event) => setEditForm({ ...editForm, phone: event.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Fecha de nacimiento"
                  type="date"
                  value={editForm.birthDate}
                  onChange={(event) =>
                    setEditForm({ ...editForm, birthDate: event.currentTarget.value })
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
                  label="Género"
                  data={genderOptions}
                  value={editForm.gender || null}
                  onChange={(selected) => setEditForm({ ...editForm, gender: selected ?? '' })}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Documento"
                  value={editForm.documentId}
                  onChange={(event) =>
                    setEditForm({ ...editForm, documentId: event.currentTarget.value })
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Club"
                  value={editForm.clubName}
                  onChange={(event) =>
                    setEditForm({ ...editForm, clubName: event.currentTarget.value })
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Provincia"
                  value={editForm.province}
                  onChange={(event) =>
                    setEditForm({ ...editForm, province: event.currentTarget.value })
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="País"
                  value={editForm.country}
                  onChange={(event) =>
                    setEditForm({ ...editForm, country: event.currentTarget.value })
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
                  label="Estado de la inscripción"
                  data={statusOptions}
                  value={editForm.status}
                  onChange={(selected) =>
                    setEditForm({ ...editForm, status: selected ?? editForm.status })
                  }
                  allowDeselect={false}
                />
              </Grid.Col>
            </Grid>

            {detail.modality?.dynamicFields?.length ? (
              <>
                <Divider label="Datos de la modalidad" labelPosition="left" />
                <Grid>
                  {detail.modality.dynamicFields.map((field) => (
                    <Grid.Col key={field.key} span={{ base: 12, sm: 6 }}>
                      <AdminDynamicInput
                        field={field}
                        value={editForm.dynamicData[field.key]}
                        onChange={(value) =>
                          setEditForm({
                            ...editForm,
                            dynamicData: { ...editForm.dynamicData, [field.key]: value },
                          })
                        }
                      />
                    </Grid.Col>
                  ))}
                </Grid>
              </>
            ) : null}

            <Group justify="space-between">
              <Group>
                <Button
                  variant="light"
                  leftSection={<IconDownload size={16} />}
                  onClick={() => openReceipt(detail.locator)}
                >
                  Ver recibo
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => {
                    setDetailId(null)
                    setDeleteTarget(detail)
                  }}
                >
                  Eliminar
                </Button>
              </Group>
              <Group>
                <Button variant="subtle" color="gray" onClick={() => setDetailId(null)}>
                  Cancelar
                </Button>
                <Button onClick={saveDetail} loading={saving} leftSection={<IconEdit size={16} />}>
                  Guardar cambios
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar inscripción"
      >
        <Alert color="red" icon={<IconAlertCircle size={18} />}>
          Se eliminará la inscripción de {deleteTarget?.firstName} {deleteTarget?.lastName} y su
          pedido asociado. Esta acción no se puede deshacer.
        </Alert>
        <Group justify="flex-end" mt="lg">
          <Button variant="subtle" color="gray" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button color="red" onClick={removeRegistration} loading={deleting}>
            Eliminar
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}

function AdminDynamicInput({
  field,
  value,
  onChange,
}: {
  field: DynamicField
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (field.type === 'checkbox') {
    return (
      <Checkbox
        label={field.label}
        checked={Boolean(value)}
        onChange={(event) => onChange(event.currentTarget.checked)}
        mt={24}
      />
    )
  }
  if (field.type === 'select') {
    return (
      <Select
        label={field.label}
        data={(field.options ?? []).map((option) => ({ value: option, label: option }))}
        value={(value as string) || null}
        onChange={(selected) => onChange(selected ?? '')}
        clearable
      />
    )
  }
  if (field.type === 'textarea') {
    return (
      <Textarea
        label={field.label}
        minRows={2}
        value={(value as string) ?? ''}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    )
  }
  if (field.type === 'number') {
    return (
      <NumberInput
        label={field.label}
        value={typeof value === 'number' || typeof value === 'string' ? value : ''}
        onChange={(next) => onChange(next)}
      />
    )
  }
  return (
    <TextInput
      label={field.label}
      type={field.type === 'date' ? 'date' : 'text'}
      value={(value as string) ?? ''}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  )
}
