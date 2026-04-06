import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useEffect, Suspense, lazy } from "react"
import ProtectedRoute from "@food/components/ProtectedRoute"
import AuthRedirect from "@food/components/AuthRedirect"
import Loader from "@food/components/Loader"
import PushSoundEnableButton from "@food/components/PushSoundEnableButton"
import { registerWebPushForCurrentModule } from "@food/utils/firebaseMessaging"
import { isModuleAuthenticated } from "@food/utils/auth"
import { useRestaurantNotifications } from "@food/hooks/useRestaurantNotifications"

// Lazy Loading Components
const UserRouter = lazy(() => import("@food/components/user/UserRouter"))

// Restaurant Module
const RestaurantRouter = lazy(() => import("@food/components/restaurant/RestaurantRouter"))

// Admin Module
const AdminRouter = lazy(() => import("@food/components/admin/AdminRouter"))
const AdminLogin = lazy(() => import("@food/pages/admin/auth/AdminLogin"))
const AdminSignup = lazy(() => import("@food/pages/admin/auth/AdminSignup"))
const AdminForgotPassword = lazy(() => import("@food/pages/admin/auth/AdminForgotPassword"))

// Delivery Module
const DeliveryRouter = lazy(() => import("../DeliveryV2"))

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RestaurantGlobalNotificationListenerInner() {
  useRestaurantNotifications()
  return null
}

function RestaurantGlobalNotificationListener() {
  const location = useLocation()
  const isRestaurantRoute =
    location.pathname.startsWith("/food/restaurant") ||
    location.pathname.startsWith("/restaurant")

  const isRestaurantAuthRoute =
    location.pathname.includes("/login") ||
    location.pathname.includes("/sign-in") ||
    location.pathname.includes("/signup") ||
    location.pathname.includes("/forgot-password") ||
    location.pathname.includes("/otp") ||
    location.pathname.includes("/welcome")

  const shouldListen =
    isRestaurantRoute &&
    !isRestaurantAuthRoute &&
    isModuleAuthenticated("restaurant")

  if (!shouldListen) {
    return null
  }

  return <RestaurantGlobalNotificationListenerInner />
}

export default function App() {
  const location = useLocation()

  useEffect(() => {
    registerWebPushForCurrentModule(location.pathname)
  }, [location.pathname])

  return (
    <>
      <ScrollToTop />
      <RestaurantGlobalNotificationListener />
      <PushSoundEnableButton />
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Restaurant Module */}
          <Route
            path="restaurant/*"
            element={<RestaurantRouter />}
          />

          {/* Delivery Module */}
          <Route
            path="delivery/*"
            element={<DeliveryRouter />}
          />

          {/* User Module (mapped to /user AND root for backward compatibility and main entry) */}
          <Route
            path="user/*"
            element={<UserRouter />}
          />

          {/* Catch-all for everything else (User App root) */}
          <Route
            path="/*"
            element={<UserRouter />}
          />
        </Routes>
      </Suspense>
    </>
  )
}
