import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconEdit, IconPlus, IconSearch, IconTrash, IconTrophy } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { EmptyState, PageHeader, SectionCard } from '../../components/Page'
import type { Club } from '../../types'
import { formatDate } from '../../utils/format'

export function ClubsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Club | null>(null)
  const [form, setForm] = useState({ name: '', province: '', active: true })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Club | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: clubs, isLoading } = useQuery({
    queryKey: ['admin-clubs'],
    queryFn: () => api.get<Club[]>('/admin/clubs'),
  })

  const filtered = useMemo(() => {
    if (!clubs) return []
    const needle = search.trim().toLowerCase()
    if (!needle) return clubs
    return clubs.filter(
      (club) =>
        club.name.toLowerCase().includes(needle) ||
        club.province.toLowerCase().includes(needle),
    )
  }, [clubs, search])

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', province: '', active: true })
    setModalOpen(true)
  }

  const openEdit = (club: Club) => {
    setEditing(club)
    setForm({ name: club.name, province: club.province, active: Boolean(club.active) })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      notifications.show({ color: 'red', message: 'El nombre del club es obligatorio.' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/admin/clubs/${editing.id}`, form)
        notifications.show({ color: 'teal', message: 'Club actualizado.' })
      } else {
        await api.post('/admin/clubs', form)
        notifications.show({ color: 'teal', message: 'Club creado.' })
      }
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['admin-clubs'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido guardar el club.',
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/admin/clubs/${deleteTarget.id}`)
      notifications.show({ color: 'teal', message: 'Club eliminado.' })
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['admin-clubs'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido eliminar el club.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="Clubes"
        subtitle="Entidades deportivas disponibles al inscribirse."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={openNew}>
            Nuevo club
          </Button>
        }
      />

      <SectionCard>
        <TextInput
          label="Buscar"
          placeholder="Nombre o provincia"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          maw={400}
        />
      </SectionCard>

      {isLoading ? (
        <Skeleton height={360} radius="lg" />
      ) : filtered.length === 0 ? (
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconTrophy size={40} color="var(--mantine-color-gray-5)" />}
            title={clubs?.length ? 'Sin resultados' : 'Todavía no hay clubes'}
            description={
              clubs?.length
                ? 'Prueba con otra búsqueda.'
                : 'Añade clubes para que los participantes puedan indicar su entidad.'
            }
            action={<Button onClick={openNew}>Crear club</Button>}
          />
        </Paper>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Club</Table.Th>
                <Table.Th>Provincia</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Creado</Table.Th>
                <Table.Th ta="right">Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((club) => (
                <Table.Tr key={club.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {club.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {club.province || '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={club.active ? 'teal' : 'gray'}>
                      {club.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {formatDate(club.createdAt)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap={2} justify="flex-end" wrap="nowrap">
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" color="teal" onClick={() => openEdit(club)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Eliminar">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleteTarget(club)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar club' : 'Nuevo club'}
      >
        <Stack gap="sm">
          <TextInput
            label="Nombre"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
          />
          <TextInput
            label="Provincia"
            value={form.province}
            onChange={(event) => setForm({ ...form, province: event.currentTarget.value })}
          />
          <Switch
            label="Club activo"
            checked={form.active}
            onChange={(event) => setForm({ ...form, active: event.currentTarget.checked })}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Guardar club
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar club"
      >
        <Text size="sm">
          ¿Seguro que quieres eliminar «{deleteTarget?.name}»? No es posible eliminar clubes con
          inscripciones asociadas.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="subtle" color="gray" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button color="red" onClick={remove} loading={deleting}>
            Eliminar
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}
