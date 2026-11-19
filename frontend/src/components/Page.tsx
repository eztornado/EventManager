import type { ReactNode } from 'react'
import { Box, Group, Paper, Stack, Text, Title } from '@mantine/core'
import type { PaperProps } from '@mantine/core'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
      <Box>
        <Title order={2}>{title}</Title>
        {subtitle ? (
          <Text c="dimmed" size="sm" mt={4}>
            {subtitle}
          </Text>
        ) : null}
      </Box>
      {actions ? <Group gap="sm">{actions}</Group> : null}
    </Group>
  )
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  ...paperProps
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
} & PaperProps) {
  return (
    <Paper withBorder radius="lg" p="lg" {...paperProps}>
      {title || actions ? (
        <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
          <Box>
            {title ? <Title order={4}>{title}</Title> : null}
            {description ? (
              <Text c="dimmed" size="sm" mt={2}>
                {description}
              </Text>
            ) : null}
          </Box>
          {actions ? <Group gap="sm">{actions}</Group> : null}
        </Group>
      ) : null}
      {children}
    </Paper>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Stack align="center" gap={6} py={48}>
      {icon}
      <Text fw={600}>{title}</Text>
      {description ? (
        <Text c="dimmed" size="sm" ta="center">
          {description}
        </Text>
      ) : null}
      {action}
    </Stack>
  )
}
