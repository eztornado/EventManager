import { useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Divider,
  Grid,
  Group,
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
  IconCheck,
  IconGift,
  IconSearch,
  IconTicket,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, openReceipt } from '../../api/client'
import { EmptyState } from '../../components/Page'
import { StatusBadge } from '../../components/StatusBadge'
import type { DynamicField, Gift, Registration } from '../../types'
import { formatDateTime, money } from '../../utils/format'

const genderOptions = [
  { value: 'Femenino', label: 'Femenino' },
  { value: 'Masculino', label: 'Masculino' },
  { value: 'No binario', label: 'No binario' },
  { value: 'Prefiero no decirlo', label: 'Prefiero no decirlo' },
]

export function GiftClaimPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [input, setInput] = useState(code ?? '')
  const [activeCode, setActiveCode] = useState(code ?? '')
  const [claimed, setClaimed] = useState<Registration | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    gender: '',
    documentId: '',
    province: '',
    country: 'España',
    clubName: '',
  })
  const [dynamicData, setDynamicData] = useState<Record<string, unknown>>({})

  const { data: gift, isError, error } = useQuery({
    queryKey: ['gift', activeCode],
    queryFn: () => api.get<Gift>(`/gifts/${encodeURIComponent(activeCode)}`),
    enabled: Boolean(activeCode),
    retry: false,
  })

  const search = () => {
    if (!input.trim()) return
    setActiveCode(input.trim().toUpperCase())
    setClaimed(null)
    navigate(`/regalos/${input.trim().toUpperCase()}`, { replace: true })
  }

  const claim = async () => {
    if (!gift) return
    if (!form.firstName || !form.lastName || !form.email) {
      notifications.show({ color: 'red', message: 'Completa tu nombre, apellidos y correo.' })
      return
    }
    const missing = gift.modality?.dynamicFields?.find((field) => field.required && !dynamicData[field.key])
    if (missing) {
      notifications.show({ color: 'red', message: `El campo «${missing.label}» es obligatorio.` })
      return
    }
    setSubmitting(true)
    try {
      const response = await api.post<{ registration: Registration }>(
        `/gifts/${encodeURIComponent(gift.code)}/claim`,
        { ...form, dynamicData },
      )
      setClaimed(response.registration)
      queryClient.invalidateQueries({ queryKey: ['gift', activeCode] })
      notifications.show({ color: 'teal', message: '¡Regalo canjeado! Ya estás inscrito.' })
    } catch (requestError) {
      notifications.show({
        color: 'red',
        message: requestError instanceof Error ? requestError.message : 'No se ha podido canjear.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack gap="lg">
      <Box>
        <Title order={2}>Canjear un regalo</Title>
        <Text c="dimmed" size="sm">
          Introduce el código que recibiste por correo para formalizar tu inscripción.
        </Text>
      </Box>

      <Paper withBorder radius="lg" p="lg">
        <Group align="flex-end">
          <TextInput
            label="Código de regalo"
            placeholder="Ej. REGALO2027"
            leftSection={<IconGift size={16} />}
            value={input}
            onChange={(event) => setInput(event.currentTarget.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') search()
            }}
            style={{ flex: 1, minWidth: 240 }}
          />
          <Button onClick={search} disabled={!input.trim()} leftSection={<IconSearch size={16} />}>
            Buscar regalo
          </Button>
        </Group>
      </Paper>

      {isError ? (
        <Alert color="red" icon={<IconAlertCircle size={18} />}>
          {error instanceof Error ? error.message : 'No encontramos ningún regalo con ese código.'}
        </Alert>
      ) : null}

      {!activeCode ? (
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconGift size={40} color="var(--mantine-color-gray-5)" />}
            title="Un regalo te espera"
            description="Cuando alguien te regala una inscripción recibirás un código por correo."
          />
        </Paper>
      ) : null}

      {gift ? (
        <>
          <Paper withBorder radius="lg" p="lg">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Group gap="xs">
                  <StatusBadge status={gift.status} kind="gift" size="md" />
                  <Badge variant="light" color="grape">
                    Regalo
                  </Badge>
                </Group>
                <Title order={3} mt="xs">
                  {gift.eventName ?? gift.event?.name}
                </Title>
                <Text c="dimmed" size="sm">
                  {gift.modalityName ?? gift.modality?.name} ·{' '}
                  {formatDateTime(gift.event?.startDate)}
                </Text>
              </Box>
              <Box ta="right">
                <Text size="xs" c="dimmed">
                  Código
                </Text>
                <Code fw={700} fz="lg">
                  {gift.code}
                </Code>
              </Box>
            </Group>
            <Divider my="md" />
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  De parte de
                </Text>
                <Text size="sm">{gift.buyerName}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Para
                </Text>
                <Text size="sm">{gift.recipientName}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Importe abonado
                </Text>
                <Text size="sm">{money(gift.pricePaid)}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Fecha
                </Text>
                <Text size="sm">{formatDateTime(gift.createdAt)}</Text>
              </Box>
            </SimpleGrid>
            {gift.message ? (
              <Alert color="grape" mt="md" icon={<IconGift size={18} />}>
                <Text size="sm" fs="italic">
                  «{gift.message}»
                </Text>
              </Alert>
            ) : null}
          </Paper>

          {gift.status === 'available' && !claimed ? (
            <Paper withBorder radius="lg" p="lg">
              <Title order={4}>Tus datos de participante</Title>
              <Text size="sm" c="dimmed" mb="md">
                Completa los datos para generar tu inscripción y tu dorsal.
              </Text>
              <Stack gap="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Nombre"
                      required
                      value={form.firstName}
                      onChange={(event) => setForm({ ...form, firstName: event.currentTarget.value })}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Apellidos"
                      required
                      value={form.lastName}
                      onChange={(event) => setForm({ ...form, lastName: event.currentTarget.value })}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Correo electrónico"
                      type="email"
                      required
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.currentTarget.value })}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Teléfono"
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: event.currentTarget.value })}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Fecha de nacimiento"
                      type="date"
                      value={form.birthDate}
                      onChange={(event) => setForm({ ...form, birthDate: event.currentTarget.value })}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Género"
                      data={genderOptions}
                      value={form.gender || null}
                      onChange={(value) => setForm({ ...form, gender: value ?? '' })}
                      clearable
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Documento de identidad"
                      value={form.documentId}
                      onChange={(event) => setForm({ ...form, documentId: event.currentTarget.value })}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Provincia"
                      value={form.province}
                      onChange={(event) => setForm({ ...form, province: event.currentTarget.value })}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="País"
                      value={form.country}
                      onChange={(event) => setForm({ ...form, country: event.currentTarget.value })}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Club"
                      value={form.clubName}
                      onChange={(event) => setForm({ ...form, clubName: event.currentTarget.value })}
                    />
                  </Grid.Col>
                </Grid>

                {gift.modality?.dynamicFields?.map((field) => (
                  <GiftDynamicInput
                    key={field.key}
                    field={field}
                    value={dynamicData[field.key]}
                    onChange={(value) =>
                      setDynamicData({ ...dynamicData, [field.key]: value })
                    }
                  />
                ))}

                <Group justify="flex-end">
                  <Button
                    size="md"
                    leftSection={<IconCheck size={18} />}
                    onClick={claim}
                    loading={submitting}
                  >
                    Canjear regalo
                  </Button>
                </Group>
              </Stack>
            </Paper>
          ) : null}

          {gift.status === 'pending' ? (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
              El pago de este regalo todavía está pendiente de confirmación.
            </Alert>
          ) : null}

          {gift.status === 'claimed' && !claimed ? (
            <Alert color="blue" icon={<IconAlertCircle size={18} />}>
              Este regalo ya se ha canjeado.
            </Alert>
          ) : null}

          {claimed ? (
            <Paper withBorder radius="lg" p="xl">
              <Stack align="center" gap="sm">
                <IconCheck size={40} color="var(--mantine-color-teal-7)" />
                <Title order={3}>¡Inscripción completada!</Title>
                <Text c="dimmed" ta="center">
                  Tu localizador es:
                </Text>
                <Code fz={26} fw={800} style={{ letterSpacing: 4 }}>
                  {claimed.locator}
                </Code>
                <Group>
                  <Button
                    variant="light"
                    leftSection={<IconTicket size={16} />}
                    onClick={() => openReceipt(claimed.locator)}
                  >
                    Ver recibo
                  </Button>
                  <Button component={Link} to="/inscripciones" variant="outline">
                    Consultar inscripción
                  </Button>
                </Group>
              </Stack>
            </Paper>
          ) : null}
        </>
      ) : null}
    </Stack>
  )
}

function GiftDynamicInput({
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
        required={field.required}
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
        required={field.required}
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
        required={field.required}
        value={typeof value === 'number' || typeof value === 'string' ? value : ''}
        onChange={(next) => onChange(next)}
      />
    )
  }
  return (
    <TextInput
      label={field.label}
      required={field.required}
      type={field.type === 'date' ? 'date' : 'text'}
      value={(value as string) ?? ''}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  )
}
