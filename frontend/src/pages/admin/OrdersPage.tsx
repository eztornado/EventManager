import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Code,
  Group,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { IconCreditCard, IconGift, IconSearch, IconTicket } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api, toQuery } from '../../api/client'
import { EmptyState, PageHeader, SectionCard } from '../../components/Page'
import { StatusBadge } from '../../components/StatusBadge'
import type { Order, PaymentConfig } from '../../types'
import { formatDateTime, money, paymentMethodLabel } from '../../utils/format'

const statusOptions = [
  { value: 'completed', label: 'Completado' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'cancelled', label: 'Cancelado' },
]

export function OrdersPage() {
  const [status, setStatus] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const query = toQuery({ status, search })

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders', query],
    queryFn: () => api.get<Order[]>(`/admin/orders${query}`),
  })

  const { data: paymentConfig } = useQuery({
    queryKey: ['payment-config'],
    queryFn: () => api.get<PaymentConfig>('/payment/config'),
  })

  const totals = useMemo(() => {
    if (!orders) return { count: 0, completed: 0, amount: 0, pending: 0 }
    return {
      count: orders.length,
      completed: orders.filter((order) => order.status === 'completed').length,
      amount: orders
        .filter((order) => order.status === 'completed')
        .reduce((sum, order) => sum + order.amount, 0),
      pending: orders
        .filter((order) => order.status === 'pending')
        .reduce((sum, order) => sum + order.amount, 0),
    }
  }, [orders])

  return (
    <Stack gap="lg">
      <PageHeader
        title="Pedidos"
        subtitle="Trazabilidad de los pagos simulados de inscripciones y regalos."
      />

      <SectionCard>
        <Group align="flex-end">
          <Select
            label="Estado"
            placeholder="Todos"
            data={statusOptions}
            value={status}
            onChange={setStatus}
            clearable
            w={{ base: '100%', sm: 220 }}
          />
          <TextInput
            label="Buscar"
            placeholder="Código de pedido, correo o localizador"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            style={{ flex: 1, minWidth: 240 }}
          />
          <Button
            variant="subtle"
            color="gray"
            onClick={() => {
              setStatus(null)
              setSearch('')
            }}
          >
            Limpiar
          </Button>
        </Group>
      </SectionCard>

      <Group gap="md">
        <Badge size="lg" variant="light" color="gray">
          {totals.count} pedidos
        </Badge>
        <Badge size="lg" variant="light" color="teal">
          {totals.completed} completados
        </Badge>
        <Badge size="lg" variant="light" color="blue">
          {money(totals.amount)} cobrados
        </Badge>
        <Badge size="lg" variant="light" color="yellow">
          {money(totals.pending)} pendientes
        </Badge>
      </Group>

      {isLoading ? (
        <Skeleton height={420} radius="lg" />
      ) : !orders || orders.length === 0 ? (
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconCreditCard size={40} color="var(--mantine-color-gray-5)" />}
            title="Sin pedidos"
            description="Los pedidos aparecerán aquí cuando se formalicen inscripciones o regalos."
          />
        </Paper>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={900}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Pedido</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Evento</Table.Th>
                  <Table.Th>Pagador</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th ta="right">Importe</Table.Th>
                  <Table.Th>Fecha</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {orders.map((order) => (
                  <Table.Tr key={order.id}>
                    <Table.Td>
                      <Text size="sm" fw={700} ff="monospace">
                        {order.code}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {order.reference || 'Sin referencia'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        {order.kind === 'gift' ? (
                          <IconGift size={16} color="var(--mantine-color-grape-6)" />
                        ) : (
                          <IconTicket size={16} color="var(--mantine-color-teal-6)" />
                        )}
                        <Box>
                          <Text size="sm">{order.kind === 'gift' ? 'Regalo' : 'Inscripción'}</Text>
                          <Text size="xs" c="dimmed">
                            {order.giftCode ?? order.registrationLocator ?? '—'}
                          </Text>
                        </Box>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1}>
                        {order.eventName ?? '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{order.payerName || '—'}</Text>
                      <Text size="xs" c="dimmed">
                        {order.payerEmail}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={order.status} kind="order" />
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" fw={600}>
                        {money(order.amount)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {paymentMethodLabel(order.paymentMethod)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        Creado {formatDateTime(order.createdAt)}
                      </Text>
                      {order.paidAt ? (
                        <Text size="xs" c="teal.7">
                          Pagado {formatDateTime(order.paidAt)}
                        </Text>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}

      <Text size="xs" c="dimmed">
        {paymentConfig?.provider === 'stripe'
          ? 'Los pagos se procesan mediante Stripe Checkout. Los pedidos pendientes pueden retomarse desde la consulta pública.'
          : 'Los pagos se procesan mediante la pasarela de demostración. No se realizan cargos reales.'}{' '}
        Los códigos de pedido pueden verificarse desde <Code>orders</Code>.
      </Text>
    </Stack>
  )
}
