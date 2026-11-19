import type { ReactNode } from 'react'
import { Container } from '@mantine/core'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, useAuth } from './auth/AuthContext'
import { PublicLayout } from './layouts/PublicLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { HomePage } from './pages/public/HomePage'
import { EventDetailPage } from './pages/public/EventDetailPage'
import { ParticipantsPage } from './pages/public/ParticipantsPage'
import { RegisterPage } from './pages/public/RegisterPage'
import { LookupPage } from './pages/public/LookupPage'
import { GiftClaimPage } from './pages/public/GiftClaimPage'
import { NotFoundPage } from './pages/public/NotFoundPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { DashboardPage } from './pages/admin/DashboardPage'
import { EventsPage } from './pages/admin/EventsPage'
import { EventEditPage } from './pages/admin/EventEditPage'
import { RegistrationsPage } from './pages/admin/RegistrationsPage'
import { OrdersPage } from './pages/admin/OrdersPage'
import { GiftsPage } from './pages/admin/GiftsPage'
import { CouponsPage } from './pages/admin/CouponsPage'
import { ClubsPage } from './pages/admin/ClubsPage'
import { OrganizersPage } from './pages/admin/OrganizersPage'
import { UsersPage } from './pages/admin/UsersPage'
import { EmailsPage } from './pages/admin/EmailsPage'
import { ProfilePage } from './pages/admin/ProfilePage'

function PublicContainer({ children }: { children: ReactNode }) {
  return (
    <Container size="xl" py="xl">
      {children}
    </Container>
  )
}

function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) {
    return <Navigate to="/admin/login" replace />
  }
  if (!roles.includes(user.role)) {
    return <Navigate to="/admin" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="eventos/:slug" element={<EventDetailPage />} />
        <Route path="eventos/:slug/participantes" element={<ParticipantsPage />} />
        <Route
          path="eventos/:slug/inscribirse"
          element={
            <PublicContainer>
              <RegisterPage />
            </PublicContainer>
          }
        />
        <Route
          path="inscripciones"
          element={
            <PublicContainer>
              <LookupPage />
            </PublicContainer>
          }
        />
        <Route
          path="regalos"
          element={
            <PublicContainer>
              <GiftClaimPage />
            </PublicContainer>
          }
        />
        <Route
          path="regalos/:code"
          element={
            <PublicContainer>
              <GiftClaimPage />
            </PublicContainer>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="/admin/login" element={<AdminLoginPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="eventos" element={<EventsPage />} />
        <Route path="eventos/:id" element={<EventEditPage />} />
        <Route path="inscripciones" element={<RegistrationsPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="regalos" element={<GiftsPage />} />
        <Route path="cupones" element={<CouponsPage />} />
        <Route
          path="clubes"
          element={
            <RequireRole roles={['superadmin', 'admin']}>
              <ClubsPage />
            </RequireRole>
          }
        />
        <Route
          path="organizadores"
          element={
            <RequireRole roles={['superadmin', 'admin']}>
              <OrganizersPage />
            </RequireRole>
          }
        />
        <Route
          path="usuarios"
          element={
            <RequireRole roles={['superadmin']}>
              <UsersPage />
            </RequireRole>
          }
        />
        <Route
          path="correos"
          element={
            <RequireRole roles={['superadmin', 'admin']}>
              <EmailsPage />
            </RequireRole>
          }
        />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}

export default App
