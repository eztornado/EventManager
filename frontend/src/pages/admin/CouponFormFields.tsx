import {
  Grid,
  NumberInput,
  Select,
  Stack,
  Switch,
  TextInput,
} from '@mantine/core'
import type { Coupon, EventItem, Modality } from '../../types'
import { toInputDateTime } from '../../utils/format'

export interface CouponFormValue {
  code: string
  kind: 'percent' | 'fixed' | 'gift'
  value: number | ''
  quantity: number
  maxUses: number | null
  validFrom: string
  validUntil: string
  active: boolean
  eventId: number | null
  modalityId: number | null
}

export const emptyCouponForm: CouponFormValue = {
  code: '',
  kind: 'percent',
  value: 10,
  quantity: 1,
  maxUses: null,
  validFrom: '',
  validUntil: '',
  active: true,
  eventId: null,
  modalityId: null,
}

export function couponToForm(coupon: Coupon): CouponFormValue {
  return {
    code: coupon.code,
    kind: coupon.kind,
    value: coupon.value,
    quantity: 1,
    maxUses: coupon.maxUses,
    validFrom: toInputDateTime(coupon.validFrom),
    validUntil: toInputDateTime(coupon.validUntil),
    active: Boolean(coupon.active),
    eventId: coupon.eventId,
    modalityId: coupon.modalityId,
  }
}

export function couponPayload(value: CouponFormValue) {
  return {
    code: value.code,
    kind: value.kind,
    value: value.value === '' ? 0 : value.value,
    quantity: value.quantity,
    maxUses: value.maxUses,
    validFrom: value.validFrom,
    validUntil: value.validUntil,
    active: value.active,
    eventId: value.eventId,
    modalityId: value.modalityId,
  }
}

export function CouponFormFields({
  value,
  onChange,
  events,
  modalities,
  showEvent,
  showQuantity,
}: {
  value: CouponFormValue
  onChange: (value: CouponFormValue) => void
  events: EventItem[]
  modalities: Modality[]
  showEvent: boolean
  showQuantity: boolean
}) {
  const availableModalities = value.eventId
    ? modalities.filter((modality) => modality.eventId === value.eventId)
    : modalities

  return (
    <Stack gap="sm">
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Código"
            placeholder="Se genera automáticamente si lo dejas vacío"
            value={value.code}
            onChange={(event) =>
              onChange({ ...value, code: event.currentTarget.value.toUpperCase() })
            }
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Select
            label="Tipo de descuento"
            data={[
              { value: 'percent', label: 'Porcentaje' },
              { value: 'fixed', label: 'Importe fijo' },
              { value: 'gift', label: 'Regalo' },
            ]}
            value={value.kind}
            onChange={(selected) =>
              onChange({ ...value, kind: (selected as CouponFormValue['kind']) ?? value.kind })
            }
            allowDeselect={false}
          />
        </Grid.Col>

        {showEvent ? (
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Evento"
              placeholder="Todos los eventos"
              data={events.map((event) => ({ value: String(event.id), label: event.name }))}
              value={value.eventId ? String(value.eventId) : null}
              onChange={(selected) =>
                onChange({
                  ...value,
                  eventId: selected ? Number(selected) : null,
                  modalityId: null,
                })
              }
              clearable
              searchable
            />
          </Grid.Col>
        ) : null}

        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Select
            label="Modalidad"
            placeholder="Todas las modalidades"
            data={availableModalities.map((modality) => ({
              value: String(modality.id),
              label: modality.name,
            }))}
            value={value.modalityId ? String(value.modalityId) : null}
            onChange={(selected) =>
              onChange({ ...value, modalityId: selected ? Number(selected) : null })
            }
            clearable
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4 }}>
          <NumberInput
            label={value.kind === 'percent' ? 'Porcentaje' : 'Importe (€)'}
            min={0}
            max={value.kind === 'percent' ? 100 : undefined}
            decimalScale={2}
            value={value.value}
            onChange={(next) =>
              onChange({ ...value, value: typeof next === 'number' ? next : '' })
            }
            disabled={value.kind === 'gift'}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <NumberInput
            label="Usos máximos"
            placeholder="Sin límite"
            min={1}
            value={value.maxUses ?? ''}
            onChange={(next) =>
              onChange({ ...value, maxUses: typeof next === 'number' ? next : null })
            }
          />
        </Grid.Col>
        {showQuantity ? (
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label="Cantidad de cupones"
              description="Se generarán códigos numerados"
              min={1}
              max={100}
              value={value.quantity}
              onChange={(next) =>
                onChange({ ...value, quantity: typeof next === 'number' ? next : 1 })
              }
            />
          </Grid.Col>
        ) : null}

        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Válido desde"
            type="datetime-local"
            value={value.validFrom}
            onChange={(event) => onChange({ ...value, validFrom: event.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Válido hasta"
            type="datetime-local"
            value={value.validUntil}
            onChange={(event) => onChange({ ...value, validUntil: event.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={12}>
          <Switch
            label="Cupón activo"
            checked={value.active}
            onChange={(event) => onChange({ ...value, active: event.currentTarget.checked })}
          />
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
