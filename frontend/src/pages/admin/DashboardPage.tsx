import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconCoin,
  IconGift,
  IconPercentage,
  IconTicket,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react'
import { BarChart, DonutChart, LineChart } from '@mantine/charts'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { PageHeader, SectionCard } from '../../components/Page'
import { StatusBadge } from '../../components/StatusBadge'
import type { DashboardData } from '../../types'
import { formatDate, formatShortDate, money } from '../../utils/format'

const chartColors = ['teal.6', 'blue.5', 'grape.5', 'orange.5', 'pink.4', 'cyan.5', 'lime.5']

export function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', user?.organizerId ?? 'all'],
    queryFn: () => api.get<DashboardData>('/admin/dashboard'),
  })

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Skeleton height={60} radius="lg" />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} height={120} radius="lg" />
          ))}
        </SimpleGrid>
        <Skeleton height={320} radius="lg" />
      </Stack>
    )
  }

  if (isError || !data) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />} title="No se ha podido cargar el panel">
        <Group justify="space-between">
          <Text size="sm">Comprueba la conexión con el servidor e inténtalo de nuevo.</Text>
          <Button size="xs" variant="light" color="red" onClick={() => refetch()}>
            Reintentar
          </Button>
        </Group>
      </Alert>
    )
  }

  const totals = data.totals
  const paidShare = totals.registrations > 0 ? (totals.paid / totals.registrations) * 100 : 0

  return (
    <Stack gap="lg">
      <PageHeader
        title={`Hola, ${user?.name?.split(' ')[0] ?? ''}`}
        subtitle="Resumen de actividad de tus eventos e inscripciones."
        actions={
          <Button component={Link} to="/admin/eventos" variant="light" leftSection={<IconCalendarEvent size={16} />}>
            Gestionar eventos
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
        <StatCard
          label="Inscripciones activas"
          value={String(totals.registrations)}
          hint={`${totals.paid} pagadas · ${totals.pending} pendientes`}
          icon={<IconTicket size={22} />}
          color="teal"
        />
        <StatCard
          label="Ingresos cobrados"
          value={money(totals.revenue)}
          hint={`${money(totals.pendingAmount)} pendientes de cobro`}
          icon={<IconCoin size={22} />}
          color="blue"
        />
        <StatCard
          label="Eventos"
          value={String(totals.events)}
          hint={`${totals.activeEvents} con inscripciones abiertas`}
          icon={<IconCalendarEvent size={22} />}
          color="grape"
        />
        <StatCard
          label="Regalos"
          value={String(totals.gifts)}
          hint={`${totals.availableGifts} por canjear · ${totals.claimedGifts} canjeados`}
          icon={<IconGift size={22} />}
          color="orange"
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 3 }}>
        <SectionCard title="Estado de las inscripciones" description="Inscripciones no canceladas">
          <Stack gap="sm">
            {data.byStatus.map((item) => (
              <Box key={item.name}>
                <Group justify="space-between" mb={4}>
                  <Text size="sm">{item.name}</Text>
                  <Text size="sm" fw={700}>
                    {item.count}
                  </Text>
                </Group>
                <Progress
                  value={totals.registrations > 0 ? (item.count / totals.registrations) * 100 : 0}
                  color={item.name === 'Pagada' ? 'teal' : item.name === 'Pendiente de pago' ? 'yellow' : 'red'}
                  size="sm"
                />
              </Box>
            ))}
            <Text size="xs" c="dimmed" mt="xs">
              {Math.round(paidShare)}% de las inscripciones están pagadas.
            </Text>
          </Stack>
        </SectionCard>

        <SectionCard title="Distribución por género" description="Participantes activos">
          {data.byGender.length === 0 ? (
            <Text size="sm" c="dimmed">
              Todavía no hay datos.
            </Text>
          ) : (
            <DonutChart
              h={220}
              data={data.byGender.map((item, index) => ({
                name: item.name,
                value: item.count,
                color: chartColors[index % chartColors.length],
              }))}
              chartLabel={`${totals.registrations} inscritos`}
            />
          )}
        </SectionCard>

        <SectionCard title="Inscripciones por modalidad" description="Top modalidades activas">
          {data.byModality.length === 0 ? (
            <Text size="sm" c="dimmed">
              Todavía no hay datos.
            </Text>
          ) : (
            <BarChart
              h={220}
              data={data.byModality.slice(0, 6)}
              dataKey="name"
              series={[{ name: 'count', color: 'teal.6' }]}
              barProps={{ radius: 6 }}
              gridAxis="y"
            />
          )}
        </SectionCard>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 3 }}>
        <SectionCard
          title="Altas en los últimos 30 días"
          description="Inscripciones registradas por día"
          style={{ gridColumn: 'span 2' }}
        >
          <LineChart
            h={260}
            data={data.overTime.map((item) => ({ ...item, label: formatShortDate(item.date) }))}
            dataKey="label"
            series={[{ name: 'count', color: 'teal.6', label: 'Inscripciones' }]}
            curveType="natural"
            withDots={false}
            gridAxis="y"
          />
        </SectionCard>

        <SectionCard title="Comunidad" description="Clubes, cupones y organizadores">
          <Stack gap="md">
            <MiniStat icon={<IconTrophy size={18} />} label="Clubes" value={String(totals.clubs)} />
            <MiniStat
              icon={<IconPercentage size={18} />}
              label="Cupones"
              value={`${totals.coupons}`}
              hint={`${totals.couponUses} usos acumulados`}
            />
            <MiniStat icon={<IconUsers size={18} />} label="Organizadores" value={String(totals.organizers)} />
            <MiniStat
              icon={<IconGift size={18} />}
              label="Regalos pendientes"
              value={String(totals.pendingGifts)}
              hint="Pagos por confirmar"
            />
          </Stack>
        </SectionCard>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <SectionCard
          title="Últimas inscripciones"
          description="Las 8 más recientes"
          actions={
            <Button component={Link} to="/admin/inscripciones" variant="subtle" size="compact-sm">
              Ver todas
            </Button>
          }
        >
          {data.recentRegistrations.length === 0 ? (
            <Text size="sm" c="dimmed">
              Todavía no hay inscripciones.
            </Text>
          ) : (
            <Table highlightOnHover verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Participante</Table.Th>
                  <Table.Th>Evento</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th ta="right">Importe</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.recentRegistrations.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {item.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {item.locator} · {item.email}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1}>
                        {item.eventName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {item.modalityName}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={item.status} />
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" fw={600}>
                        {money(item.total)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatDate(item.createdAt)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </SectionCard>

        <SectionCard title="Eventos" description="Ocupación y recaudación por evento">
          {data.events.length === 0 ? (
            <Text size="sm" c="dimmed">
              Todavía no hay eventos.
            </Text>
          ) : (
            <Stack gap="sm">
              {data.events.map((event) => {
                const filled = event.maxParticipants
                  ? Math.min(100, (event.registrationCount / event.maxParticipants) * 100)
                  : 0
                return (
                  <Box key={event.id}>
                    <Group justify="space-between" gap="xs" wrap="nowrap">
                      <Box style={{ minWidth: 0 }}>
                        <Text
                          component={Link}
                          to={`/admin/eventos/${event.id}`}
                          size="sm"
                          fw={600}
                          lineClamp={1}
                        >
                          {event.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatDate(event.startDate)} · {event.modalityCount} modalidades
                        </Text>
                      </Box>
                      <Badge variant="light" color="teal" radius="sm">
                        {money(event.revenue)}
                      </Badge>
                    </Group>
                    <Group justify="space-between" mt={6}>
                      <Progress
                        value={filled}
                        size="xs"
                        radius="xl"
                        color="teal"
                        style={{ flex: 1 }}
                      />
                      <Text size="xs" c="dimmed" ml="xs">
                        {event.registrationCount}
                        {event.maxParticipants ? ` / ${event.maxParticipants}` : ''}
                      </Text>
                    </Group>
                  </Box>
                )
              })}
            </Stack>
          )}
        </SectionCard>
      </SimpleGrid>
    </Stack>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon,
  color,
}: {
  label: string
  value: string
  hint: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <Paper withBorder radius="lg" p="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            {label}
          </Text>
          <Title order={2} mt={4}>
            {value}
          </Title>
          <Text size="xs" c="dimmed" mt={4}>
            {hint}
          </Text>
        </Box>
        <ThemeIcon size={44} radius="md" variant="light" color={color}>
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  )
}

function MiniStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon variant="light" color="teal" radius="md" size="md">
          {icon}
        </ThemeIcon>
        <Box>
          <Text size="sm">{label}</Text>
          {hint ? (
            <Text size="xs" c="dimmed">
              {hint}
            </Text>
          ) : null}
        </Box>
      </Group>
      <Text fw={700}>{value}</Text>
    </Group>
  )
}
