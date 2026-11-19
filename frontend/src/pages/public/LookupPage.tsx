import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Code,
  CopyButton,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconCheck,
  IconCopy,
  IconEdit,
  IconMail,
  IconPrinter,
  IconSearch,
  IconTicket,
  IconTrash,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, openReceipt } from '../../api/client'
import { EmptyState, SectionCard } from '../../components/Page'
import { StatusBadge } from '../../components/StatusBadge'
import type { DynamicField, Registration } from '../../types'
import { formatDateTime, money } from '../../utils/format'

const genderOptions = [
  { value: 'Femenino', label: 'Femenino' },
  { value: 'Masculino', label: 'Masculino' },
  { value: 'No binario', label: 'No binario' },
  { value: 'Prefiero no decirlo', label: 'Prefiero no decirlo' },
]

export function LookupPage() {
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const [locator, setLocator] = useState('')
  const [email, setEmail] = useState('')
  const [recovering, setRecovering] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['registration-lookup', locator],
    queryFn: () => api.get<Registration>(`/registrations/${encodeURIComponent(locator)}`),
    enabled: Boolean(locator),
    retry: false,
  })

  const [editOpen, setEditOpen] = useState(false)
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
    clubName: '',
    dynamicData: {} as Record<string, unknown>,
  })

  const openEdit = () => {
    if (!data) return
    setEditForm({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      birthDate: data.birthDate,
      gender: data.gender,
      documentId: data.documentId,
      province: data.province,
      country: data.country,
      clubName: data.clubName,
      dynamicData: { ...data.dynamicData },
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!data) return
    setSaving(true)
    try {
      await api.put(`/registrations/${encodeURIComponent(data.locator)}`, editForm)
      notifications.show({ color: 'teal', message: 'Inscripción actualizada.' })
      setEditOpen(false)
      queryClient.invalidateQueries({ queryKey: ['registration-lookup', locator] })
    } catch (requestError) {
      notifications.show({
        color: 'red',
        message: requestError instanceof Error ? requestError.message : 'No se ha podido guardar.',
      })
    } finally {
      setSaving(false)
    }
  }

  const cancelRegistration = async () => {
    if (!data) return
    setCancelling(true)
    try {
      await api.post(`/registrations/${encodeURIComponent(data.locator)}/cancel`)
      notifications.show({ color: 'teal', message: 'Inscripción cancelada.' })
      setCancelOpen(false)
      queryClient.invalidateQueries({ queryKey: ['registration-lookup', locator] })
    } catch (requestError) {
      notifications.show({
        color: 'red',
        message: requestError instanceof Error ? requestError.message : 'No se ha podido cancelar.',
      })
    } finally {
      setCancelling(false)
    }
  }

  const recover = async () => {
    setRecovering(true)
    try {
      const response = await api.post<{ message: string }>('/registrations/recover', { email })
      notifications.show({ color: 'teal', message: response.message })
    } catch (requestError) {
      notifications.show({
        color: 'red',
        message: requestError instanceof Error ? requestError.message : 'No se ha podido enviar.',
      })
    } finally {
      setRecovering(false)
    }
  }

  return (
    <Stack gap="lg">
      <Box>
        <Title order={2}>Consulta tu inscripción</Title>
        <Text c="dimmed" size="sm">
          Introduce el localizador que recibiste al formalizar la inscripción.
        </Text>
      </Box>

      <Paper withBorder radius="lg" p="lg">
        <Grid align="flex-end">
          <Grid.Col span={{ base: 12, sm: 7 }}>
            <TextInput
              label="Localizador"
              placeholder="Ej. ABCD1234"
              leftSection={<IconSearch size={16} />}
              value={input}
              onChange={(event) => setInput(event.currentTarget.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && input.trim()) {
                  setLocator(input.trim())
                }
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 5 }}>
            <Group>
              <Button
                onClick={() => setLocator(input.trim())}
                disabled={!input.trim()}
                loading={isLoading}
                leftSection={<IconSearch size={16} />}
              >
                Buscar
              </Button>
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconMail size={16} />}
                onClick={() => {
                  const element = document.getElementById('recover-section')
                  element?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                No lo recuerdo
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Paper>

      {isError ? (
        <Alert color="red" icon={<IconAlertCircle size={18} />} title="No encontramos la inscripción">
          {error instanceof Error ? error.message : 'Revisa el localizador e inténtalo de nuevo.'}
        </Alert>
      ) : null}

      {!locator && !isError ? (
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconTicket size={40} color="var(--mantine-color-gray-5)" />}
            title="Tu inscripción, siempre a mano"
            description="Consulta el estado, modifica tus datos o descarga el recibo con tu localizador."
          />
        </Paper>
      ) : null}

      {data ? (
        <>
          <Paper withBorder radius="lg" p="lg">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Group gap="xs">
                  <StatusBadge status={data.status} kind="registration" size="md" />
                  {data.order ? <StatusBadge status={data.order.status} kind="order" /> : null}
                </Group>
                <Title order={3} mt="xs">
                  {data.eventName}
                </Title>
                <Text c="dimmed" size="sm">
                  {data.modalityName} · {formatDateTime(data.event?.startDate)}
                </Text>
              </Box>
              <Stack gap={6} align="flex-end">
                <Text size="xs" c="dimmed">
                  Localizador
                </Text>
                <Group gap={6}>
                  <Code fz="lg" fw={700}>
                    {data.locator}
                  </Code>
                  <CopyButton value={data.locator}>
                    {({ copied, copy }) => (
                      <Button size="compact-xs" variant="subtle" onClick={copy}>
                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
              </Stack>
            </Group>
            <Divider my="md" />
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
              <Info label="Participante" value={`${data.firstName} ${data.lastName}`} />
              <Info label="Correo" value={data.email} />
              <Info label="Teléfono" value={data.phone || '—'} />
              <Info label="Club" value={data.clubName || '—'} />
              <Info label="Provincia" value={data.province || '—'} />
              <Info label="País" value={data.country || '—'} />
              <Info label="Importe" value={money(data.total)} />
              <Info label="Fecha de inscripción" value={formatDateTime(data.createdAt)} />
            </SimpleGrid>
            <Group mt="lg">
              {data.canModify ? (
                <>
                  <Button variant="light" leftSection={<IconEdit size={16} />} onClick={openEdit}>
                    Modificar datos
                  </Button>
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancelar inscripción
                  </Button>
                </>
              ) : null}
              <Button
                variant="outline"
                leftSection={<IconPrinter size={16} />}
                onClick={() => openReceipt(data.locator)}
              >
                Ver recibo
              </Button>
              <Button
                component={Link}
                to={`/eventos/${data.event?.slug ?? data.eventSlug ?? ''}`}
                variant="subtle"
                leftSection={<IconCalendarEvent size={16} />}
              >
                Ver evento
              </Button>
            </Group>
            {!data.canModify ? (
              <Alert color="gray" mt="md" icon={<IconAlertCircle size={16} />}>
                El plazo para modificar o cancelar esta inscripción ha finalizado.
              </Alert>
            ) : null}
          </Paper>

          {data.modality?.dynamicFields?.length ? (
            <SectionCard title="Datos de la modalidad">
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                {data.modality.dynamicFields.map((field) => (
                  <Info
                    key={field.key}
                    label={field.label}
                    value={displayDynamic(data.dynamicData?.[field.key])}
                  />
                ))}
              </SimpleGrid>
            </SectionCard>
          ) : null}

          {data.order ? (
            <SectionCard title="Pedido y pago">
              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                <Info label="Código de pedido" value={data.order.code} />
                <Info label="Estado" value={<StatusBadge status={data.order.status} kind="order" />} />
                <Info label="Importe" value={money(data.order.amount)} />
                <Info label="Referencia" value={data.order.reference || '—'} />
                <Info label="Pagado el" value={formatDateTime(data.order.paidAt)} />
                <Info label="Método" value={data.order.paymentMethod || 'Tarjeta'} />
                {data.discount > 0 ? <Info label="Descuento" value={money(data.discount)} /> : null}
              </SimpleGrid>
            </SectionCard>
          ) : null}
        </>
      ) : null}

      <Paper withBorder radius="lg" p="lg" id="recover-section">
        <Title order={4}>Recuperar localizador</Title>
        <Text size="sm" c="dimmed" mb="sm">
          Te enviaremos un correo con los datos de tu inscripción.
        </Text>
        <Group align="flex-end">
          <TextInput
            label="Correo electrónico"
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <Button variant="light" onClick={recover} loading={recovering} disabled={!email}>
            Enviar
          </Button>
        </Group>
      </Paper>

      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Modificar inscripción" size="lg">
        <Stack gap="sm">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Nombre"
                value={editForm.firstName}
                onChange={(event) => setEditForm({ ...editForm, firstName: event.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Apellidos"
                value={editForm.lastName}
                onChange={(event) => setEditForm({ ...editForm, lastName: event.currentTarget.value })}
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
                value={editForm.birthDate ? editForm.birthDate.slice(0, 10) : ''}
                onChange={(event) => setEditForm({ ...editForm, birthDate: event.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Género"
                data={genderOptions}
                value={editForm.gender || null}
                onChange={(value) => setEditForm({ ...editForm, gender: value ?? '' })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Documento"
                value={editForm.documentId}
                onChange={(event) => setEditForm({ ...editForm, documentId: event.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Club"
                value={editForm.clubName}
                onChange={(event) => setEditForm({ ...editForm, clubName: event.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Provincia"
                value={editForm.province}
                onChange={(event) => setEditForm({ ...editForm, province: event.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="País"
                value={editForm.country}
                onChange={(event) => setEditForm({ ...editForm, country: event.currentTarget.value })}
              />
            </Grid.Col>
          </Grid>
          {data?.modality?.dynamicFields?.map((field) => (
            <DynamicEdit
              key={field.key}
              field={field}
              value={editForm.dynamicData[field.key]}
              onChange={(value) =>
                setEditForm({
                  ...editForm,
                  dynamicData: { ...editForm.dynamicData, [field.key]: value },
                })
              }
            />
          ))}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} loading={saving}>
              Guardar cambios
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar inscripción">
        <Text size="sm">
          ¿Seguro que quieres cancelar esta inscripción? Esta acción libera tu plaza y no se puede
          deshacer.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="subtle" color="gray" onClick={() => setCancelOpen(false)}>
            Volver
          </Button>
          <Button color="red" onClick={cancelRegistration} loading={cancelling}>
            Sí, cancelar
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Box mt={2}>{typeof value === 'string' ? <Text size="sm">{value}</Text> : value}</Box>
    </Box>
  )
}

function displayDynamic(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}

function DynamicEdit({
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
