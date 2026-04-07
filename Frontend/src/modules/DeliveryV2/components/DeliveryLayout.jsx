import React, { useEffect, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { clearModuleAuth } from "@food/utils/auth"
import { authAPI } from "@food/api"
import { firebaseAuth, ensureFirebaseInitialized } from "@food/firebase"
import LogoutConfirmationDialog from "../../Food/components/LogoutConfirmationDialog"

export default function DeliveryLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Block back button on Home to show logout confirmation
  useEffect(() => {
    // Only intercept when on the Delivery Home page
    const isAtRoot = location.pathname === "/delivery" || location.pathname === "/delivery/"
    
    if (!isAtRoot) return;

    // Trap the back button
    window.history.pushState({ trap: true }, "", window.location.href);

    const handlePopState = () => {
      // If we are on the Home page and user hit back, show logout confirm
      if (location.pathname === "/delivery" || location.pathname === "/delivery/") {
        setShowLogoutConfirm(true);
        window.history.pushState({ trap: true }, "", window.location.href);
      }
    };

    window.addEventListener("popstate", handlePopState);
    
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [location.pathname]);

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false)
    setIsLoggingOut(true)

    try {
      // Clear data locally
      clearModuleAuth("delivery")
      
      // Sign out from Firebase if needed
      try {
        const { signOut } = await import("firebase/auth")
        ensureFirebaseInitialized({ enableAuth: true, enableRealtimeDb: false })
        if (firebaseAuth.currentUser) {
          await signOut(firebaseAuth)
        }
      } catch (e) {}

      // Call API logout if possible
      try {
        let fcmToken = localStorage.getItem("fcm_web_registered_token_delivery") || null
        authAPI.logout(null, fcmToken, "web")
      } catch (e) {}

      // Dispatch event to update other components
      window.dispatchEvent(new Event("deliveryAuthChanged"))

      // Final redirect
      navigate("/delivery/login", { replace: true })
    } catch (err) {
      console.error("Logout failed:", err)
      navigate("/delivery/login", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  // Auto-scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      <main>
        <Outlet />
      </main>

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
