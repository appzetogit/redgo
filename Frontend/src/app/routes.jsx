import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'


const NATIVE_LAST_ROUTE_KEY = 'native_last_route'

// Lazy load the Food service module (Quick-spicy app)
const FoodApp = lazy(() => import('../modules/Food/routes'))
const AuthApp = lazy(() => import('../modules/auth/routes'))

import { Loader2 } from 'lucide-react'

const PageLoader = () => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white">
    <Loader2 className="w-10 h-10 text-[#EF4F5F] animate-spin mb-4" />
    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest animate-pulse">Loading RedGo...</p>
  </div>
)

/**
 * FoodAppWrapper — Quick-spicy App. को / root या /food prefix के साथ render करता है.
 */
const FoodAppWrapper = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <FoodApp />
    </Suspense>
  )
}

const AdminRouter = lazy(() => import('../modules/Food/components/admin/AdminRouter'))

const AppRoutes = () => {
  const location = useLocation()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const protocol = String(window.location?.protocol || '').toLowerCase()
    const userAgent = String(window.navigator?.userAgent || '').toLowerCase()
    const isNativeLikeShell =
      Boolean(window.flutter_inappwebview) ||
      Boolean(window.ReactNativeWebView) ||
      protocol === 'file:' ||
      userAgent.includes(' wv') ||
      userAgent.includes('; wv')

    if (!isNativeLikeShell) return

    const route = `${location.pathname || ''}${location.search || ''}`
    if (route && route !== '/') {
      localStorage.setItem(NATIVE_LAST_ROUTE_KEY, route)
    }
  }, [location.pathname, location.search])

  return (
    <Routes>
      {/* Auth Module */}
      <Route path="/auth/*" element={<AuthApp />} />

      {/* Admin Portal */}
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<PageLoader />}>
            <AdminRouter />
          </Suspense>
        }
      />

      {/* Legacy /food/ cleanup: Redirect /food/* back to root /* */}
      <Route
        path="/food/*"
        element={<Navigate to={location.pathname.replace(/^\/food/, "") || "/"} replace />}
      />

      {/* Main App - Food module handles root and everything else */}
      <Route path="/*" element={<FoodAppWrapper />} />

    </Routes>
  )
}

export default AppRoutes
