import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconMapPin, IconSearch, IconShieldCheck, IconTicket } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api, toQuery } from '../../api/client'
import { EventCard } from '../../components/EventCard'
import { EmptyState } from '../../components/Page'
import type { EventItem } from '../../types'

interface EventsResponse {
  items: EventItem[]
  provinces: string[]
}

export function HomePage() {
  const [search, setSearch] = useState('')
  const [province, setProvince] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-events', search, province],
    queryFn: () =>
      api.get<EventsResponse>(`/events${toQuery({ search, province: province ?? '' })}`),
  })

  return (
    <Box>
      <Box className="hero-pattern" pb={80} pt={56}>
        <Container size="xl">
          <Stack gap="md" maw={720}>
            <Text c="teal.1" fw={700} size="sm" tt="uppercase" style={{ letterSpacing: 2 }}>
              Deporte, montaña y ciudad
            </Text>
            <Title order={1} c="white" fz={{ base: 34, sm: 48 }} lh={1.08}>
              Encuentra tu próxima meta y asegura tu dorsal.
            </Title>
            <Text c="teal.0" size="lg" maw={620}>
              Carreras, trailes, marchas y triatlones con inscripción online, gestión de
              participantes y regalos para quien más te importa.
            </Text>
            <Group gap="lg" mt="sm">
              <Group gap={6}>
                <IconTicket size={18} color="var(--mantine-color-teal-2)" />
                <Text c="white" size="sm">
                  Inscripción en minutos
                </Text>
              </Group>
              <Group gap={6}>
                <IconShieldCheck size={18} color="var(--mantine-color-teal-2)" />
                <Text c="white" size="sm">
                  Pago simulado y seguro
                </Text>
              </Group>
              <Group gap={6}>
                <IconMapPin size={18} color="var(--mantine-color-teal-2)" />
                <Text c="white" size="sm">
                  Eventos por toda España
                </Text>
              </Group>
            </Group>
          </Stack>
        </Container>
      </Box>

      <Container size="xl" mt={-44}>
        <Paper shadow="md" radius="lg" p="md" withBorder>
          <Group align="flex-end" gap="sm">
            <TextInput
              label="Buscar evento"
              placeholder="Nombre o ciudad"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              style={{ flex: 2, minWidth: 220 }}
            />
            <TextInput
              label="Provincia"
              placeholder="Todas"
              leftSection={<IconMapPin size={16} />}
              value={province ?? ''}
              onChange={(event) => setProvince(event.currentTarget.value || null)}
              style={{ flex: 1, minWidth: 180 }}
            />
            <Button
              variant="light"
              color="gray"
              onClick={() => {
                setSearch('')
                setProvince(null)
              }}
            >
              Limpiar
            </Button>
          </Group>
        </Paper>
      </Container>

      <Container size="xl" py={48}>
        <Group justify="space-between" mb="lg">
          <Box>
            <Title order={2}>Próximos eventos</Title>
            <Text c="dimmed" size="sm">
              Elige tu prueba y consulta las modalidades disponibles.
            </Text>
          </Box>
          {data ? (
            <Text size="sm" c="dimmed">
              {data.items.length} evento{data.items.length === 1 ? '' : 's'}
            </Text>
          ) : null}
        </Group>

        {isError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="No se han podido cargar los eventos"
          >
            <Group justify="space-between">
              <Text size="sm">Comprueba tu conexión e inténtalo de nuevo.</Text>
              <Button size="xs" variant="light" color="red" onClick={() => refetch()}>
                Reintentar
              </Button>
            </Group>
          </Alert>
        ) : isLoading ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <Skeleton key={item} height={360} radius="lg" />
            ))}
          </SimpleGrid>
        ) : data && data.items.length > 0 ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {data.items.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </SimpleGrid>
        ) : (
          <Paper withBorder radius="lg" p="xl">
            <EmptyState
              icon={<IconSearch size={40} color="var(--mantine-color-gray-5)" />}
              title="No hay eventos que coincidan"
              description="Prueba con otra búsqueda o elimina los filtros."
              action={
                <Button
                  variant="light"
                  onClick={() => {
                    setSearch('')
                    setProvince(null)
                  }}
                >
                  Ver todos los eventos
                </Button>
              }
            />
          </Paper>
        )}
      </Container>
    </Box>
  )
}
