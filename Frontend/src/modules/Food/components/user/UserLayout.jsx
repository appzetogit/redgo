import { Outlet, useLocation, useNavigate, useNavigationType } from "react-router-dom"
import { useEffect, useState, createContext, useContext, useCallback, useMemo } from "react"
import LocationPrompt from "./LocationPrompt"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

import SearchOverlay from "./SearchOverlay"
import BottomNavigation from "./BottomNavigation"
import BackToTop from "./BackToTop"
import DesktopNavbar from "./DesktopNavbar"
import { useUserNotifications } from "@food/hooks/useUserNotifications"
import LogoutConfirmationDialog from "../LogoutConfirmationDialog"
import { clearModuleAuth } from "@food/utils/auth"
import { authAPI } from "@food/api"
import { firebaseAuth, ensureFirebaseInitialized } from "@food/firebase"

import { useProfile } from "@food/context/ProfileContext"





export default function UserLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { isSearchOpen, searchValue, setSearchValue, closeSearch, isVoiceRequested } = useProfile()

  // Handle cross-context location selector intent (DesktopNavbar -> Layout)
  useEffect(() => {
    const handleOpenLocation = () => {
      // Actually navigate here
      navigate("/cart/address-selector", { state: { from: location.pathname || "/" } })
    }
    window.addEventListener('openLocationSelector', handleOpenLocation)
    return () => window.removeEventListener('openLocationSelector', handleOpenLocation)
  }, [navigate, location.pathname])


  // Standard layout behavior - No history traps to ensure scroll restoration works correctly
  useEffect(() => {
    // We let the browser handle history naturally so that scroll restoration 
    // isn't interrupted by pushState traps.
  }, []);

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false)
    setIsLoggingOut(true)

    try {
      // Clear data locally immediately for speed
      clearModuleAuth("user")
      
      // Also clear legacy keys mentioned in Logout.jsx
      localStorage.removeItem("accessToken")
      localStorage.removeItem("user_authenticated")
      localStorage.removeItem("user_user")
      localStorage.removeItem("cart")
      sessionStorage.removeItem("userAuthData")

      // Sign out from Firebase if needed
      try {
        const { signOut } = await import("firebase/auth")
        ensureFirebaseInitialized({ enableAuth: true, enableRealtimeDb: false })
        if (firebaseAuth.currentUser) {
          await signOut(firebaseAuth)
        }
      } catch (e) {}

      // Call API logout if possible (fire and forget)
      try {
        let fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null
        authAPI.logout(null, fcmToken, "web")
      } catch (e) {}

      // Dispatch event to update other components
      window.dispatchEvent(new Event("userAuthChanged"))

      // Final redirect
      navigate("/auth/login", { replace: true })
    } catch (err) {
      console.error("Logout failed:", err)
      // Still redirect as fallback
      navigate("/auth/login", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const navigationType = useNavigationType()

  // Global Refresh Handler - Scroll to top ONLY on browser refresh
  useEffect(() => {
    // Detect browser reload using modern and legacy Performance APIs
    const isReload = 
      performance.getEntriesByType('navigation')[0]?.type === 'reload' || 
      window.performance?.navigation?.type === 1;

    if (isReload) {
      // Force scroll to top on refresh
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      
      // Clear Home-page specific scroll persistence to prevent it from out-scrolling us
      sessionStorage.removeItem("homeScrollY");
      sessionStorage.removeItem("homeVisibleCount");
    }
  }, []);

  useEffect(() => {
    // Reset scroll to top whenever location changes (pathname, search, or hash)
    // but skip on POP navigation (back/forward) to allow native scroll restoration.
    // Also skip if we are on the Home page root paths, as they handle their own restoration.
    const rootPaths = ["/", "/user", "/food", "/dining", "/user/dining", "/takeaway", "/user/takeaway"];
    const isAtRoot = rootPaths.includes(location.pathname);
    
    if (navigationType !== 'POP' && !isAtRoot) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [location.pathname, location.search, location.hash, navigationType]);

  useUserNotifications()

  // Note: Authentication checks and redirects are handled by ProtectedRoute components
  // UserLayout should not interfere with authentication redirects

  // Show bottom navigation only on home page, dining page, under-250 page, and profile page
  const path = location.pathname.startsWith("/food")
    ? location.pathname.substring(5) || "/"
    : location.pathname
  const normalizedPath =
    path.length > 1 ? path.replace(/\/+$/, "") : path

  const isProfileRoot =
    normalizedPath === "/profile" ||
    normalizedPath === "/user/profile"

  const showBottomNav = normalizedPath === "/" ||
    normalizedPath === "/user" ||
    normalizedPath === "/dining" ||
    normalizedPath === "/user/dining" ||
    normalizedPath === "/takeaway" ||
    normalizedPath === "/user/takeaway" ||
    normalizedPath === "/under-250" ||
    normalizedPath === "/user/under-250" ||
    isProfileRoot ||
    normalizedPath === "" // Handle empty string case for root relative to /food

  const isUnder250 = normalizedPath === "/under-250" || normalizedPath === "/user/under-250"

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a] transition-colors duration-200">
      {/* <Navbar /> */}
      {/* Desktop Navbar - Hidden on mobile, visible on medium+ screens */}
      <div className="hidden md:block">
        {showBottomNav && <DesktopNavbar showLogo={!isUnder250} />}
      </div>
      <LocationPrompt />
      <main className={showBottomNav ? "md:pt-40" : ""}>
        <Outlet />
      </main>
      {(normalizedPath === "/" || normalizedPath === "" || normalizedPath === "/user") && <BackToTop />}
      {showBottomNav && <BottomNavigation />}

      {/* Global Logout Confirmation */}
      <LogoutConfirmationDialog 
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
      />

      {/* Loading overlay during logout */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[9999] bg-white/80 dark:bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="w-16 h-16 border-4 border-red-100 dark:border-red-900/20 border-t-[#ef4f5f] rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Signing you out...</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Please wait while we clear your session securely.</p>
        </div>
      )}
      {/* Rendering common overlays here to keep them centralized */}
      {isSearchOpen && (
        <SearchOverlay
          isOpen={isSearchOpen}
          onClose={closeSearch}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          autoStartVoice={isVoiceRequested}
        />
      )}
    </div>

  )
}
