import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCalendarEvent,
  IconClock,
  IconGift,
  IconMapPin,
  IconTicket,
  IconUsers,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { EventCover } from '../../components/EventCover'
import { EmptyState } from '../../components/Page'
import { StatusBadge } from '../../components/StatusBadge'
import type { EventItem } from '../../types'
import { formatDate, formatDateTime, money } from '../../utils/format'

export function EventDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { data: event, isLoading, isError } = useQuery({
    queryKey: ['public-event', slug],
    queryFn: () => api.get<EventItem>(`/events/${slug}`),
    enabled: Boolean(slug),
  })

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Skeleton height={280} radius="lg" />
        <Grid mt="lg">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Skeleton height={320} radius="lg" />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Skeleton height={320} radius="lg" />
          </Grid.Col>
        </Grid>
      </Container>
    )
  }

  if (isError || !event) {
    return (
      <Container size="xl" py="xl">
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconAlertCircle size={40} color="var(--mantine-color-gray-5)" />}
            title="Evento no encontrado"
            description="Puede que el evento ya no esté disponible."
            action={
              <Button component={Link} to="/" variant="light">
                Volver a eventos
              </Button>
            }
          />
        </Paper>
      </Container>
    )
  }

  const open = event.registrationOpen

  return (
    <Container size="xl" py="xl">
      <Button
        component={Link}
        to="/"
        variant="subtle"
        color="gray"
        leftSection={<IconArrowLeft size={16} />}
        mb="md"
        px={0}
      >
        Todos los eventos
      </Button>

      <EventCover id={event.id} name="" height={210} radius="lg" />

      <Grid mt="lg" gutter="xl">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="lg">
            <Box>
              <Group gap="sm" mb="xs">
                <StatusBadge status={event.statusLabel ?? event.status} kind="event" size="md" />
                {event.modalityCount > 0 ? (
                  <Badge variant="light" color="gray">
                    {event.modalityCount} modalidade{event.modalityCount === 1 ? '' : 's'}
                  </Badge>
                ) : null}
              </Group>
              <Title order={1} fz={{ base: 30, sm: 40 }}>
                {event.name}
              </Title>
              <Group gap="lg" mt="sm">
                <Group gap={6}>
                  <IconCalendarEvent size={18} color="var(--mantine-color-teal-7)" />
                  <Text size="sm">{formatDate(event.startDate)}</Text>
                </Group>
                <Group gap={6}>
                  <IconMapPin size={18} color="var(--mantine-color-teal-7)" />
                  <Text size="sm">
                    {event.venue}
                    {event.city ? ` · ${event.city}` : ''}
                  </Text>
                </Group>
                {event.organizer ? (
                  <Group gap={6}>
                    <IconUsers size={18} color="var(--mantine-color-teal-7)" />
                    <Text size="sm">{event.organizer.name}</Text>
                  </Group>
                ) : null}
              </Group>
            </Box>

            <Paper withBorder radius="lg" p="lg">
              <Title order={4} mb="sm">
                Sobre el evento
              </Title>
              <Text c="gray.7" style={{ whiteSpace: 'pre-line' }}>
                {event.description || 'La organización todavía no ha publicado una descripción.'}
              </Text>
              <Divider my="md" />
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Salida
                  </Text>
                  <Text fw={600}>{formatDateTime(event.startDate)}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Fin previsto
                  </Text>
                  <Text fw={600}>{formatDateTime(event.endDate)}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Lugar
                  </Text>
                  <Text fw={600}>
                    {event.venue}
                    {event.address ? ` · ${event.address}` : ''}
                  </Text>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Localidad
                  </Text>
                  <Text fw={600}>
                    {event.city}
                    {event.province ? ` (${event.province})` : ''} · {event.country}
                  </Text>
                </Grid.Col>
              </Grid>
            </Paper>

            <Box>
              <Group justify="space-between" mb="sm">
                <Title order={3}>Modalidades</Title>
                <Button
                  component={Link}
                  to={`/eventos/${event.slug}/participantes`}
                  variant="subtle"
                  size="sm"
                  leftSection={<IconUsers size={16} />}
                >
                  Ver participantes
                </Button>
              </Group>

              {!event.modalities || event.modalities.length === 0 ? (
                <Paper withBorder radius="lg" p="lg">
                  <Text c="dimmed" size="sm">
                    Las modalidades de este evento se publicarán próximamente.
                  </Text>
                </Paper>
              ) : (
                <Stack gap="sm">
                  {event.modalities.map((modality) => (
                    <Paper key={modality.id} withBorder radius="lg" p="lg">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Box>
                          <Group gap="xs">
                            <Text fw={700} size="lg">
                              {modality.name}
                            </Text>
                            {modality.distanceKm ? (
                              <Badge variant="light" color="teal">
                                {modality.distanceKm} km
                              </Badge>
                            ) : null}
                          </Group>
                          <Text size="sm" c="dimmed" mt={4}>
                            {modality.description}
                          </Text>
                          <Group gap="md" mt="sm">
                            {modality.startTime ? (
                              <Group gap={4}>
                                <IconClock size={15} color="var(--mantine-color-gray-6)" />
                                <Text size="xs" c="dimmed">
                                  Salida {modality.startTime}
                                </Text>
                              </Group>
                            ) : null}
                            <Group gap={4}>
                              <IconUsers size={15} color="var(--mantine-color-gray-6)" />
                              <Text size="xs" c="dimmed">
                                {modality.spotsLeft !== null
                                  ? `${modality.spotsLeft} plazas disponibles`
                                  : `${modality.registrationCount} inscritos`}
                              </Text>
                            </Group>
                          </Group>
                        </Box>
                        <Stack gap={6} align="flex-end">
                          <Box ta="right">
                            <Text fw={800} size="xl" c="teal.7">
                              {money(modality.currentPrice)}
                            </Text>
                            {modality.currentTier ? (
                              <Text size="xs" c="dimmed">
                                {modality.currentTier}
                              </Text>
                            ) : null}
                          </Box>
                          <Group gap="xs">
                            <Button
                              size="sm"
                              leftSection={<IconTicket size={16} />}
                              disabled={!open || modality.spotsLeft === 0}
                              onClick={() =>
                                navigate(
                                  `/eventos/${event.slug}/inscribirse?modalidad=${modality.id}`,
                                )
                              }
                            >
                              Inscribirme
                            </Button>
                            <Button
                              size="sm"
                              variant="light"
                              color="teal"
                              leftSection={<IconGift size={16} />}
                              disabled={!open}
                              onClick={() =>
                                navigate(
                                  `/eventos/${event.slug}/inscribirse?modalidad=${modality.id}&regalo=1`,
                                )
                              }
                            >
                              Regalar
                            </Button>
                          </Group>
                        </Stack>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder radius="lg" p="lg" style={{ position: 'sticky', top: 88 }}>
            <Title order={4}>Inscripción</Title>
            <Stack gap="sm" mt="sm">
              {event.registrationDeadline ? (
                <Group gap={8} align="flex-start" wrap="nowrap">
                  <IconCalendarEvent size={18} color="var(--mantine-color-teal-7)" />
                  <Box>
                    <Text size="xs" c="dimmed">
                      Plazo de inscripción
                    </Text>
                    <Text size="sm" fw={600}>
                      {formatDateTime(event.registrationDeadline)}
                    </Text>
                  </Box>
                </Group>
              ) : null}
              {event.maxParticipants ? (
                <Group gap={8} align="flex-start" wrap="nowrap">
                  <IconUsers size={18} color="var(--mantine-color-teal-7)" />
                  <Box>
                    <Text size="xs" c="dimmed">
                      Plazas
                    </Text>
                    <Text size="sm" fw={600}>
                      {event.registrationCount} de {event.maxParticipants} ocupadas
                    </Text>
                  </Box>
                </Group>
              ) : null}
              <Group gap={8} align="flex-start" wrap="nowrap">
                <IconMapPin size={18} color="var(--mantine-color-teal-7)" />
                <Box>
                  <Text size="xs" c="dimmed">
                    Dónde
                  </Text>
                  <Text size="sm" fw={600}>
                    {event.city}, {event.province}
                  </Text>
                </Box>
              </Group>
            </Stack>

            {!open ? (
              <Alert color="yellow" mt="md" icon={<IconAlertCircle size={18} />}>
                {event.status === 'Inscripciones cerradas'
                  ? 'Las inscripciones están cerradas.'
                  : event.status === 'Pausa'
                    ? 'Las inscripciones están temporalmente en pausa.'
                    : event.status === 'Sin modalidades asignadas'
                      ? 'Aún no hay modalidades disponibles.'
                      : 'Las inscripciones todavía no están abiertas.'}
              </Alert>
            ) : (
              <Button
                fullWidth
                mt="md"
                size="md"
                leftSection={<IconTicket size={18} />}
                onClick={() => {
                  const first = event.modalities?.find((modality) => modality.spotsLeft !== 0)
                  if (first) {
                    navigate(`/eventos/${event.slug}/inscribirse?modalidad=${first.id}`)
                  }
                }}
              >
                Inscribirme ahora
              </Button>
            )}

            <Divider my="md" />
            <Text size="sm" c="dimmed" ta="center">
              ¿Ya te has inscrito?{' '}
              <Text component={Link} to="/inscripciones" c="teal.7" fw={600} span>
                Consulta tu inscripción
              </Text>
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  )
}
