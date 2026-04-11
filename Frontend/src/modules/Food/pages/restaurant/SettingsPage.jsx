import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { 
  ArrowLeft,
  User,
  Bell,
  Shield,
  Globe,
  Moon,
  Sun,
  Info,
  LogOut,
  Lock,
  Mail,
  Phone,
  CreditCard,
  FileText,
  MessageSquare,
  ChevronRight,
  Trash2,
  AlertTriangle
} from "lucide-react"
import { authAPI } from "@food/api"
import { clearModuleAuth } from "@food/utils/auth"
import { toast } from "sonner"
import { Card, CardContent } from "@food/components/ui/card"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function SettingsPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [showMenu, setShowMenu] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [darkMode, setDarkMode] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState("")
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  // Lock background scroll when delete modal is open
  useEffect(() => {
    if (showDeleteConfirm) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [showDeleteConfirm])

  const handleDeleteAccount = async () => {
    if (deleteSubmitting || deleteInput !== "DELETE") return
    
    try {
      setDeleteSubmitting(true)
      await authAPI.deleteAccount("restaurant")
      clearModuleAuth("restaurant")
      localStorage.removeItem("app:isOnline")
      toast.success("Account deleted successfully")
      setShowDeleteConfirm(false)
      navigate("/restaurant/login", { replace: true })
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete account")
      setDeleteSubmitting(false)
    }
  }


  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  // Settings sections
  const settingsSections = [
    {
      id: "account",
      title: "Account",
      items: [
        { id: "notifications", label: "Notifications", icon: Bell, hasToggle: true, toggleValue: notificationsEnabled, onToggle: setNotificationsEnabled },
        { id: "privacy", label: "Privacy & Security", icon: Shield, route: "/restaurant/privacy" },
      ]
    },
    {
      id: "preferences",
      title: "Preferences",
      items: [
        { id: "language", label: "Language", icon: Globe, route: "/restaurant/language", value: "English" },
        { id: "theme", label: "Theme", icon: darkMode ? Moon : Sun, hasToggle: true, toggleValue: darkMode, onToggle: setDarkMode },
      ]
    },
    {
      id: "support",
      title: "Support & Information",
      items: [
        { id: "conversation", label: "Conversation", icon: MessageSquare, route: "/restaurant/conversation" },
        { id: "terms", label: "Terms & Conditions", icon: FileText, route: "/restaurant/terms" },
        { id: "privacy-policy", label: "Privacy Policy", icon: Shield, route: "/restaurant/privacy" },
        { id: "about", label: "About", icon: Info, route: "/restaurant/about" },
      ]
    },
    {
      id: "actions",
      title: "Actions",
      items: [
        { id: "logout", label: "Logout", icon: LogOut, isDestructive: true, action: () => {
          debugLog("Logout clicked")
          // Add logout logic here
        } },
        { id: "delete-account", label: "Delete Account", icon: Trash2, isDestructive: true, action: () => {
          setDeleteInput("")
          setShowDeleteConfirm(true)
        } },
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button 
          onClick={goBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Settings</h1>
      </div>

      {/* Settings Content */}
      <div className="px-4 py-4 space-y-4">
        {settingsSections.map((section, sectionIndex) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: sectionIndex * 0.1 }}
          >
            <Card className="bg-white shadow-sm border border-gray-100">
              <CardContent className="p-0">
                {/* Section Title */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {section.title}
                  </h2>
                </div>

                {/* Section Items */}
                <div className="divide-y divide-gray-100">
                  {section.items.map((item, itemIndex) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: sectionIndex * 0.1 + itemIndex * 0.05 }}
                    >
                      <button
                        onClick={() => {
                          if (item.action) {
                            item.action()
                          } else if (item.route) {
                            navigate(item.route)
                          }
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors ${
                          item.isDestructive ? "text-red-600" : "text-gray-900"
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`flex-shrink-0 p-1.5 rounded-lg ${
                            item.isDestructive 
                              ? "bg-red-100" 
                              : "bg-[#ff8100]/10"
                          }`}>
                            <item.icon className={`w-4 h-4 ${
                              item.isDestructive 
                                ? "text-red-600" 
                                : "text-[#ff8100]"
                            }`} />
                          </div>
                          <span className="text-sm font-medium flex-1 text-left">
                            {item.label}
                          </span>
                          {item.value && (
                            <span className="text-xs text-gray-500 mr-2">
                              {item.value}
                            </span>
                          )}
                        </div>

                        {item.hasToggle ? (
                          <div className="flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (item.onToggle) {
                                  item.onToggle(!item.toggleValue)
                                }
                              }}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                item.toggleValue ? "bg-[#ff8100]" : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  item.toggleValue ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        ) : (
                          !item.isDestructive && (
                            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          )
                        )}
                      </button>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      
      {/* Delete Account Confirm Popup */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center px-4 backdrop-blur-sm"
        >
          <div 
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon + Title centered */}
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
                <Trash2 className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-xl font-black text-gray-900">Delete Your Account?</h3>
            </div>

            <p className="text-sm text-gray-600 mb-4 leading-relaxed text-center">
              Are you sure you want to delete your account?
            </p>

            {/* Warning box */}
            <div className="mb-4 bg-orange-50 border-l-4 border-orange-500 rounded-r-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <span className="text-sm font-bold text-orange-700">Warning</span>
              </div>
              <p className="text-xs text-orange-700 leading-relaxed">
                Your all data will be permanently lost. This action cannot be undone.
              </p>
            </div>
            
            <div className="mb-6">
              <input 
                type="text" 
                placeholder="Type DELETE to confirm" 
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value.toUpperCase())}
                className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-red-500 focus:ring-4 focus:ring-red-50 outline-none transition-all font-bold text-center tracking-widest placeholder:tracking-normal placeholder:font-medium placeholder:text-gray-400"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                autoFocus
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-12 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 active:bg-gray-100 transition-colors ring-2 ring-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteSubmitting || deleteInput !== "DELETE"}
                className="flex-1 h-12 rounded-xl bg-red-600 text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed hover:bg-red-700 active:bg-red-800 transition-colors shadow-lg shadow-red-600/20"
              >
                {deleteSubmitting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      
      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
    </div>
  )
}


