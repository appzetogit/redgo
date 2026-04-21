import { Outlet, useLocation, useNavigate, useNavigationType } from "react-router-dom"
import { useEffect, useState, createContext, useContext, useCallback, useMemo } from "react"
import { ProfileProvider } from "@food/context/ProfileContext"
import LocationPrompt from "./LocationPrompt"
import { CartProvider } from "@food/context/CartContext"
import { OrdersProvider } from "@food/context/OrdersContext"
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

// Create SearchOverlay context with default value
const SearchOverlayContext = createContext({
  isSearchOpen: false,
  searchValue: "",
  setSearchValue: () => {
    debugWarn("SearchOverlayProvider not available")
  },
  openSearch: () => {
    debugWarn("SearchOverlayProvider not available")
  },
  closeSearch: () => { }
})

export function useSearchOverlay() {
  const context = useContext(SearchOverlayContext)
  // Always return context, even if provider is not available (will use default values)
  return context
}

function SearchOverlayProvider({ children }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isVoiceRequested, setIsVoiceRequested] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const openSearch = useCallback((shouldStartVoice = false) => {
    setIsSearchOpen(true)
    setIsVoiceRequested(shouldStartVoice === true)
  }, [])

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false)
    setIsVoiceRequested(false)
    setSearchValue("")
  }, [])

  const value = useMemo(() => ({ 
    isSearchOpen, 
    searchValue, 
    setSearchValue, 
    openSearch, 
    closeSearch 
  }), [isSearchOpen, searchValue, openSearch, closeSearch])

  return (
    <SearchOverlayContext.Provider value={value}>
      {children}
      {isSearchOpen && (
        <SearchOverlay
          isOpen={isSearchOpen}
          onClose={closeSearch}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          autoStartVoice={isVoiceRequested}
        />
      )}
    </SearchOverlayContext.Provider>
  )
}

// Create LocationSelector context with default value
export const LocationSelectorContext = createContext({
  isLocationSelectorOpen: false,
  openLocationSelector: () => {
    debugWarn("LocationSelectorProvider not available")
  },
  closeLocationSelector: () => { }
})

export function useLocationSelector() {
  const context = useContext(LocationSelectorContext)
  if (!context) {
    throw new Error("useLocationSelector must be used within LocationSelectorProvider")
  }
  return context
}

function LocationSelectorProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()

  const openLocationSelector = useCallback(() => {
    // Navigate to the standalone address selector page
    // We pass state.from to ensure the back button returns to the current page
    navigate("/cart/address-selector", { state: { from: location.pathname || "/" } })
  }, [navigate, location.pathname])

  const closeLocationSelector = () => { }

  const value = useMemo(() => ({
    isLocationSelectorOpen: false,
    openLocationSelector,
    closeLocationSelector
  }), [openLocationSelector])

  return (
    <LocationSelectorContext.Provider value={value}>
      {children}
    </LocationSelectorContext.Provider>
  )
}

export default function UserLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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
      <CartProvider>
        <ProfileProvider>
          <OrdersProvider>
            <SearchOverlayProvider>
              <LocationSelectorProvider>
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
              </LocationSelectorProvider>
            </SearchOverlayProvider>
          </OrdersProvider>
        </ProfileProvider>
      </CartProvider>

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
    </div>
  )
}
