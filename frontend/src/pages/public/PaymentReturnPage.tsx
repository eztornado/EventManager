import {
  Alert,
  Box,
  Button,
  Code,
  CopyButton,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconCheck, IconCopy, IconTicket } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { api, openReceipt } from '../../api/client'
import type { Gift, Order, Registration } from '../../types'

interface ConfirmResponse {
  order: Order
  registration?: Registration
  gift?: Gift
  alreadyPaid?: boolean
}

export function PaymentReturnPage() {
  const [params] = useSearchParams()
  const order = params.get('order') ?? ''
  const sessionId = params.get('session_id') ?? ''

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stripe-confirm', order, sessionId],
    queryFn: () =>
      api.post<ConfirmResponse>(`/orders/${encodeURIComponent(order)}/confirm`, {
        sessionId,
      }),
    enabled: Boolean(order && sessionId),
    retry: false,
  })

  if (isLoading) {
    return (
      <Paper withBorder radius="lg" p="xl">
        <Stack align="center" gap="md" py="xl">
          <Loader size="lg" />
          <Title order={3}>Confirmando tu pago</Title>
          <Text c="dimmed" ta="center">
            Estamos comprobando la operación con Stripe. No cierres esta pestaña.
          </Text>
        </Stack>
      </Paper>
    )
  }

  if (!order || !sessionId) {
    return (
      <Paper withBorder radius="lg" p="xl">
        <Alert color="red" icon={<IconAlertCircle size={18} />} title="Faltan datos del pago">
          No hemos recibido la referencia del pedido o de la sesión de Stripe.
        </Alert>
        <Button component={Link} to="/inscripciones" variant="light" mt="lg">
          Consultar una inscripción
        </Button>
      </Paper>
    )
  }

  if (isError || !data) {
    return (
      <Paper withBorder radius="lg" p="xl">
        <Alert
          color="red"
          icon={<IconAlertCircle size={18} />}
          title="No hemos podido confirmar el pago"
        >
          {error instanceof Error
            ? error.message
            : 'Stripe todavía no ha confirmado la operación. Espera unos segundos e inténtalo de nuevo.'}
        </Alert>
        <Group mt="lg">
          <Button onClick={() => refetch()}>Reintentar</Button>
          <Button component={Link} to="/inscripciones" variant="light" color="gray">
            Consultar inscripción
          </Button>
        </Group>
      </Paper>
    )
  }

  const registration = data.registration
  const gift = data.gift

  return (
    <Paper withBorder radius="lg" p="xl">
      <Stack align="center" gap="md">
        <Box
          style={{
            width: 68,
            height: 68,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--mantine-color-teal-0)',
          }}
        >
          <IconCheck size={38} color="var(--mantine-color-teal-7)" />
        </Box>
        <Title order={2}>Pago completado</Title>
        <Text c="dimmed" ta="center" maw={520}>
          {gift
            ? 'El regalo ya está disponible y hemos enviado el código por correo.'
            : 'Hemos enviado la confirmación por correo. Guarda tu localizador para consultar o modificar la inscripción.'}
        </Text>

        {gift ? (
          <>
            <Paper withBorder radius="md" p="md" w="100%" maw={440}>
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
            <Paper withBorder radius="md" p="md" w="100%" maw={440}>
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
              <Button component={Link} to="/inscripciones" variant="outline">
                Consultar inscripción
              </Button>
            </Group>
          </>
        ) : (
          <Code>{data.order.code}</Code>
        )}

        <Button component={Link} to="/" variant="subtle" color="gray">
          Volver a los eventos
        </Button>
      </Stack>
    </Paper>
  )
}
