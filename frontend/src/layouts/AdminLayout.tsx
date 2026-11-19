import { useState } from 'react'
import {
  AppShell,
  Avatar,
  Box,
  Burger,
  Divider,
  Group,
  Menu,
  NavLink as MantineNavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core'
import {
  IconBuildingStore,
  IconCalendarEvent,
  IconChevronDown,
  IconCreditCard,
  IconGift,
  IconLayoutDashboard,
  IconLogout,
  IconMail,
  IconPercentage,
  IconShield,
  IconTicket,
  IconTrophy,
  IconUser,
  IconUsers,
} from '@tabler/icons-react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { initials } from '../utils/format'

interface NavItem {
  label: string
  to: string
  icon: typeof IconLayoutDashboard
  roles: string[]
}

const items: NavItem[] = [
  { label: 'Panel', to: '/admin', icon: IconLayoutDashboard, roles: ['superadmin', 'admin', 'organizer'] },
  { label: 'Eventos', to: '/admin/eventos', icon: IconCalendarEvent, roles: ['superadmin', 'admin', 'organizer'] },
  { label: 'Inscripciones', to: '/admin/inscripciones', icon: IconTicket, roles: ['superadmin', 'admin', 'organizer'] },
  { label: 'Pedidos', to: '/admin/pedidos', icon: IconCreditCard, roles: ['superadmin', 'admin', 'organizer'] },
  { label: 'Regalos', to: '/admin/regalos', icon: IconGift, roles: ['superadmin', 'admin', 'organizer'] },
  { label: 'Cupones', to: '/admin/cupones', icon: IconPercentage, roles: ['superadmin', 'admin', 'organizer'] },
  { label: 'Clubes', to: '/admin/clubes', icon: IconTrophy, roles: ['superadmin', 'admin'] },
  { label: 'Organizadores', to: '/admin/organizadores', icon: IconUsers, roles: ['superadmin', 'admin'] },
  { label: 'Administradores', to: '/admin/usuarios', icon: IconShield, roles: ['superadmin'] },
  { label: 'Correos', to: '/admin/correos', icon: IconMail, roles: ['superadmin', 'admin'] },
  { label: 'Mi perfil', to: '/admin/perfil', icon: IconUser, roles: ['superadmin', 'admin', 'organizer'] },
]

export function AdminLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [opened, setOpened] = useState(false)

  if (!user) return null

  const visible = items.filter((item) => item.roles.includes(user.role))

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={() => setOpened((value) => !value)} hiddenFrom="sm" size="sm" />
            <Box
              component={Link}
              to="/admin"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Text fw={800} size="lg" lh={1.1}>
                EventManager
              </Text>
              <Text size="xs" c="dimmed" lh={1.1}>
                Backoffice
              </Text>
            </Box>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <UnstyledButton
              component={Link}
              to="/"
              visibleFrom="xs"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <ThemeIcon variant="light" color="teal" size="sm" radius="xl">
                <IconBuildingStore size={14} />
              </ThemeIcon>
              <Text size="sm" c="teal.7" fw={600} visibleFrom="sm">
                Ver tienda
              </Text>
            </UnstyledButton>

            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="xs" wrap="nowrap">
                    <Avatar color="teal" radius="xl" size="sm">
                      {initials(user.name)}
                    </Avatar>
                    <Box visibleFrom="sm">
                      <Text size="sm" fw={600} lh={1.1}>
                        {user.name}
                      </Text>
                      <Text size="xs" c="dimmed" lh={1.1}>
                        {user.role === 'organizer'
                          ? user.organizerName ?? 'Organización'
                          : user.role === 'superadmin'
                            ? 'Superadministrador'
                            : 'Administrador'}
                      </Text>
                    </Box>
                    <IconChevronDown size={14} color="var(--mantine-color-gray-6)" />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user.email}</Menu.Label>
                <Menu.Item
                  leftSection={<IconUser size={15} />}
                  onClick={() => navigate('/admin/perfil')}
                >
                  Mi perfil
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={15} />}
                  onClick={() => {
                    logout()
                    navigate('/admin/login', { replace: true })
                  }}
                >
                  Cerrar sesión
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={4}>
            {visible.map((item) => {
              const active =
                item.to === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(item.to)
              return (
                <MantineNavLink
                  key={item.to}
                  component={Link}
                  to={item.to}
                  label={item.label}
                  active={active}
                  leftSection={<item.icon size={18} stroke={1.6} />}
                  onClick={() => setOpened(false)}
                  style={{ borderRadius: 8 }}
                  variant="light"
                />
              )
            })}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Divider my="sm" />
          <Box px="xs" pb={4}>
            <Text size="xs" c="dimmed">
              Espacio de gestión
            </Text>
            <Text size="xs" c="dimmed">
              {user.organizerName ?? 'Equipo EventManager'}
            </Text>
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
