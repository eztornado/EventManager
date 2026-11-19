import { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  CopyButton,
  Divider,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  Skeleton,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconCreditCard,
  IconGift,
  IconTicket,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, openReceipt } from '../../api/client'
import { EmptyState } from '../../components/Page'
import type {
  Club,
  CouponValidation,
  DynamicField,
  EventItem,
  Gift,
  Order,
  PaymentConfig,
  Registration,
} from '../../types'
import { formatDateTime, money } from '../../utils/format'

const genderOptions = [
  { value: 'Femenino', label: 'Femenino' },
  { value: 'Masculino', label: 'Masculino' },
  { value: 'No binario', label: 'No binario' },
  { value: 'Prefiero no decirlo', label: 'Prefiero no decirlo' },
]

const initialPersonal = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  birthDate: '',
  gender: '',
  documentId: '',
  province: '',
  country: 'España',
  clubId: null as number | null,
  clubName: '',
}

export function RegisterPage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const giftMode = params.get('regalo') === '1'
  const requestedModality = Number(params.get('modalidad') ?? 0)

  const [step, setStep] = useState(0)
  const [modalityId, setModalityId] = useState<number | null>(null)
  const [personal, setPersonal] = useState(initialPersonal)
  const [dynamicData, setDynamicData] = useState<Record<string, unknown>>({})
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState<CouponValidation | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paying, setPaying] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [gift, setGift] = useState<Gift | null>(null)
  const [giftForm, setGiftForm] = useState({
    buyerName: '',
    buyerEmail: '',
    recipientName: '',
    recipientEmail: '',
    message: '',
  })
  const [card, setCard] = useState({
    holder: '',
    number: '4242 4242 4242 4242',
    expiry: '12/30',
    cvv: '123',
  })

  const { data: event, isLoading } = useQuery({
    queryKey: ['public-event', slug],
    queryFn: () => api.get<EventItem>(`/events/${slug}`),
    enabled: Boolean(slug),
  })

  const { data: clubs } = useQuery({
    queryKey: ['public-clubs'],
    queryFn: () => api.get<Club[]>('/clubs'),
  })

  const { data: paymentConfig } = useQuery({
    queryKey: ['payment-config'],
    queryFn: () => api.get<PaymentConfig>('/payment/config'),
  })
  const stripeEnabled = paymentConfig?.provider === 'stripe'

  const moderation = useMemo(() => {
    if (!event?.modalities) return null
    return (
      event.modalities.find((modality) => modality.id === modalityId) ??
      event.modalities.find((modality) => modality.id === requestedModality) ??
      event.modalities[0] ??
      null
    )
  }, [event, modalityId, requestedModality])

  const selectedId = modalityId ?? moderation?.id ?? null
  const selected = event?.modalities?.find((modality) => modality.id === selectedId) ?? null

  const price = selected?.currentPrice ?? 0
  const discount = coupon?.valid ? (coupon.discount ?? 0) : 0
  const total = Math.max(0, price - discount)

  if (isLoading) {
    return (
      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Skeleton height={600} radius="lg" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Skeleton height={320} radius="lg" />
        </Grid.Col>
      </Grid>
    )
  }

  if (!event) {
    return (
      <Paper withBorder radius="lg" p="xl">
        <EmptyState
          icon={<IconAlertCircle size={40} />}
          title="Evento no disponible"
          action={
            <Button component={Link} to="/" variant="light">
              Volver a eventos
            </Button>
          }
        />
      </Paper>
    )
  }

  if (!event.registrationOpen || !event.modalities || event.modalities.length === 0) {
    return (
      <Paper withBorder radius="lg" p="xl">
        <EmptyState
          icon={<IconTicket size={40} />}
          title="Inscripciones no disponibles"
          description={
            event.modalities?.length === 0
              ? 'Este evento todavía no tiene modalidades publicadas.'
              : 'El plazo de inscripción no está abierto.'
          }
          action={
            <Button component={Link} to={`/eventos/${event.slug}`} variant="light">
              Volver al evento
            </Button>
          }
        />
      </Paper>
    )
  }

  const isSports = event.category === 'sports'

  const applyCoupon = async () => {
    if (!selected || !couponCode.trim()) return
    setCouponLoading(true)
    try {
      const result = await api.post<CouponValidation>('/coupons/validate', {
        code: couponCode,
        eventId: event.id,
        modalityId: selected.id,
      })
      setCoupon(result)
      if (result.valid) {
        notifications.show({ color: 'teal', message: 'Cupón aplicado correctamente.' })
      } else {
        notifications.show({ color: 'red', message: result.message ?? 'Cupón no válido.' })
      }
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido validar el cupón.',
      })
    } finally {
      setCouponLoading(false)
    }
  }

  const submitForm = async () => {
    if (!selected) return
    if (!giftMode) {
      if (!personal.firstName || !personal.lastName || !personal.email) {
        notifications.show({ color: 'red', message: 'Completa nombre, apellidos y correo.' })
        return
      }
      const missing = selected.dynamicFields.find(
        (field) =>
          field.required &&
          (dynamicData[field.key] === undefined ||
            dynamicData[field.key] === null ||
            dynamicData[field.key] === '' ||
            dynamicData[field.key] === false),
      )
      if (missing) {
        notifications.show({ color: 'red', message: `El campo «${missing.label}» es obligatorio.` })
        return
      }
    } else if (
      !giftForm.buyerName ||
      !giftForm.buyerEmail ||
      !giftForm.recipientName ||
      !giftForm.recipientEmail
    ) {
      notifications.show({ color: 'red', message: 'Completa los datos del comprador y del regalo.' })
      return
    }

    setSubmitting(true)
    try {
      if (giftMode) {
        const response = await api.post<{ gift: Gift; order: Order }>('/gifts', {
          eventId: event.id,
          modalityId: selected.id,
          ...giftForm,
          paymentMethod: 'card',
        })
        setGift(response.gift)
        setOrder(response.order)
        setCard((current) => ({ ...current, holder: giftForm.buyerName }))
      } else {
        const response = await api.post<{ registration: Registration; order: Order }>(
          '/registrations',
          {
            eventId: event.id,
            modalityId: selected.id,
            ...personal,
            dynamicData,
            couponCode: coupon?.valid ? couponCode : '',
            paymentMethod: 'card',
          },
        )
        setRegistration(response.registration)
        setOrder(response.order)
        setCard((current) => ({
          ...current,
          holder: `${response.registration.firstName} ${response.registration.lastName}`,
        }))
      }
      setStep(1)
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'No se ha podido crear la inscripción',
        message: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const pay = async () => {
    if (!order) return
    setPaying(true)
    try {
      const response = await api.post<{
        order: Order
        registration?: Registration
        gift?: Gift
        alreadyPaid?: boolean
        checkoutUrl?: string
        provider?: string
      }>(`/orders/${order.code}/pay`, { outcome: 'success' })
      if (response.checkoutUrl) {
        window.location.assign(response.checkoutUrl)
        return
      }
      setOrder(response.order)
      if (response.registration) setRegistration(response.registration)
      if (response.gift) setGift(response.gift)
      setStep(2)
      notifications.show({ color: 'teal', message: 'Pago completado correctamente.' })
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Pago rechazado',
        message: error instanceof Error ? error.message : 'Prueba con otra tarjeta.',
      })
    } finally {
      setPaying(false)
    }
  }

  return (
    <Stack gap="lg">
      <Button
        component={Link}
        to={`/eventos/${event.slug}`}
        variant="subtle"
        color="gray"
        leftSection={<IconArrowLeft size={16} />}
        px={0}
        w="fit-content"
      >
        Volver al evento
      </Button>

      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={2}>
            {giftMode
              ? 'Regalar una entrada'
              : isSports
                ? 'Nueva inscripción'
                : 'Comprar entrada'}
          </Title>
          <Text c="dimmed" size="sm">
            {event.name} · {formatDateTime(event.startDate)}
          </Text>
        </Box>
        {giftMode ? (
          <Badge color="teal" variant="light" leftSection={<IconGift size={14} />} size="lg">
            Modo regalo
          </Badge>
        ) : null}
      </Group>

      <Stepper active={step} onStepClick={(value) => setStep(value)} allowNextStepsSelect={false}>
        <Stepper.Step label="Datos" description={isSports ? 'Participante y modalidad' : 'Asistente y entrada'} />
        <Stepper.Step label="Pago" description="Pasarela segura" />
        <Stepper.Step label="Confirmación" description="Entrada y recibo" />
      </Stepper>

      <Grid gutter="xl">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder radius="lg" p="lg">
            {step === 0 ? (
              <Stack gap="md">
                <Box>
                  <Title order={4} mb="xs">
                    Entrada
                  </Title>
                  <Select
                    data={event.modalities.map((modality) => ({
                      value: String(modality.id),
                      label: `${modality.name} · ${money(modality.currentPrice)}${
                        modality.spotsLeft !== null ? ` · ${modality.spotsLeft} plazas` : ''
                      }`,
                    }))}
                    value={selectedId ? String(selectedId) : null}
                    onChange={(value) => {
                      setModalityId(value ? Number(value) : null)
                      setCoupon(null)
                    }}
                    allowDeselect={false}
                  />
                  {selected ? (
                    <Text size="xs" c="dimmed" mt={6}>
                      {selected.description}
                      {selected.currentTier ? ` · Tarifa: ${selected.currentTier}` : ''}
                    </Text>
                  ) : null}
                </Box>

                <Divider />

                {giftMode ? (
                  <Stack gap="md">
                    <Box>
                      <Title order={5}>Quién compra el regalo</Title>
                      <Grid mt="xs">
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label="Nombre y apellidos"
                            required
                            value={giftForm.buyerName}
                            onChange={(event) =>
                              setGiftForm({ ...giftForm, buyerName: event.currentTarget.value })
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label="Correo electrónico"
                            type="email"
                            required
                            value={giftForm.buyerEmail}
                            onChange={(event) =>
                              setGiftForm({ ...giftForm, buyerEmail: event.currentTarget.value })
                            }
                          />
                        </Grid.Col>
                      </Grid>
                    </Box>
                    <Box>
                      <Title order={5}>Quién recibe el regalo</Title>
                      <Text size="sm" c="dimmed" mb="xs">
                        Le enviaremos un correo con el código para canjear la inscripción.
                      </Text>
                      <Grid>
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label="Nombre y apellidos"
                            required
                            value={giftForm.recipientName}
                            onChange={(event) =>
                              setGiftForm({ ...giftForm, recipientName: event.currentTarget.value })
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label="Correo electrónico"
                            type="email"
                            required
                            value={giftForm.recipientEmail}
                            onChange={(event) =>
                              setGiftForm({ ...giftForm, recipientEmail: event.currentTarget.value })
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={12}>
                          <Textarea
                            label="Mensaje para la persona que lo recibe"
                            placeholder="¡Nos vemos en la línea de salida!"
                            minRows={3}
                            value={giftForm.message}
                            onChange={(event) =>
                              setGiftForm({ ...giftForm, message: event.currentTarget.value })
                            }
                          />
                        </Grid.Col>
                      </Grid>
                    </Box>
                  </Stack>
                ) : (
                  <Stack gap="md">
                    <Title order={5}>{isSports ? 'Datos del participante' : 'Datos del asistente'}</Title>
                    <Grid>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label="Nombre"
                          required
                          value={personal.firstName}
                          onChange={(input) =>
                            setPersonal({ ...personal, firstName: input.currentTarget.value })
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label="Apellidos"
                          required
                          value={personal.lastName}
                          onChange={(input) =>
                            setPersonal({ ...personal, lastName: input.currentTarget.value })
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label="Correo electrónico"
                          type="email"
                          required
                          value={personal.email}
                          onChange={(input) =>
                            setPersonal({ ...personal, email: input.currentTarget.value })
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label="Teléfono"
                          value={personal.phone}
                          onChange={(input) =>
                            setPersonal({ ...personal, phone: input.currentTarget.value })
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label="Fecha de nacimiento"
                          type="date"
                          value={personal.birthDate}
                          onChange={(input) =>
                            setPersonal({ ...personal, birthDate: input.currentTarget.value })
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Select
                          label="Género"
                          data={genderOptions}
                          value={personal.gender || null}
                          onChange={(value) =>
                            setPersonal({ ...personal, gender: value ?? '' })
                          }
                          clearable
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label="Documento de identidad"
                          value={personal.documentId}
                          onChange={(input) =>
                            setPersonal({ ...personal, documentId: input.currentTarget.value })
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label="Provincia"
                          value={personal.province}
                          onChange={(input) =>
                            setPersonal({ ...personal, province: input.currentTarget.value })
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <TextInput
                          label="País"
                          value={personal.country}
                          onChange={(input) =>
                            setPersonal({ ...personal, country: input.currentTarget.value })
                          }
                        />
                      </Grid.Col>
                      {isSports ? (
                        <>
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <Select
                              label="Club"
                              placeholder="Selecciona tu club"
                              data={(clubs ?? []).map((club) => ({
                                value: String(club.id),
                                label: club.name,
                              }))}
                              value={personal.clubId ? String(personal.clubId) : null}
                              onChange={(value) =>
                                setPersonal({ ...personal, clubId: value ? Number(value) : null })
                              }
                              clearable
                              searchable
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 6 }}>
                            <TextInput
                              label="Otro club"
                              placeholder="Si no aparece en la lista"
                              value={personal.clubName}
                              onChange={(input) =>
                                setPersonal({ ...personal, clubName: input.currentTarget.value })
                              }
                              disabled={Boolean(personal.clubId)}
                            />
                          </Grid.Col>
                        </>
                      ) : null}
                    </Grid>

                    {selected?.dynamicFields?.length ? (
                      <>
                        <Divider label="Datos específicos de la modalidad" labelPosition="left" />
                        <Grid>
                          {selected.dynamicFields.map((field) => (
                            <Grid.Col
                              key={field.key}
                              span={{ base: 12, sm: field.type === 'textarea' ? 12 : 6 }}
                            >
                              <DynamicInput
                                field={field}
                                value={dynamicData[field.key]}
                                onChange={(value) =>
                                  setDynamicData({ ...dynamicData, [field.key]: value })
                                }
                              />
                            </Grid.Col>
                          ))}
                        </Grid>
                      </>
                    ) : null}

                    <Divider label="Cupón de descuento" labelPosition="left" />
                    <Group align="flex-end">
                      <TextInput
                        label="Código"
                        placeholder="Ej. BIENVENIDA10"
                        value={couponCode}
                        onChange={(input) => {
                          setCouponCode(input.currentTarget.value.toUpperCase())
                          setCoupon(null)
                        }}
                        style={{ flex: 1 }}
                      />
                      <Button
                        variant="light"
                        onClick={applyCoupon}
                        loading={couponLoading}
                        disabled={!couponCode.trim()}
                      >
                        Aplicar
                      </Button>
                    </Group>
                    {coupon?.valid ? (
                      <Alert color="teal" icon={<IconCheck size={18} />}>
                        Cupón aplicado: {money(coupon.discount)} de descuento.
                      </Alert>
                    ) : null}
                  </Stack>
                )}

                <Group justify="flex-end" mt="sm">
                  <Button onClick={submitForm} loading={submitting} size="md">
                    Continuar al pago
                  </Button>
                </Group>
              </Stack>
            ) : null}

            {step === 1 && order ? (
              <Stack gap="md">
                {stripeEnabled ? (
                  <Alert color="teal" icon={<IconCreditCard size={18} />} title="Pago seguro con Stripe">
                    Te redirigiremos a la pasarela de Stripe para completar el pago. Al terminar
                    volverás aquí para ver tu entrada.
                  </Alert>
                ) : (
                  <Alert color="blue" icon={<IconCreditCard size={18} />} title="Pasarela de demostración">
                    No se realizará ningún cargo real. Los datos de la tarjeta se muestran únicamente
                    con fines de demostración.
                  </Alert>
                )}
                <Title order={4}>{stripeEnabled ? 'Resumen del pago' : 'Datos de pago'}</Title>
                {stripeEnabled ? (
                  <Text size="sm" c="dimmed">
                    El importe se cobrará en {paymentConfig?.currency?.toUpperCase() ?? 'EUR'}. Podrás
                    pagar con tarjeta, Apple Pay o Google Pay según la disponibilidad de Stripe.
                  </Text>
                ) : (
                  <Grid>
                    <Grid.Col span={12}>
                      <TextInput
                        label="Titular de la tarjeta"
                        value={card.holder}
                        onChange={(input) => setCard({ ...card, holder: input.currentTarget.value })}
                      />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <TextInput
                        label="Número de tarjeta"
                        value={card.number}
                        onChange={(input) => setCard({ ...card, number: input.currentTarget.value })}
                      />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <TextInput
                        label="Caducidad"
                        value={card.expiry}
                        onChange={(input) => setCard({ ...card, expiry: input.currentTarget.value })}
                      />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <TextInput
                        label="CVV"
                        value={card.cvv}
                        onChange={(input) => setCard({ ...card, cvv: input.currentTarget.value })}
                      />
                    </Grid.Col>
                  </Grid>
                )}
                <Divider />
                <Group justify="space-between">
                  <Text fw={600}>Importe a pagar</Text>
                  <Text fw={800} size="xl" c="teal.7">
                    {money(order.amount)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Button variant="subtle" color="gray" onClick={() => setStep(0)}>
                    Volver
                  </Button>
                  <Button
                    size="md"
                    leftSection={<IconCreditCard size={18} />}
                    loading={paying}
                    onClick={pay}
                  >
                    {stripeEnabled ? 'Pagar con Stripe' : `Pagar ${money(order.amount)}`}
                  </Button>
                </Group>
              </Stack>
            ) : null}

            {step === 2 ? (
              <Stack gap="md" align="center" py="lg">
                <Box
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--mantine-color-teal-0)',
                  }}
                >
                  <IconCheck size={36} color="var(--mantine-color-teal-7)" />
                </Box>
                <Title order={3}>
                  {giftMode ? '¡Regalo listo!' : isSports ? '¡Inscripción confirmada!' : '¡Entrada confirmada!'}
                </Title>
                <Text c="dimmed" ta="center" maw={480}>
                  {giftMode
                    ? 'Hemos enviado el código a la persona que recibe el regalo. También puedes compartirlo tú mismo.'
                    : 'Hemos enviado un correo de confirmación. Guarda tu localizador para consultar o modificar la inscripción.'}
                </Text>

                {giftMode && gift ? (
                  <>
                    <Paper withBorder radius="md" p="md" w="100%" maw={420}>
                      <Text size="xs" c="dimmed" ta="center">
                        Código de regalo
                      </Text>
                      <Text ta="center" fw={800} fz={28} ff="monospace" style={{ letterSpacing: 4 }}>
                        {gift.code}
                      </Text>
                    </Paper>
                    <Group>
                      <CopyButton value={gift.code}>
                        {({ copied, copy }) => (
                          <Button
                            variant="light"
                            leftSection={<IconCopy size={16} />}
                            onClick={copy}
                          >
                            {copied ? 'Copiado' : 'Copiar código'}
                          </Button>
                        )}
                      </CopyButton>
                      <Button component={Link} to={`/regalos/${gift.code}`} variant="outline">
                        Ir al canje
                      </Button>
                    </Group>
                  </>
                ) : registration ? (
                  <>
                    <Paper withBorder radius="md" p="md" w="100%" maw={420}>
                      <Text size="xs" c="dimmed" ta="center">
                        Localizador de la entrada
                      </Text>
                      <Text ta="center" fw={800} fz={26} ff="monospace" style={{ letterSpacing: 4 }}>
                        {registration.locator}
                      </Text>
                    </Paper>
                    <Group>
                      <Button
                        variant="light"
                        leftSection={<IconTicket size={16} />}
                        onClick={() => openReceipt(registration.locator)}
                      >
                        Ver recibo
                      </Button>
                      <Button
                        component={Link}
                        to="/inscripciones"
                        variant="outline"
                      >
                        Consultar inscripción
                      </Button>
                    </Group>
                  </>
                ) : null}

                <Button variant="subtle" color="gray" onClick={() => navigate(`/eventos/${event.slug}`)}>
                  Volver al evento
                </Button>
              </Stack>
            ) : null}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder radius="lg" p="lg" style={{ position: 'sticky', top: 88 }}>
            <Title order={4} mb="sm">
              Resumen
            </Title>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Evento
                </Text>
                <Text size="sm" fw={600} ta="right" maw={190}>
                  {event.name}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Entrada
                </Text>
                <Text size="sm" fw={600}>
                  {selected?.name ?? '—'}
                </Text>
              </Group>
              {giftMode && giftForm.recipientName ? (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Para
                  </Text>
                  <Text size="sm" fw={600}>
                    {giftForm.recipientName}
                  </Text>
                </Group>
              ) : null}
              <Divider my={4} />
              <Group justify="space-between">
                <Text size="sm">Precio</Text>
                <Text size="sm">{money(price)}</Text>
              </Group>
              {discount > 0 ? (
                <Group justify="space-between">
                  <Text size="sm" c="teal.7">
                    Descuento
                  </Text>
                  <Text size="sm" c="teal.7">
                    −{money(discount)}
                  </Text>
                </Group>
              ) : null}
              <Divider my={4} />
              <Group justify="space-between">
                <Text fw={700}>Total</Text>
                <Text fw={800} size="xl" c="teal.7">
                  {money(giftMode ? price : total)}
                </Text>
              </Group>
            </Stack>
            <Text size="xs" c="dimmed" mt="md">
              {giftMode
                ? 'La persona que recibe el regalo elegirá sus datos al canjear el código.'
                : 'Puedes modificar tus datos desde «Consultar inscripción» hasta el cierre del plazo.'}
            </Text>
            {giftMode ? (
              <Tooltip label="La inscripción se creará cuando la persona agraciada canjee el código">
                <Badge mt="md" color="grape" variant="light" fullWidth size="lg">
                  Regalo con canje posterior
                </Badge>
              </Tooltip>
            ) : null}
            {order ? (
              <Box mt="md">
                <Text size="xs" c="dimmed">
                  Pedido
                </Text>
                <Code>{order.code}</Code>
              </Box>
            ) : null}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

function DynamicInput({
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
        mt={28}
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
        placeholder={field.placeholder ?? 'Selecciona una opción'}
      />
    )
  }
  if (field.type === 'textarea') {
    return (
      <Textarea
        label={field.label}
        required={field.required}
        placeholder={field.placeholder}
        minRows={3}
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
        placeholder={field.placeholder}
        value={typeof value === 'number' || typeof value === 'string' ? value : ''}
        onChange={(value) => onChange(value)}
      />
    )
  }
  return (
    <TextInput
      label={field.label}
      required={field.required}
      placeholder={field.placeholder}
      type={field.type === 'date' ? 'date' : 'text'}
      value={(value as string) ?? ''}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  )
}
