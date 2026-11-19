import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconEye, IconMail, IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { EmptyState, PageHeader, SectionCard } from '../../components/Page'
import type { OutboxEmail } from '../../types'
import { formatDateTime } from '../../utils/format'

export function EmailsPage() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<OutboxEmail | null>(null)

  const { data: emails, isLoading } = useQuery({
    queryKey: ['admin-emails'],
    queryFn: () => api.get<OutboxEmail[]>('/admin/emails'),
  })

  const filtered = useMemo(() => {
    if (!emails) return []
    const needle = search.trim().toLowerCase()
    if (!needle) return emails
    return emails.filter(
      (email) =>
        email.toEmail.toLowerCase().includes(needle) ||
        email.subject.toLowerCase().includes(needle),
    )
  }, [emails, search])

  return (
    <Stack gap="lg">
      <PageHeader
        title="Correos"
        subtitle="Bandeja de salida simulada. No se envía correo real; los mensajes quedan registrados aquí."
      />

      <SectionCard>
        <TextInput
          label="Buscar"
          placeholder="Destinatario o asunto"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          maw={420}
        />
      </SectionCard>

      {isLoading ? (
        <Skeleton height={400} radius="lg" />
      ) : filtered.length === 0 ? (
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconMail size={40} color="var(--mantine-color-gray-5)" />}
            title="Sin correos"
            description="Los correos de confirmación, recuperación y regalos se guardarán en esta bandeja."
          />
        </Paper>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={720}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Destinatario</Table.Th>
                  <Table.Th>Asunto</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th ta="right">Ver</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((email) => (
                  <Table.Tr key={email.id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {email.toEmail}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1}>
                        {email.subject}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={email.status === 'sent' ? 'teal' : 'gray'}>
                        {email.status || 'registrado'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {formatDateTime(email.createdAt)}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Tooltip label="Leer mensaje">
                        <ActionIcon variant="subtle" color="teal" onClick={() => setSelected(email)}>
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}

      <Modal
        opened={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.subject ?? 'Correo'}
        size="lg"
      >
        {selected ? (
          <Stack gap="md">
            <Box>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Para
              </Text>
              <Text size="sm">{selected.toEmail}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Fecha
              </Text>
              <Text size="sm">{formatDateTime(selected.createdAt)}</Text>
            </Box>
            <Paper withBorder radius="md" p="md" bg="gray.0">
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {selected.body}
              </Text>
            </Paper>
            <Group justify="flex-end">
              <Button variant="light" onClick={() => setSelected(null)}>
                Cerrar
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  )
}
