export interface DynamicField {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox'
  required?: boolean
  placeholder?: string
  options?: string[]
}

export interface OrganizerRef {
  id: number
  name: string
  slug: string
  logoUrl?: string
}

export interface PriceTier {
  id: number
  modalityId: number
  name: string
  price: number
  startsAt: string
  endsAt: string
  active: number
  createdAt: string
}

export interface Modality {
  id: number
  eventId: number
  name: string
  description: string
  distanceKm: number | null
  startTime: string
  maxParticipants: number | null
  basePrice: number
  dynamicFields: DynamicField[]
  active: number
  sortOrder: number
  createdAt: string
  currentPrice: number
  currentTier: string | null
  registrationCount: number
  spotsLeft: number | null
  revenue?: number
  tiers?: PriceTier[]
}

export interface EventItem {
  id: number
  organizerId: number | null
  organizer: OrganizerRef | null
  name: string
  slug: string
  category: string
  categoryLabel?: string
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
  statusLabel?: string
  maxParticipants: number | null
  published: number | boolean
  createdAt: string
  modalityCount: number
  minPrice: number | null
  registrationCount: number
  paidCount?: number
  revenue?: number
  giftCount?: number
  spotsLeft: number | null
  registrationOpen: boolean
  modalities?: Modality[]
  coupons?: Coupon[]
}

export interface Coupon {
  id: number
  eventId: number | null
  modalityId: number | null
  eventName?: string | null
  modalityName?: string | null
  code: string
  kind: 'percent' | 'fixed' | 'gift'
  value: number
  maxUses: number | null
  uses: number
  validFrom: string
  validUntil: string
  active: number
  createdAt: string
}

export interface Club {
  id: number
  name: string
  province: string
  active: number
  createdAt: string
}

export interface Order {
  id: number
  code: string
  registrationId: number | null
  giftId: number | null
  amount: number
  status: 'pending' | 'completed' | 'cancelled' | string
  paymentMethod: string
  reference: string
  payerName: string
  payerEmail: string
  paidAt: string | null
  createdAt: string
  eventName?: string | null
  registrationLocator?: string | null
  giftCode?: string | null
  kind?: 'registration' | 'gift'
}

export interface Registration {
  id: number
  eventId: number
  modalityId: number
  locator: string
  firstName: string
  lastName: string
  email: string
  phone: string
  birthDate: string
  gender: string
  documentId: string
  province: string
  country: string
  clubId: number | null
  clubName: string
  dynamicData: Record<string, unknown>
  basePrice: number
  discount: number
  total: number
  couponId: number | null
  giftId: number | null
  status: 'pending' | 'paid' | 'cancelled' | string
  createdAt: string
  updatedAt: string
  eventName?: string
  eventSlug?: string
  modalityName?: string
  event?: EventItem
  modality?: Modality
  order?: Order | null
  canModify?: boolean
  registrationOpen?: boolean
}

export interface Gift {
  id: number
  eventId: number
  modalityId: number
  buyerName: string
  buyerEmail: string
  recipientName: string
  recipientEmail: string
  message: string
  code: string
  pricePaid: number
  status: 'pending' | 'available' | 'claimed' | 'cancelled' | string
  claimedAt: string | null
  createdAt: string
  eventName?: string | null
  modalityName?: string | null
  claimedLocator?: string | null
  event?: EventItem
  modality?: Modality
}

export interface Organizer {
  id: number
  name: string
  slug: string
  contactEmail: string
  phone: string
  description: string
  logoUrl: string
  active: number
  createdAt: string
  eventCount?: number
  accountCount?: number
}

export interface OrganizerAccount {
  id: number
  organizerId: number
  name: string
  email: string
  active: number
  createdAt: string
}

export interface AdminUser {
  id: number
  name: string
  email: string
  role: 'superadmin' | 'admin' | string
  active: number
  createdAt: string
}

export interface OutboxEmail {
  id: number
  toEmail: string
  subject: string
  body: string
  status: string
  createdAt: string
}

export interface SessionUser {
  id: number
  name: string
  email: string
  role: 'superadmin' | 'admin' | 'organizer' | string
  organizerId: number | null
  organizerName?: string | null
}

export interface DashboardData {
  totals: {
    events: number
    activeEvents: number
    registrations: number
    paid: number
    pending: number
    cancelled: number
    revenue: number
    pendingAmount: number
    gifts: number
    availableGifts: number
    claimedGifts: number
    pendingGifts: number
    coupons: number
    couponUses: number
    clubs: number
    organizers: number
  }
  byStatus: Array<{ name: string; count: number }>
  byGender: Array<{ name: string; count: number }>
  byProvince: Array<{ name: string; count: number }>
  byCountry: Array<{ name: string; count: number }>
  byClub: Array<{ name: string; count: number }>
  byModality: Array<{ name: string; count: number }>
  overTime: Array<{ date: string; count: number }>
  recentRegistrations: Array<{
    id: number
    locator: string
    name: string
    email: string
    eventName: string
    modalityName: string
    status: string
    total: number
    createdAt: string
  }>
  events: Array<{
    id: number
    name: string
    slug: string
    status: string
    startDate: string
    modalityCount: number
    registrationCount: number
    paidCount: number
    revenue: number
    maxParticipants: number | null
  }>
}

export interface CouponValidation {
  valid: boolean
  message?: string
  discount?: number
  price?: number
  total?: number
  coupon?: Coupon
}

export interface PaymentConfig {
  provider: 'demo' | 'stripe' | string
  providerLabel: string
  currency: string
  stripeEnabled: boolean
}
