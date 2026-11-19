import {
  Grid,
  NumberInput,
  Select,
  Stack,
  Switch,
  Textarea,
  TextInput,
} from '@mantine/core'
import type { EventItem, Organizer } from '../../types'
import { toInputDateTime } from '../../utils/format'

export interface EventFormValue {
  name: string
  slug: string
  organizerId: number | null
  description: string
  venue: string
  address: string
  city: string
  province: string
  country: string
  coverImageUrl: string
  startDate: string
  endDate: string
  registrationDeadline: string
  status: string
  maxParticipants: number | null
  published: boolean
}

export const eventStatuses = [
  'Programada',
  'Inscripciones abiertas',
  'Pausa',
  'Inscripciones cerradas',
]

export const emptyEventForm: EventFormValue = {
  name: '',
  slug: '',
  organizerId: null,
  description: '',
  venue: '',
  address: '',
  city: '',
  province: '',
  country: 'España',
  coverImageUrl: '',
  startDate: '',
  endDate: '',
  registrationDeadline: '',
  status: 'Programada',
  maxParticipants: null,
  published: true,
}

export function eventToForm(event: EventItem): EventFormValue {
  return {
    name: event.name,
    slug: event.slug,
    organizerId: event.organizerId,
    description: event.description,
    venue: event.venue,
    address: event.address,
    city: event.city,
    province: event.province,
    country: event.country,
    coverImageUrl: event.coverImageUrl,
    startDate: toInputDateTime(event.startDate),
    endDate: toInputDateTime(event.endDate),
    registrationDeadline: toInputDateTime(event.registrationDeadline),
    status: event.status,
    maxParticipants: event.maxParticipants,
    published: Boolean(event.published),
  }
}

export function eventPayload(value: EventFormValue) {
  return {
    ...value,
    organizerId: value.organizerId ?? undefined,
    maxParticipants: value.maxParticipants ?? null,
  }
}

export function EventFormFields({
  value,
  onChange,
  organizers,
  showOrganizer,
}: {
  value: EventFormValue
  onChange: (value: EventFormValue) => void
  organizers: Organizer[]
  showOrganizer: boolean
}) {
  return (
    <Stack gap="sm">
      <Grid>
        <Grid.Col span={{ base: 12, sm: 8 }}>
          <TextInput
            label="Nombre del evento"
            required
            placeholder="Trail de las Cumbres"
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <TextInput
            label="Identificador web"
            placeholder="trail-de-las-cumbres"
            description="Se genera del nombre si lo dejas vacío"
            value={value.slug}
            onChange={(event) => onChange({ ...value, slug: event.currentTarget.value })}
          />
        </Grid.Col>

        {showOrganizer ? (
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Organizador"
              required
              placeholder="Selecciona un organizador"
              data={organizers.map((organizer) => ({
                value: String(organizer.id),
                label: organizer.name,
              }))}
              value={value.organizerId ? String(value.organizerId) : null}
              onChange={(selected) =>
                onChange({ ...value, organizerId: selected ? Number(selected) : null })
              }
              searchable
            />
          </Grid.Col>
        ) : null}

        <Grid.Col span={{ base: 12, sm: showOrganizer ? 6 : 12 }}>
          <Select
            label="Estado"
            data={eventStatuses.map((status) => ({ value: status, label: status }))}
            value={value.status}
            onChange={(selected) => onChange({ ...value, status: selected ?? value.status })}
            allowDeselect={false}
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <Textarea
            label="Descripción"
            minRows={3}
            placeholder="Describe el recorrido, el ambiente y toda la información útil."
            value={value.description}
            onChange={(event) => onChange({ ...value, description: event.currentTarget.value })}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Fecha de inicio"
            type="datetime-local"
            required
            value={value.startDate}
            onChange={(event) => onChange({ ...value, startDate: event.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Fecha de fin"
            type="datetime-local"
            value={value.endDate}
            onChange={(event) => onChange({ ...value, endDate: event.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Cierre de inscripciones"
            type="datetime-local"
            value={value.registrationDeadline}
            onChange={(event) =>
              onChange({ ...value, registrationDeadline: event.currentTarget.value })
            }
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <NumberInput
            label="Plazas totales"
            placeholder="Sin límite"
            min={0}
            value={value.maxParticipants ?? ''}
            onChange={(next) =>
              onChange({ ...value, maxParticipants: typeof next === 'number' ? next : null })
            }
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Recinto"
            placeholder="Plaza Mayor"
            value={value.venue}
            onChange={(event) => onChange({ ...value, venue: event.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Dirección"
            placeholder="Calle, número"
            value={value.address}
            onChange={(event) => onChange({ ...value, address: event.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <TextInput
            label="Localidad"
            value={value.city}
            onChange={(event) => onChange({ ...value, city: event.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <TextInput
            label="Provincia"
            value={value.province}
            onChange={(event) => onChange({ ...value, province: event.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <TextInput
            label="País"
            value={value.country}
            onChange={(event) => onChange({ ...value, country: event.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={12}>
          <TextInput
            label="Imagen de portada (URL)"
            placeholder="https://..."
            value={value.coverImageUrl}
            onChange={(event) => onChange({ ...value, coverImageUrl: event.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={12}>
          <Switch
            label="Publicado en la tienda pública"
            checked={value.published}
            onChange={(event) => onChange({ ...value, published: event.currentTarget.checked })}
          />
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
