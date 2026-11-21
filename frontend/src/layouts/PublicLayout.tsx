import { AppShell, Box, Button, Container, Group, Text, UnstyledButton } from '@mantine/core'
import { IconFlag, IconTicket } from '@tabler/icons-react'
import { Link, Outlet, useLocation } from 'react-router-dom'

const links = [
  { label: 'Eventos', to: '/' },
  { label: 'Consultar inscripción', to: '/inscripciones' },
  { label: 'Canjear regalo', to: '/regalos' },
]

export function PublicLayout() {
  const location = useLocation()

  return (
    <AppShell header={{ height: 68 }} padding={0}>
      <AppShell.Header>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Box
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
                  boxShadow: '0 6px 16px rgba(13, 148, 136, 0.28)',
                }}
              >
                <IconFlag size={21} color="white" />
              </Box>
              <Box>
                <Text fw={800} size="lg" lh={1.1}>
                  EventManager
                </Text>
                <Text size="xs" c="dimmed" lh={1.1}>
                  Eventos y entradas
                </Text>
              </Box>
            </Group>

            <Group gap={4} visibleFrom="sm">
              {links.map((link) => {
                const active =
                  link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to)
                return (
                  <UnstyledButton
                    key={link.to}
                    component={Link}
                    to={link.to}
                    px="sm"
                    py={8}
                    style={{
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 14,
                      color: active ? 'var(--mantine-color-teal-7)' : 'var(--mantine-color-gray-7)',
                      background: active ? 'var(--mantine-color-teal-0)' : 'transparent',
                    }}
                  >
                    {link.label}
                  </UnstyledButton>
                )
              })}
            </Group>

            <Button
              component={Link}
              to="/admin"
              variant="light"
              color="teal"
              leftSection={<IconTicket size={16} />}
              size="sm"
            >
              Acceso organización
            </Button>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Outlet />
        <Box mt={64} py="xl" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          <Container size="xl">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text fw={700}>EventManager</Text>
                <Text size="sm" c="dimmed" maw={420} mt={4}>
                  Plataforma de eventos, inscripciones y regalos para deporte, cultura y ocio.
                </Text>
              </Box>
              <Text size="xs" c="dimmed">
                © {new Date().getFullYear()} Event Manager - Desarrollado por Iván Pastor Simarro
              </Text>
            </Group>
          </Container>
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
