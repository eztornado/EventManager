import { useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Grid,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconCheck, IconLock, IconUser } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { PageHeader, SectionCard } from '../../components/Page'
import { initials } from '../../utils/format'

export function ProfilePage() {
  const { user, refresh } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  if (!user) return null

  const saveProfile = async () => {
    if (!name.trim() || !email.trim()) {
      notifications.show({ color: 'red', message: 'Nombre y correo son obligatorios.' })
      return
    }
    setSavingProfile(true)
    try {
      await api.put('/admin/auth/profile', { name, email })
      await refresh()
      notifications.show({ color: 'teal', message: 'Perfil actualizado.' })
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido guardar el perfil.',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async () => {
    if (newPassword.length < 8) {
      notifications.show({ color: 'red', message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
      return
    }
    if (newPassword !== repeatPassword) {
      notifications.show({ color: 'red', message: 'Las contraseñas nuevas no coinciden.' })
      return
    }
    setSavingPassword(true)
    try {
      await api.put('/admin/auth/password', { currentPassword, newPassword })
      notifications.show({ color: 'teal', message: 'Contraseña actualizada.' })
      setCurrentPassword('')
      setNewPassword('')
      setRepeatPassword('')
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'No se ha podido cambiar la contraseña.',
      })
    } finally {
      setSavingPassword(false)
    }
  }

  const roleLabel =
    user.role === 'organizer'
      ? 'Organizador'
      : user.role === 'superadmin'
        ? 'Superadministrador'
        : 'Administrador'

  return (
    <Stack gap="lg">
      <PageHeader title="Mi perfil" subtitle="Datos de tu cuenta y seguridad de acceso." />

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="lg">
            <SectionCard title="Datos personales" description="Se usan para identificar tu actividad.">
              <Stack gap="sm">
                <TextInput
                  label="Nombre completo"
                  leftSection={<IconUser size={16} />}
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                />
                <TextInput
                  label="Correo electrónico"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                />
                <Group justify="flex-end">
                  <Button onClick={saveProfile} loading={savingProfile} leftSection={<IconCheck size={16} />}>
                    Guardar perfil
                  </Button>
                </Group>
              </Stack>
            </SectionCard>

            <SectionCard
              title="Cambiar contraseña"
              description="Usa al menos 8 caracteres y evita contraseñas reutilizadas."
            >
              <Stack gap="sm">
                <PasswordInput
                  label="Contraseña actual"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.currentTarget.value)}
                  leftSection={<IconLock size={16} />}
                />
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <PasswordInput
                      label="Nueva contraseña"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.currentTarget.value)}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <PasswordInput
                      label="Repite la nueva contraseña"
                      value={repeatPassword}
                      onChange={(event) => setRepeatPassword(event.currentTarget.value)}
                    />
                  </Grid.Col>
                </Grid>
                <Group justify="flex-end">
                  <Button
                    variant="light"
                    onClick={savePassword}
                    loading={savingPassword}
                    disabled={!currentPassword || !newPassword}
                  >
                    Cambiar contraseña
                  </Button>
                </Group>
              </Stack>
            </SectionCard>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Paper withBorder radius="lg" p="lg">
            <Stack align="center" gap="xs">
              <Avatar color="teal" radius="xl" size={72}>
                {initials(user.name)}
              </Avatar>
              <Title order={4}>{user.name}</Title>
              <Text size="sm" c="dimmed">
                {user.email}
              </Text>
              <Badge variant="light" color={user.role === 'superadmin' ? 'grape' : 'teal'} size="lg">
                {roleLabel}
              </Badge>
              {user.organizerName ? (
                <Text size="sm" c="dimmed" ta="center">
                  {user.organizerName}
                </Text>
              ) : null}
            </Stack>
            <Alert color="blue" mt="lg" icon={<IconAlertCircle size={18} />}>
              Los cambios de correo afectan al inicio de sesión. La sesión actual sigue activa.
            </Alert>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
