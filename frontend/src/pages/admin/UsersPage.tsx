import { useState } from 'react'
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
import { IconEdit, IconPlus, IconShield, IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, PageHeader } from '../../components/Page'
import type { AdminUser } from '../../types'
import { formatDate } from '../../utils/format'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'admin',
  active: true,
}

export function UsersPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<AdminUser[]>('/admin/users'),
  })

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (target: AdminUser) => {
    setEditing(target)
    setForm({
      name: target.name,
      email: target.email,
      password: '',
      role: target.role,
      active: Boolean(target.active),
    })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      notifications.show({ color: 'red', message: 'Nombre y correo son obligatorios.' })
      return
    }
    if (!editing && form.password.length < 8) {
      notifications.show({ color: 'red', message: 'La contraseña debe tener al menos 8 caracteres.' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/admin/users/${editing.id}`, form)
        notifications.show({ color: 'teal', message: 'Administrador actualizado.' })
      } else {
        await api.post('/admin/users', form)
        notifications.show({ color: 'teal', message: 'Administrador creado.' })
      }
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido guardar.',
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`)
      notifications.show({ color: 'teal', message: 'Administrador eliminado.' })
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido eliminar.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="Administradores"
        subtitle="Cuentas con acceso completo o parcial al backoffice."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={openNew}>
            Nuevo administrador
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton height={360} radius="lg" />
      ) : !users || users.length === 0 ? (
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconShield size={40} color="var(--mantine-color-gray-5)" />}
            title="Sin administradores"
            description="Crea una cuenta para gestionar la plataforma."
            action={<Button onClick={openNew}>Crear administrador</Button>}
          />
        </Paper>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Administrador</Table.Th>
                <Table.Th>Rol</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Creado</Table.Th>
                <Table.Th ta="right">Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((target) => (
                <Table.Tr key={target.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {target.name}
                      {target.id === user?.id ? (
                        <Text span size="xs" c="dimmed">
                          {' '}
                          (tú)
                        </Text>
                      ) : null}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {target.email}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      variant="light"
                      color={target.role === 'superadmin' ? 'grape' : 'blue'}
                    >
                      {target.role === 'superadmin' ? 'Superadministrador' : 'Administrador'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={target.active ? 'teal' : 'gray'}>
                      {target.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {formatDate(target.createdAt)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap={2} justify="flex-end" wrap="nowrap">
                      <Tooltip label="Editar">
                        <ActionIcon
                          variant="subtle"
                          color="teal"
                          onClick={() => openEdit(target)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={target.id === user?.id ? 'No puedes eliminarte' : 'Eliminar'}>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          disabled={target.id === user?.id}
                          onClick={() => setDeleteTarget(target)}
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
        title={editing ? 'Editar administrador' : 'Nuevo administrador'}
      >
        <Stack gap="sm">
          <TextInput
            label="Nombre"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
          />
          <TextInput
            label="Correo"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.currentTarget.value })}
          />
          <TextInput
            label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.currentTarget.value })}
          />
          <Switch
            label="Rol de superadministrador"
            description="Los superadministradores pueden gestionar organizadores y otras cuentas."
            checked={form.role === 'superadmin'}
            onChange={(event) =>
              setForm({ ...form, role: event.currentTarget.checked ? 'superadmin' : 'admin' })
            }
          />
          <Switch
            label="Cuenta activa"
            checked={form.active}
            onChange={(event) => setForm({ ...form, active: event.currentTarget.checked })}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Guardar administrador
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar administrador"
      >
        <Text size="sm">
          ¿Seguro que quieres eliminar la cuenta de {deleteTarget?.name}? Esta acción no se puede
          deshacer.
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
