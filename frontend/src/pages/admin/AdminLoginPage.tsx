import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconFlag, IconLock } from '@tabler/icons-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export function AdminLoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to="/admin" replace />
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/admin', { replace: true })
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se ha podido iniciar sesión.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(135deg, #134e4a 0%, #0f766e 55%, #0d9488 100%)',
        padding: 24,
      }}
    >
      <Container size={440} w="100%">
        <Paper radius="lg" p="xl" shadow="xl">
          <Stack gap="md">
            <Box ta="center">
              <Box
                mx="auto"
                mb="sm"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
                  boxShadow: '0 8px 20px rgba(13, 148, 136, 0.3)',
                }}
              >
                <IconFlag size={28} color="white" />
              </Box>
              <Title order={2}>Acceso organización</Title>
              <Text size="sm" c="dimmed">
                Gestiona eventos, inscripciones y regalos.
              </Text>
            </Box>

            <form onSubmit={submit}>
              <Stack gap="sm">
                <TextInput
                  label="Correo electrónico"
                  placeholder="tu@evento.com"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                />
                <PasswordInput
                  label="Contraseña"
                  placeholder="Tu contraseña"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  leftSection={<IconLock size={16} />}
                />
                {error ? (
                  <Alert color="red" icon={<IconAlertCircle size={18} />}>
                    {error}
                  </Alert>
                ) : null}
                <Button type="submit" fullWidth size="md" loading={loading}>
                  Entrar
                </Button>
              </Stack>
            </form>

            <Text size="xs" c="dimmed" ta="center">
              ¿Eres participante? Vuelve a la{' '}
              <Text component="a" href="/" c="teal.7" fw={600} span>
                tienda de eventos
              </Text>
              .
            </Text>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
