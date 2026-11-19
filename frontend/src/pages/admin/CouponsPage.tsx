import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
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
  IconAlertCircle,
  IconEdit,
  IconPercentage,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, toQuery } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, PageHeader, SectionCard } from '../../components/Page'
import { StatusBadge } from '../../components/StatusBadge'
import type { Coupon, EventItem, Modality } from '../../types'
import { formatDate, money } from '../../utils/format'
import {
  CouponFormFields,
  couponPayload,
  couponToForm,
  emptyCouponForm,
  type CouponFormValue,
} from './CouponFormFields'

export const couponKindLabels: Record<string, string> = {
  percent: 'Porcentaje',
  fixed: 'Importe fijo',
  gift: 'Regalo',
}

export function couponValue(coupon: Coupon) {
  if (coupon.kind === 'percent') return `${coupon.value}%`
  if (coupon.kind === 'fixed') return money(coupon.value)
  return 'Regalo'
}

export function CouponsPage() {
  const { user } = useAuth()
  const isOrganizer = user?.role === 'organizer'
  const queryClient = useQueryClient()

  const [eventFilter, setEventFilter] = useState<string>('')
  const [status, setStatus] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [form, setForm] = useState<CouponFormValue>(emptyCouponForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)
  const [deleting, setDeleting] = useState(false)

  const query = toQuery({ eventId: eventFilter, status, search })

  const { data: events } = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => api.get<EventItem[]>('/admin/events'),
  })

  const { data: coupons, isLoading } = useQuery({
    queryKey: ['admin-coupons', query],
    queryFn: () => api.get<Coupon[]>(`/admin/coupons${query}`),
  })

  const modalities = useMemo<Modality[]>(
    () => (events ?? []).flatMap((event) => event.modalities ?? []),
    [events],
  )

  const openNew = () => {
    setEditing(null)
    setForm({
      ...emptyCouponForm,
      eventId: eventFilter ? Number(eventFilter) : isOrganizer ? (events?.[0]?.id ?? null) : null,
    })
    setModalOpen(true)
  }

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon)
    setForm(couponToForm(coupon))
    setModalOpen(true)
  }

  const save = async () => {
    if (isOrganizer && !form.eventId) {
      notifications.show({ color: 'red', message: 'Selecciona un evento para el cupón.' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/admin/coupons/${editing.id}`, couponPayload(form))
        notifications.show({ color: 'teal', message: 'Cupón actualizado.' })
      } else {
        await api.post('/admin/coupons', couponPayload(form))
        notifications.show({ color: 'teal', message: 'Cupón creado.' })
      }
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
      queryClient.invalidateQueries({ queryKey: ['admin-events'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido guardar el cupón.',
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/admin/coupons/${deleteTarget.id}`)
      notifications.show({ color: 'teal', message: 'Cupón eliminado.' })
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
      queryClient.invalidateQueries({ queryKey: ['admin-events'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido eliminar el cupón.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="Cupones"
        subtitle="Descuentos y códigos promocionales para tus eventos."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={openNew}>
            Nuevo cupón
          </Button>
        }
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
            value={eventFilter || null}
            onChange={(selected) => setEventFilter(selected ?? '')}
            clearable
            searchable
            w={{ base: '100%', sm: 300 }}
          />
          <Select
            label="Estado"
            placeholder="Todos"
            data={[
              { value: 'active', label: 'Activos' },
              { value: 'inactive', label: 'Inactivos' },
              { value: 'exhausted', label: 'Agotados' },
            ]}
            value={status}
            onChange={setStatus}
            clearable
            w={{ base: '100%', sm: 180 }}
          />
          <TextInput
            label="Buscar"
            placeholder="Código"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
        </Group>
      </SectionCard>

      {isLoading ? (
        <Skeleton height={400} radius="lg" />
      ) : !coupons || coupons.length === 0 ? (
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconPercentage size={40} color="var(--mantine-color-gray-5)" />}
            title="Sin cupones"
            description="Crea códigos de descuento para tus eventos y modalidades."
            action={
              <Button variant="light" onClick={openNew}>
                Crear cupón
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
                  <Table.Th>Código</Table.Th>
                  <Table.Th>Evento</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Valor</Table.Th>
                  <Table.Th>Usos</Table.Th>
                  <Table.Th>Validez</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th ta="right">Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {coupons.map((coupon) => {
                  const exhausted = coupon.maxUses !== null && coupon.uses >= coupon.maxUses
                  return (
                    <Table.Tr key={coupon.id}>
                      <Table.Td>
                        <Code fw={700}>{coupon.code}</Code>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {coupon.eventName ?? 'Todos los eventos'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {coupon.modalityName ?? 'Todas las modalidades'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{couponKindLabels[coupon.kind] ?? coupon.kind}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {couponValue(coupon)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {coupon.uses}
                          {coupon.maxUses !== null ? ` / ${coupon.maxUses}` : ''}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {formatDate(coupon.validFrom)} — {formatDate(coupon.validUntil)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <StatusBadge
                          status={exhausted ? 'exhausted' : coupon.active ? 'active' : 'inactive'}
                          kind="coupon"
                        />
                      </Table.Td>
                      <Table.Td ta="right">
                        <Group gap={2} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Editar">
                            <ActionIcon
                              variant="subtle"
                              color="teal"
                              size="sm"
                              onClick={() => openEdit(coupon)}
                            >
                              <IconEdit size={15} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Eliminar">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="sm"
                              onClick={() => setDeleteTarget(coupon)}
                            >
                              <IconTrash size={15} />
                            </ActionIcon>
                          </Tooltip>
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
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar cupón' : 'Nuevo cupón'}
        size="lg"
      >
        <Stack gap="sm">
          <Alert color="blue" icon={<IconAlertCircle size={18} />}>
            Si dejas el código vacío se generará uno aleatorio. Puedes crear varios códigos a la vez
            usando la cantidad.
          </Alert>
          <CouponFormFields
            value={form}
            onChange={setForm}
            events={events ?? []}
            modalities={modalities}
            showEvent
            showQuantity={!editing}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Guardar cupón
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar cupón"
      >
        <Text size="sm">
          ¿Seguro que quieres eliminar el cupón <Code>{deleteTarget?.code}</Code>? Esta acción no se
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
