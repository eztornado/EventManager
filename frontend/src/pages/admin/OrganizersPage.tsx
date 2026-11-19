import { useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconEdit,
  IconKey,
  IconPlus,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { EmptyState, PageHeader } from '../../components/Page'
import type { Organizer, OrganizerAccount } from '../../types'
import { formatDate } from '../../utils/format'

const emptyOrganizer = {
  name: '',
  slug: '',
  contactEmail: '',
  phone: '',
  description: '',
  logoUrl: '',
  active: true,
}

const emptyAccount = {
  name: '',
  email: '',
  password: '',
  active: true,
}

export function OrganizersPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Organizer | null>(null)
  const [form, setForm] = useState(emptyOrganizer)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Organizer | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [accountsFor, setAccountsFor] = useState<Organizer | null>(null)
  const [accountForm, setAccountForm] = useState(emptyAccount)
  const [editingAccount, setEditingAccount] = useState<OrganizerAccount | null>(null)
  const [savingAccount, setSavingAccount] = useState(false)
  const [accountDelete, setAccountDelete] = useState<OrganizerAccount | null>(null)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const { data: organizers, isLoading } = useQuery({
    queryKey: ['admin-organizers'],
    queryFn: () => api.get<Organizer[]>('/admin/organizers'),
  })

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['organizer-accounts', accountsFor?.id],
    queryFn: () => api.get<OrganizerAccount[]>(`/admin/organizers/${accountsFor?.id}/accounts`),
    enabled: Boolean(accountsFor?.id),
  })

  const openNew = () => {
    setEditing(null)
    setForm(emptyOrganizer)
    setModalOpen(true)
  }

  const openEdit = (organizer: Organizer) => {
    setEditing(organizer)
    setForm({
      name: organizer.name,
      slug: organizer.slug,
      contactEmail: organizer.contactEmail,
      phone: organizer.phone,
      description: organizer.description,
      logoUrl: organizer.logoUrl,
      active: Boolean(organizer.active),
    })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      notifications.show({ color: 'red', message: 'El nombre del organizador es obligatorio.' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.put(`/admin/organizers/${editing.id}`, form)
        notifications.show({ color: 'teal', message: 'Organizador actualizado.' })
      } else {
        await api.post('/admin/organizers', form)
        notifications.show({ color: 'teal', message: 'Organizador creado.' })
      }
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['admin-organizers'] })
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
      await api.delete(`/admin/organizers/${deleteTarget.id}`)
      notifications.show({ color: 'teal', message: 'Organizador eliminado.' })
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['admin-organizers'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido eliminar.',
      })
    } finally {
      setDeleting(false)
    }
  }

  const saveAccount = async () => {
    if (!accountsFor) return
    if (!accountForm.name.trim() || !accountForm.email.trim()) {
      notifications.show({ color: 'red', message: 'Nombre y correo son obligatorios.' })
      return
    }
    if (!editingAccount && accountForm.password.length < 8) {
      notifications.show({ color: 'red', message: 'La contraseña debe tener al menos 8 caracteres.' })
      return
    }
    setSavingAccount(true)
    try {
      if (editingAccount) {
        await api.put(`/admin/accounts/${editingAccount.id}`, {
          name: accountForm.name,
          email: accountForm.email,
          password: accountForm.password,
          active: accountForm.active,
        })
        notifications.show({ color: 'teal', message: 'Cuenta actualizada.' })
      } else {
        await api.post(`/admin/organizers/${accountsFor.id}/accounts`, accountForm)
        notifications.show({ color: 'teal', message: 'Cuenta creada.' })
      }
      setAccountForm(emptyAccount)
      setEditingAccount(null)
      queryClient.invalidateQueries({ queryKey: ['organizer-accounts', accountsFor.id] })
      queryClient.invalidateQueries({ queryKey: ['admin-organizers'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido guardar la cuenta.',
      })
    } finally {
      setSavingAccount(false)
    }
  }

  const removeAccount = async () => {
    if (!accountDelete) return
    setDeletingAccount(true)
    try {
      await api.delete(`/admin/accounts/${accountDelete.id}`)
      notifications.show({ color: 'teal', message: 'Cuenta eliminada.' })
      setAccountDelete(null)
      if (accountsFor) {
        queryClient.invalidateQueries({ queryKey: ['organizer-accounts', accountsFor.id] })
      }
      queryClient.invalidateQueries({ queryKey: ['admin-organizers'] })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido eliminar la cuenta.',
      })
    } finally {
      setDeletingAccount(false)
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="Organizadores"
        subtitle="Entidades que publican eventos y sus cuentas de acceso."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={openNew}>
            Nuevo organizador
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton height={400} radius="lg" />
      ) : !organizers || organizers.length === 0 ? (
        <Paper withBorder radius="lg" p="xl">
          <EmptyState
            icon={<IconUsers size={40} color="var(--mantine-color-gray-5)" />}
            title="Todavía no hay organizadores"
            description="Crea una organización y añade cuentas para que su equipo gestione eventos."
            action={<Button onClick={openNew}>Crear organizador</Button>}
          />
        </Paper>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Organizador</Table.Th>
                <Table.Th>Contacto</Table.Th>
                <Table.Th>Eventos</Table.Th>
                <Table.Th>Cuentas</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th ta="right">Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {organizers.map((organizer) => (
                <Table.Tr key={organizer.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {organizer.name}
                    </Text>
                    <Text size="xs" c="dimmed" ff="monospace">
                      {organizer.slug}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Alta {formatDate(organizer.createdAt)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{organizer.contactEmail || '—'}</Text>
                    <Text size="xs" c="dimmed">
                      {organizer.phone || '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="teal">
                      {organizer.eventCount ?? 0}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="blue">
                      {organizer.accountCount ?? 0}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={organizer.active ? 'teal' : 'gray'}>
                      {organizer.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap={2} justify="flex-end" wrap="nowrap">
                      <Tooltip label="Cuentas de acceso">
                        <ActionIcon
                          variant="subtle"
                          color="grape"
                          onClick={() => {
                            setAccountsFor(organizer)
                            setAccountForm(emptyAccount)
                            setEditingAccount(null)
                          }}
                        >
                          <IconKey size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Editar">
                        <ActionIcon
                          variant="subtle"
                          color="teal"
                          onClick={() => openEdit(organizer)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Eliminar">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleteTarget(organizer)}
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
        title={editing ? 'Editar organizador' : 'Nuevo organizador'}
        size="lg"
      >
        <Stack gap="sm">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 8 }}>
              <TextInput
                label="Nombre"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput
                label="Identificador"
                placeholder="Se genera del nombre"
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Correo de contacto"
                type="email"
                value={form.contactEmail}
                onChange={(event) =>
                  setForm({ ...form, contactEmail: event.currentTarget.value })
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Teléfono"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Textarea
                label="Descripción"
                minRows={2}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.currentTarget.value })
                }
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <TextInput
                label="Logotipo (URL)"
                value={form.logoUrl}
                onChange={(event) => setForm({ ...form, logoUrl: event.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Switch
                label="Organizador activo"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.currentTarget.checked })}
              />
            </Grid.Col>
          </Grid>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Guardar organizador
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(accountsFor)}
        onClose={() => setAccountsFor(null)}
        title={`Cuentas · ${accountsFor?.name ?? ''}`}
        size="lg"
      >
        <Stack gap="md">
          <Alert color="blue" icon={<IconAlertCircle size={18} />}>
            Las cuentas de organizador acceden al backoffice y solo ven los eventos de esta
            organización.
          </Alert>

          {accountsLoading ? (
            <Skeleton height={120} radius="md" />
          ) : !accounts || accounts.length === 0 ? (
            <Text size="sm" c="dimmed">
              Esta organización todavía no tiene cuentas de acceso.
            </Text>
          ) : (
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Cuenta</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th ta="right">Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {accounts.map((account) => (
                  <Table.Tr key={account.id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {account.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {account.email}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={account.active ? 'teal' : 'gray'}>
                        {account.active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Group gap={2} justify="flex-end" wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          color="teal"
                          size="sm"
                          onClick={() => {
                            setEditingAccount(account)
                            setAccountForm({
                              name: account.name,
                              email: account.email,
                              password: '',
                              active: Boolean(account.active),
                            })
                          }}
                        >
                          <IconEdit size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => setAccountDelete(account)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          <Divider label={editingAccount ? 'Editar cuenta' : 'Nueva cuenta'} labelPosition="left" />

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Nombre"
                value={accountForm.name}
                onChange={(event) =>
                  setAccountForm({ ...accountForm, name: event.currentTarget.value })
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Correo"
                type="email"
                value={accountForm.email}
                onChange={(event) =>
                  setAccountForm({ ...accountForm, email: event.currentTarget.value })
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label={editingAccount ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                type="password"
                value={accountForm.password}
                onChange={(event) =>
                  setAccountForm({ ...accountForm, password: event.currentTarget.value })
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Switch
                label="Cuenta activa"
                checked={accountForm.active}
                onChange={(event) =>
                  setAccountForm({ ...accountForm, active: event.currentTarget.checked })
                }
                mt={26}
              />
            </Grid.Col>
          </Grid>

          <Group justify="space-between">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                setEditingAccount(null)
                setAccountForm(emptyAccount)
              }}
            >
              Limpiar formulario
            </Button>
            <Button onClick={saveAccount} loading={savingAccount}>
              {editingAccount ? 'Guardar cuenta' : 'Crear cuenta'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar organizador"
      >
        <Text size="sm">
          ¿Seguro que quieres eliminar «{deleteTarget?.name}»? Sus cuentas y eventos quedarán sin
          organización. Esta acción no se puede deshacer.
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

      <Modal
        opened={Boolean(accountDelete)}
        onClose={() => setAccountDelete(null)}
        title="Eliminar cuenta"
      >
        <Text size="sm">
          ¿Seguro que quieres eliminar la cuenta de {accountDelete?.name}? La persona perderá el
          acceso al backoffice.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="subtle" color="gray" onClick={() => setAccountDelete(null)}>
            Cancelar
          </Button>
          <Button color="red" onClick={removeAccount} loading={deletingAccount}>
            Eliminar
          </Button>
        </Group>
      </Modal>
    </Stack>
  )
}
