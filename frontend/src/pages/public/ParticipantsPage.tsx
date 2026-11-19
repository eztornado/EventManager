import { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconSearch,
  IconUsers,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { EmptyState } from '../../components/Page'

interface Participant {
  firstName: string
  lastName: string
  clubName: string
  modality: string
}

interface ParticipantsResponse {
  event: { id: number; name: string; slug: string }
  items: Participant[]
}

export function ParticipantsPage() {
  const { slug } = useParams()
  const [search, setSearch] = useState('')
  const [modality, setModality] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['participants', slug],
    queryFn: () => api.get<ParticipantsResponse>(`/events/${slug}/participants`),
    enabled: Boolean(slug),
  })

  const modalities = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.items.map((item) => item.modality))).sort()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    const needle = search.trim().toLowerCase()
    return data.items.filter((item) => {
      if (modality && item.modality !== modality) return false
      if (!needle) return true
      return (
        `${item.firstName} ${item.lastName}`.toLowerCase().includes(needle) ||
        item.clubName.toLowerCase().includes(needle) ||
        item.modality.toLowerCase().includes(needle)
      )
    })
  }, [data, modality, search])

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Skeleton height={120} radius="lg" />
        <Skeleton height={420} radius="lg" mt="lg" />
      </Container>
    )
  }

  if (isError || !data) {
    return (
      <Container size="xl" py="xl">
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconAlertCircle size={40} color="var(--mantine-color-gray-5)" />}
            title="Asistentes no disponibles"
            description="No hemos podido cargar la lista de asistentes de este evento."
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

  return (
    <Container size="xl" py="xl">
      <Button
        component={Link}
        to={`/eventos/${data.event.slug}`}
        variant="subtle"
        color="gray"
        leftSection={<IconArrowLeft size={16} />}
        px={0}
        mb="md"
      >
        Volver al evento
      </Button>

      <Paper withBorder radius="lg" p="lg">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box>
            <Group gap="xs">
              <IconUsers size={22} color="var(--mantine-color-teal-7)" />
              <Title order={2}>Asistentes</Title>
            </Group>
            <Text c="dimmed" size="sm" mt={4}>
              {data.event.name}
            </Text>
          </Box>
          <Badge size="lg" variant="light" color="teal">
            {data.items.length} asistentes
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} mt="lg">
          <TextInput
            label="Buscar asistente"
            placeholder="Nombre, club o modalidad"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Select
            label="Modalidad"
            placeholder="Todas"
            data={modalities.map((item) => ({ value: item, label: item }))}
            value={modality}
            onChange={setModality}
            clearable
          />
        </SimpleGrid>
      </Paper>

      {data.items.length === 0 ? (
        <Paper withBorder radius="lg" p="xl" mt="lg">
          <EmptyState
            icon={<IconUsers size={40} color="var(--mantine-color-gray-5)" />}
            title="Todavía no hay asistentes"
            description="Sé la primera persona en inscribirte en este evento."
            action={
              <Button component={Link} to={`/eventos/${data.event.slug}`} variant="light">
                Ver modalidades
              </Button>
            }
          />
        </Paper>
      ) : (
        <>
          {filtered.length === 0 ? (
            <Alert color="yellow" mt="lg" icon={<IconAlertCircle size={18} />}>
              No hay asistentes que coincidan con los filtros.
            </Alert>
          ) : (
            <Paper withBorder radius="lg" mt="lg" style={{ overflow: 'hidden' }}>
              <Table striped highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={70}>#</Table.Th>
                    <Table.Th>Asistente</Table.Th>
                    <Table.Th>Club</Table.Th>
                    <Table.Th>Modalidad</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filtered.map((participant, index) => (
                    <Table.Tr key={`${participant.firstName}-${participant.lastName}-${index}`}>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {index + 1}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {participant.firstName} {participant.lastName}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {participant.clubName || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="gray" radius="sm">
                          {participant.modality}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          <Stack align="center" mt="lg">
            <Text size="xs" c="dimmed" ta="center">
              Solo se muestran los asistentes con inscripción activa. Los datos personales se
              limitan al nombre, club y modalidad.
            </Text>
          </Stack>
        </>
      )}
    </Container>
  )
}
