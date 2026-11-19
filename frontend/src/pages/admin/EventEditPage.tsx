import { useEffect, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCalendarEvent,
  IconCoin,
  IconEdit,
  IconExternalLink,
  IconGift,
  IconPlus,
  IconTag,
  IconTicket,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, PageHeader, SectionCard } from '../../components/Page'
import { StatusBadge } from '../../components/StatusBadge'
import type { Coupon, EventItem, Modality, Organizer, PriceTier } from '../../types'
import { formatDate, formatDateTime, money, toInputDateTime } from '../../utils/format'
import {
  EventFormFields,
  eventPayload,
  eventToForm,
  type EventFormValue,
} from './EventFormFields'
import {
  CouponFormFields,
  couponPayload,
  couponToForm,
  emptyCouponForm,
  type CouponFormValue,
} from './CouponFormFields'

const kindLabels: Record<string, string> = {
  percent: 'Porcentaje',
  fixed: 'Importe fijo',
  gift: 'Regalo',
}

function couponValueLabel(coupon: Coupon) {
  if (coupon.kind === 'percent') return `${coupon.value}%`
  if (coupon.kind === 'fixed') return money(coupon.value)
  return 'Regalo'
}

export function EventEditPage() {
  const { id } = useParams()
  const eventId = Number(id)
  const { user } = useAuth()
  const isOrganizer = user?.role === 'organizer'
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [tab, setTab] = useState<string | null>('general')
  const [form, setForm] = useState<EventFormValue | null>(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ['admin-event', eventId],
    queryFn: () => api.get<EventItem>(`/admin/events/${eventId}`),
    enabled: Number.isFinite(eventId) && eventId > 0,
  })

  const { data: organizers } = useQuery({
    queryKey: ['admin-organizers'],
    queryFn: () => api.get<Organizer[]>('/admin/organizers'),
    enabled: !isOrganizer,
  })

  useEffect(() => {
    if (event && !form) {
      setForm(eventToForm(event))
    }
  }, [event, form])

  // --- Modality modal ---
  const [modalityOpen, setModalityOpen] = useState(false)
  const [editingModality, setEditingModality] = useState<Modality | null>(null)
  const [modalityForm, setModalityForm] = useState({
    name: '',
    description: '',
    distanceKm: '' as number | '',
    startTime: '',
    maxParticipants: '' as number | '',
    basePrice: 0 as number | '',
    sortOrder: 0 as number | '',
    active: true,
  })
  const [dynamicJson, setDynamicJson] = useState('[]')
  const [savingModality, setSavingModality] = useState(false)

  // --- Tier modal ---
  const [tierOpen, setTierOpen] = useState(false)
  const [tierModality, setTierModality] = useState<Modality | null>(null)
  const [editingTier, setEditingTier] = useState<PriceTier | null>(null)
  const [tierForm, setTierForm] = useState({
    name: '',
    price: 0 as number | '',
    startsAt: '',
    endsAt: '',
    active: true,
  })
  const [savingTier, setSavingTier] = useState(false)

  // --- Coupon modal ---
  const [couponOpen, setCouponOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [couponForm, setCouponForm] = useState<CouponFormValue>(emptyCouponForm)
  const [savingCoupon, setSavingCoupon] = useState(false)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-event', eventId] })
    queryClient.invalidateQueries({ queryKey: ['admin-events'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Skeleton height={60} radius="lg" />
        <Skeleton height={480} radius="lg" />
      </Stack>
    )
  }

  if (isError || !event || !form) {
    return (
      <Paper withBorder radius="lg" p="xl">
        <EmptyState
          icon={<IconAlertCircle size={40} color="var(--mantine-color-gray-5)" />}
          title="Evento no encontrado"
          description="Puede que se haya eliminado o que no tengas acceso a él."
          action={
            <Button component={Link} to="/admin/eventos" variant="light">
              Volver a eventos
            </Button>
          }
        />
      </Paper>
    )
  }

  const saveEvent = async () => {
    setSavingEvent(true)
    try {
      const updated = await api.put<EventItem>(`/admin/events/${eventId}`, eventPayload(form))
      setForm(eventToForm(updated))
      notifications.show({ color: 'teal', message: 'Evento actualizado.' })
      refresh()
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido guardar el evento.',
      })
    } finally {
      setSavingEvent(false)
    }
  }

  const removeEvent = async () => {
    setDeleting(true)
    try {
      await api.delete(`/admin/events/${eventId}`)
      notifications.show({ color: 'teal', message: 'Evento eliminado.' })
      queryClient.invalidateQueries({ queryKey: ['admin-events'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/admin/eventos', { replace: true })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido eliminar el evento.',
      })
    } finally {
      setDeleting(false)
    }
  }

  const openNewModality = () => {
    setEditingModality(null)
    setModalityForm({
      name: '',
      description: '',
      distanceKm: '',
      startTime: '',
      maxParticipants: '',
      basePrice: 0,
      sortOrder: (event.modalities?.length ?? 0) + 1,
      active: true,
    })
    setDynamicJson('[]')
    setModalityOpen(true)
  }

  const openEditModality = (modality: Modality) => {
    setEditingModality(modality)
    setModalityForm({
      name: modality.name,
      description: modality.description,
      distanceKm: modality.distanceKm ?? '',
      startTime: modality.startTime,
      maxParticipants: modality.maxParticipants ?? '',
      basePrice: modality.basePrice,
      sortOrder: modality.sortOrder,
      active: Boolean(modality.active),
    })
    setDynamicJson(JSON.stringify(modality.dynamicFields ?? [], null, 2))
    setModalityOpen(true)
  }

  const saveModality = async () => {
    if (!modalityForm.name.trim()) {
      notifications.show({ color: 'red', message: 'El nombre de la modalidad es obligatorio.' })
      return
    }
    let fields: unknown
    try {
      fields = JSON.parse(dynamicJson || '[]')
      if (!Array.isArray(fields)) throw new Error('not an array')
    } catch {
      notifications.show({
        color: 'red',
        message: 'Los campos personalizados deben ser un array JSON válido.',
      })
      return
    }
    setSavingModality(true)
    try {
      const payload = {
        ...modalityForm,
        distanceKm: modalityForm.distanceKm === '' ? null : modalityForm.distanceKm,
        maxParticipants:
          modalityForm.maxParticipants === '' ? null : modalityForm.maxParticipants,
        basePrice: modalityForm.basePrice === '' ? 0 : modalityForm.basePrice,
        sortOrder: modalityForm.sortOrder === '' ? 0 : modalityForm.sortOrder,
        dynamicFields: fields,
      }
      if (editingModality) {
        await api.put(`/admin/modalities/${editingModality.id}`, payload)
        notifications.show({ color: 'teal', message: 'Modalidad actualizada.' })
      } else {
        await api.post(`/admin/events/${eventId}/modalities`, payload)
        notifications.show({ color: 'teal', message: 'Modalidad creada.' })
      }
      setModalityOpen(false)
      refresh()
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido guardar la modalidad.',
      })
    } finally {
      setSavingModality(false)
    }
  }

  const removeModality = async (modality: Modality) => {
    try {
      await api.delete(`/admin/modalities/${modality.id}`)
      notifications.show({ color: 'teal', message: 'Modalidad eliminada.' })
      refresh()
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido eliminar la modalidad.',
      })
    }
  }

  const openNewTier = (modality: Modality) => {
    setTierModality(modality)
    setEditingTier(null)
    setTierForm({
      name: '',
      price: modality.basePrice,
      startsAt: '',
      endsAt: '',
      active: true,
    })
    setTierOpen(true)
  }

  const openEditTier = (modality: Modality, tier: PriceTier) => {
    setTierModality(modality)
    setEditingTier(tier)
    setTierForm({
      name: tier.name,
      price: tier.price,
      startsAt: toInputDateTime(tier.startsAt),
      endsAt: toInputDateTime(tier.endsAt),
      active: Boolean(tier.active),
    })
    setTierOpen(true)
  }

  const saveTier = async () => {
    if (!tierModality) return
    if (!tierForm.name.trim()) {
      notifications.show({ color: 'red', message: 'El nombre del tramo es obligatorio.' })
      return
    }
    setSavingTier(true)
    try {
      const payload = {
        ...tierForm,
        price: tierForm.price === '' ? 0 : tierForm.price,
      }
      if (editingTier) {
        await api.put(`/admin/tiers/${editingTier.id}`, payload)
        notifications.show({ color: 'teal', message: 'Tramo actualizado.' })
      } else {
        await api.post(`/admin/modalities/${tierModality.id}/tiers`, payload)
        notifications.show({ color: 'teal', message: 'Tramo creado.' })
      }
      setTierOpen(false)
      refresh()
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido guardar el tramo.',
      })
    } finally {
      setSavingTier(false)
    }
  }

  const removeTier = async (tier: PriceTier) => {
    try {
      await api.delete(`/admin/tiers/${tier.id}`)
      notifications.show({ color: 'teal', message: 'Tramo eliminado.' })
      refresh()
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido eliminar el tramo.',
      })
    }
  }

  const openNewCoupon = () => {
    setEditingCoupon(null)
    setCouponForm({ ...emptyCouponForm, eventId })
    setCouponOpen(true)
  }

  const openEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon)
    setCouponForm(couponToForm(coupon))
    setCouponOpen(true)
  }

  const saveCoupon = async () => {
    setSavingCoupon(true)
    try {
      if (editingCoupon) {
        await api.put(`/admin/coupons/${editingCoupon.id}`, couponPayload(couponForm))
        notifications.show({ color: 'teal', message: 'Cupón actualizado.' })
      } else {
        await api.post('/admin/coupons', couponPayload({ ...couponForm, eventId }))
        notifications.show({ color: 'teal', message: 'Cupón creado.' })
      }
      setCouponOpen(false)
      refresh()
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido guardar el cupón.',
      })
    } finally {
      setSavingCoupon(false)
    }
  }

  const removeCoupon = async (coupon: Coupon) => {
    try {
      await api.delete(`/admin/coupons/${coupon.id}`)
      notifications.show({ color: 'teal', message: 'Cupón eliminado.' })
      refresh()
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido eliminar el cupón.',
      })
    }
  }

  const modalities = event.modalities ?? []
  const coupons = event.coupons ?? []
  const filled = event.maxParticipants
    ? Math.min(100, (event.registrationCount / event.maxParticipants) * 100)
    : 0

  return (
    <Stack gap="lg">
      <Button
        component={Link}
        to="/admin/eventos"
        variant="subtle"
        color="gray"
        leftSection={<IconArrowLeft size={16} />}
        px={0}
        w="fit-content"
      >
        Todos los eventos
      </Button>

      <PageHeader
        title={event.name}
        subtitle={`${event.categoryLabel ?? 'Evento'} · ${formatDate(event.startDate)} · ${event.venue || event.city || 'Sin ubicación'}`}
        actions={
          <>
            <Button
              component={Link}
              to={`/eventos/${event.slug}`}
              target="_blank"
              variant="light"
              color="gray"
              leftSection={<IconExternalLink size={16} />}
            >
              Ver en la tienda
            </Button>
            <Button
              component={Link}
              to={`/admin/inscripciones?eventId=${event.id}`}
              variant="light"
              leftSection={<IconTicket size={16} />}
            >
              Inscripciones
            </Button>
          </>
        }
      />

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Paper withBorder radius="lg" p="md">
          <Group gap="xs">
            <ThemeIcon variant="light" color="teal" radius="md" size="sm">
              <IconUsers size={15} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Inscritos
            </Text>
          </Group>
          <Title order={3} mt={6}>
            {event.registrationCount}
            {event.maxParticipants ? (
              <Text span size="sm" c="dimmed" fw={500}>
                {' '}
                / {event.maxParticipants}
              </Text>
            ) : null}
          </Title>
          <Text size="xs" c="dimmed">
            {Math.round(filled)}% de ocupación
          </Text>
        </Paper>
        <Paper withBorder radius="lg" p="md">
          <Group gap="xs">
            <ThemeIcon variant="light" color="blue" radius="md" size="sm">
              <IconTicket size={15} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Pagadas
            </Text>
          </Group>
          <Title order={3} mt={6}>
            {event.paidCount ?? 0}
          </Title>
          <Text size="xs" c="dimmed">
            Inscripciones confirmadas
          </Text>
        </Paper>
        <Paper withBorder radius="lg" p="md">
          <Group gap="xs">
            <ThemeIcon variant="light" color="grape" radius="md" size="sm">
              <IconCoin size={15} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Ingresos
            </Text>
          </Group>
          <Title order={3} mt={6}>
            {money(event.revenue ?? 0)}
          </Title>
          <Text size="xs" c="dimmed">
            Cobros completados
          </Text>
        </Paper>
        <Paper withBorder radius="lg" p="md">
          <Group gap="xs">
            <ThemeIcon variant="light" color="orange" radius="md" size="sm">
              <IconGift size={15} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Regalos
            </Text>
          </Group>
          <Title order={3} mt={6}>
            {event.giftCount ?? 0}
          </Title>
          <Text size="xs" c="dimmed">
            Inscripciones regaladas
          </Text>
        </Paper>
      </SimpleGrid>

      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="general">Datos generales</Tabs.Tab>
          <Tabs.Tab value="modalidades">Modalidades ({modalities.length})</Tabs.Tab>
          <Tabs.Tab value="cupones">Cupones ({coupons.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general" pt="lg">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <SectionCard
                title="Información del evento"
                description="Estos datos se muestran en la tienda pública."
              >
                <Stack gap="md">
                  <EventFormFields
                    value={form}
                    onChange={setForm}
                    organizers={organizers ?? []}
                    showOrganizer={!isOrganizer}
                  />
                  <Group justify="flex-end">
                    <Button onClick={saveEvent} loading={savingEvent}>
                      Guardar cambios
                    </Button>
                  </Group>
                </Stack>
              </SectionCard>
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Stack gap="lg">
                <SectionCard title="Estado de publicación">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Estado
                      </Text>
                      <StatusBadge status={event.statusLabel ?? event.status} kind="event" />
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Visible en la tienda
                      </Text>
                      <Badge color={event.published ? 'teal' : 'gray'} variant="light">
                        {event.published ? 'Sí' : 'No'}
                      </Badge>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Cierre de inscripciones
                      </Text>
                      <Text size="sm" fw={600}>
                        {formatDateTime(event.registrationDeadline)}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Identificador
                      </Text>
                      <Text size="sm" ff="monospace">
                        {event.slug}
                      </Text>
                    </Group>
                    <Divider />
                    <Button
                      component={Link}
                      to={`/admin/inscripciones?eventId=${event.id}`}
                      variant="light"
                      fullWidth
                      leftSection={<IconTicket size={16} />}
                    >
                      Ver inscripciones del evento
                    </Button>
                  </Stack>
                </SectionCard>

                <SectionCard title="Zona sensible">
                  <Text size="sm" c="dimmed" mb="sm">
                    Eliminar el evento borra en cascada sus modalidades, inscripciones, pedidos,
                    cupones y regalos.
                  </Text>
                  <Button
                    color="red"
                    variant="light"
                    fullWidth
                    leftSection={<IconTrash size={16} />}
                    onClick={() => setDeleteOpen(true)}
                  >
                    Eliminar evento
                  </Button>
                </SectionCard>
              </Stack>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="modalidades" pt="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Box>
                <Title order={4}>Modalidades y tarifas</Title>
                <Text size="sm" c="dimmed">
                  Define distancias, horarios, plazas y tramos de precio.
                </Text>
              </Box>
              <Button leftSection={<IconPlus size={16} />} onClick={openNewModality}>
                Nueva modalidad
              </Button>
            </Group>

            {modalities.length === 0 ? (
              <Paper withBorder radius="lg" p="xl">
                <EmptyState
                  icon={<IconTag size={40} color="var(--mantine-color-gray-5)" />}
                  title="Sin modalidades"
                  description="Añade al menos una modalidad para que el evento admita inscripciones."
                  action={<Button onClick={openNewModality}>Crear modalidad</Button>}
                />
              </Paper>
            ) : (
              modalities.map((modality) => (
                <Paper key={modality.id} withBorder radius="lg" p="lg">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Box>
                      <Group gap="xs">
                        <Title order={5}>{modality.name}</Title>
                        {modality.distanceKm ? (
                          <Badge variant="light" color="teal">
                            {modality.distanceKm} km
                          </Badge>
                        ) : null}
                        <Badge variant="light" color={modality.active ? 'teal' : 'gray'}>
                          {modality.active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed" mt={4}>
                        {modality.description || 'Sin descripción'}
                      </Text>
                      <Group gap="lg" mt="xs">
                        <Text size="xs" c="dimmed">
                          Salida: {modality.startTime || '—'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Precio actual: {money(modality.currentPrice)}
                          {modality.currentTier ? ` (${modality.currentTier})` : ''}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Inscritos: {modality.registrationCount}
                          {modality.maxParticipants ? ` / ${modality.maxParticipants}` : ''}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Campos: {modality.dynamicFields?.length ?? 0}
                        </Text>
                      </Group>
                    </Box>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="Editar modalidad">
                        <ActionIcon variant="subtle" color="teal" onClick={() => openEditModality(modality)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Eliminar modalidad">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => removeModality(modality)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>

                  <Divider my="md" />

                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={600}>
                      Tramos de precio
                    </Text>
                    <Button
                      size="compact-sm"
                      variant="light"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => openNewTier(modality)}
                    >
                      Añadir tramo
                    </Button>
                  </Group>

                  {!modality.tiers || modality.tiers.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      Sin tramos: se aplica el precio base de {money(modality.basePrice)}.
                    </Text>
                  ) : (
                    <Table verticalSpacing="xs" highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Nombre</Table.Th>
                          <Table.Th>Precio</Table.Th>
                          <Table.Th>Desde</Table.Th>
                          <Table.Th>Hasta</Table.Th>
                          <Table.Th>Activo</Table.Th>
                          <Table.Th ta="right">Acciones</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {modality.tiers.map((tier) => (
                          <Table.Tr key={tier.id}>
                            <Table.Td>
                              <Text size="sm" fw={600}>
                                {tier.name}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{money(tier.price)}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">
                                {formatDateTime(tier.startsAt)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">
                                {formatDateTime(tier.endsAt)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge size="xs" variant="light" color={tier.active ? 'teal' : 'gray'}>
                                {tier.active ? 'Sí' : 'No'}
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Group gap={2} justify="flex-end" wrap="nowrap">
                                <ActionIcon
                                  variant="subtle"
                                  color="teal"
                                  size="sm"
                                  onClick={() => openEditTier(modality, tier)}
                                >
                                  <IconEdit size={14} />
                                </ActionIcon>
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  size="sm"
                                  onClick={() => removeTier(tier)}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Paper>
              ))
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="cupones" pt="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Box>
                <Title order={4}>Cupones del evento</Title>
                <Text size="sm" c="dimmed">
                  Descuentos por porcentaje, importe fijo o regalo.
                </Text>
              </Box>
              <Button leftSection={<IconPlus size={16} />} onClick={openNewCoupon}>
                Nuevo cupón
              </Button>
            </Group>

            {coupons.length === 0 ? (
              <Paper withBorder radius="lg" p="xl">
                <EmptyState
                  icon={<IconGift size={40} color="var(--mantine-color-gray-5)" />}
                  title="Sin cupones"
                  description="Crea un cupón para atraer inscripciones o premiar a tu comunidad."
                  action={<Button onClick={openNewCoupon}>Crear cupón</Button>}
                />
              </Paper>
            ) : (
              <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
                <Table highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Código</Table.Th>
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
                      const exhausted =
                        coupon.maxUses !== null && coupon.uses >= coupon.maxUses
                      return (
                        <Table.Tr key={coupon.id}>
                          <Table.Td>
                            <Text size="sm" fw={700} ff="monospace">
                              {coupon.code}
                            </Text>
                            {coupon.modalityName ? (
                              <Text size="xs" c="dimmed">
                                {coupon.modalityName}
                              </Text>
                            ) : null}
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{kindLabels[coupon.kind] ?? coupon.kind}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{couponValueLabel(coupon)}</Text>
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
                              <ActionIcon
                                variant="subtle"
                                color="teal"
                                size="sm"
                                onClick={() => openEditCoupon(coupon)}
                              >
                                <IconEdit size={14} />
                              </ActionIcon>
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                onClick={() => removeCoupon(coupon)}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Table.Tbody>
                </Table>
              </Paper>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Modality modal */}
      <Modal
        opened={modalityOpen}
        onClose={() => setModalityOpen(false)}
        title={editingModality ? 'Editar modalidad' : 'Nueva modalidad'}
        size="lg"
      >
        <Stack gap="sm">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 8 }}>
              <TextInput
                label="Nombre"
                required
                placeholder="Trail 21K"
                value={modalityForm.name}
                onChange={(event) =>
                  setModalityForm({ ...modalityForm, name: event.currentTarget.value })
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <NumberInput
                label="Distancia (km)"
                min={0}
                decimalScale={2}
                value={modalityForm.distanceKm}
                onChange={(next) =>
                  setModalityForm({
                    ...modalityForm,
                    distanceKm: typeof next === 'number' ? next : '',
                  })
                }
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Textarea
                label="Descripción"
                minRows={2}
                value={modalityForm.description}
                onChange={(event) =>
                  setModalityForm({ ...modalityForm, description: event.currentTarget.value })
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput
                label="Hora de salida"
                placeholder="09:00"
                value={modalityForm.startTime}
                onChange={(event) =>
                  setModalityForm({ ...modalityForm, startTime: event.currentTarget.value })
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <NumberInput
                label="Plazas"
                placeholder="Sin límite"
                min={0}
                value={modalityForm.maxParticipants}
                onChange={(next) =>
                  setModalityForm({
                    ...modalityForm,
                    maxParticipants: typeof next === 'number' ? next : '',
                  })
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <NumberInput
                label="Precio base (€)"
                min={0}
                decimalScale={2}
                value={modalityForm.basePrice}
                onChange={(next) =>
                  setModalityForm({
                    ...modalityForm,
                    basePrice: typeof next === 'number' ? next : '',
                  })
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <NumberInput
                label="Orden"
                min={0}
                value={modalityForm.sortOrder}
                onChange={(next) =>
                  setModalityForm({
                    ...modalityForm,
                    sortOrder: typeof next === 'number' ? next : '',
                  })
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 8 }}>
              <Switch
                label="Modalidad activa"
                checked={modalityForm.active}
                onChange={(event) =>
                  setModalityForm({ ...modalityForm, active: event.currentTarget.checked })
                }
                mt={26}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Campos personalizados (JSON)"
            description='Array de objetos: {"key":"talla","label":"Talla de camiseta","type":"select","required":true,"options":["S","M","L"]}'
            minRows={6}
            ff="monospace"
            value={dynamicJson}
            onChange={(event) => setDynamicJson(event.currentTarget.value)}
          />

          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setModalityOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveModality} loading={savingModality}>
              Guardar modalidad
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Tier modal */}
      <Modal
        opened={tierOpen}
        onClose={() => setTierOpen(false)}
        title={`${editingTier ? 'Editar' : 'Nuevo'} tramo · ${tierModality?.name ?? ''}`}
      >
        <Stack gap="sm">
          <TextInput
            label="Nombre"
            required
            placeholder="Tarifa anticipada"
            value={tierForm.name}
            onChange={(event) => setTierForm({ ...tierForm, name: event.currentTarget.value })}
          />
          <NumberInput
            label="Precio (€)"
            min={0}
            decimalScale={2}
            value={tierForm.price}
            onChange={(next) =>
              setTierForm({ ...tierForm, price: typeof next === 'number' ? next : '' })
            }
          />
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Válido desde"
                type="datetime-local"
                value={tierForm.startsAt}
                onChange={(event) => setTierForm({ ...tierForm, startsAt: event.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Válido hasta"
                type="datetime-local"
                value={tierForm.endsAt}
                onChange={(event) => setTierForm({ ...tierForm, endsAt: event.currentTarget.value })}
              />
            </Grid.Col>
          </Grid>
          <Switch
            label="Tramo activo"
            checked={tierForm.active}
            onChange={(event) => setTierForm({ ...tierForm, active: event.currentTarget.checked })}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setTierOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveTier} loading={savingTier}>
              Guardar tramo
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Coupon modal */}
      <Modal
        opened={couponOpen}
        onClose={() => setCouponOpen(false)}
        title={editingCoupon ? 'Editar cupón' : 'Nuevo cupón'}
        size="lg"
      >
        <Stack gap="sm">
          <Alert color="blue" icon={<IconCalendarEvent size={18} />}>
            Los cupones de este evento solo se aplican a sus modalidades.
          </Alert>
          <CouponFormFields
            value={couponForm}
            onChange={setCouponForm}
            events={[event]}
            modalities={modalities}
            showEvent={false}
            showQuantity={!editingCoupon}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setCouponOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveCoupon} loading={savingCoupon}>
              Guardar cupón
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={deleteOpen} onClose={() => setDeleteOpen(false)} title="Eliminar evento">
        <Text size="sm">
          ¿Seguro que quieres eliminar «{event.name}»? Esta acción borra en cascada modalidades,
          inscripciones, pedidos, cupones y regalos. No se puede deshacer.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="subtle" color="gray" onClick={() => setDeleteOpen(false)}>
            Cancelar
          </Button>
          <Button color="red" onClick={removeEvent} loading={deleting}>
            Eliminar definitivamente
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}
