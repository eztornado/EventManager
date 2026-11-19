import { Button, Container, Paper } from '@mantine/core'
import { IconMapOff } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/Page'

export function NotFoundPage() {
  return (
    <Container size="md" py={80}>
      <Paper withBorder radius="lg" p="xl">
        <EmptyState
          icon={<IconMapOff size={44} color="var(--mantine-color-gray-5)" />}
          title="Página no encontrada"
          description="La dirección que has abierto no existe o ha cambiado de sitio."
          action={
            <Button component={Link} to="/" variant="light">
              Ir a los eventos
            </Button>
          }
        />
      </Paper>
    </Container>
  )
}
