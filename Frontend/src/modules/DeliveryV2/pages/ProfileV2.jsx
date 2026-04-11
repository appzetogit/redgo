import { useEffect, useRef, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import {
  User,
  ArrowRight,
  Bike,
  Ticket,
  ChevronRight,
  Share2,
  LogOut,
  X,
  Loader2,
  Briefcase,
  Trash2,
  AlertTriangle
} from "lucide-react"
import { deliveryAPI, authAPI } from "@food/api"
import { toast } from "sonner"
import { clearModuleAuth } from "@food/utils/auth"

/**
 * ProfileV2 - 1:1 EXACT Restoration of the Legacy Profile Hub.
 * Matches ProfilePage.jsx exactly.
 */
export const ProfileV2 = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [referralReward, setReferralReward] = useState(0)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [logoutSubmitting, setLogoutSubmitting] = useState(false)
  
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

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const response = await deliveryAPI.getProfile()
        if (response?.data?.success && response?.data?.data?.profile) {
          setProfile(response.data.data.profile)
        }
      } catch (error) {
        toast.error("Failed to load profile data")
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    deliveryAPI.getReferralStats().then((res) => {
      const reward = res?.data?.data?.stats?.rewardAmount
      setReferralReward(Number(reward) || 0)
    }).catch(() => {})
  }, [])

  const refId = profile?._id || profile?.id || profile?.referralCode || ""
  const referralLink = refId ? `${window.location.origin}/delivery/signup?ref=${encodeURIComponent(String(refId))}` : ""

  const handleShareReferral = async () => {
    if (!referralLink) return
    const rewardText = referralReward > 0 ? `₹${referralReward}` : "rewards"
    const shareText = `Join as a delivery partner and earn ${rewardText}.`
    try {
      if (navigator.share) {
        await navigator.share({ title: "Delivery referral", text: shareText, url: referralLink })
      } else {
        const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${referralLink}`)}`
        window.open(fallbackUrl, "_blank", "noopener,noreferrer")
      }
    } catch (e) {}
  }

  const handleLogout = async (allDevices = false) => {
    if (logoutSubmitting) return
    setShowLogoutConfirm(false)
    try {
      setLogoutSubmitting(true)
      if (allDevices) {
        await authAPI.logoutFromAllDevices("delivery")
      } else {
        await deliveryAPI.logout()
      }
    } catch (error) {}
    clearModuleAuth("delivery")
    localStorage.removeItem("app:isOnline")
    toast.success(allDevices ? "Logged out from all devices" : "Logged out successfully")
    navigate("/delivery/login", { replace: true })
    setLogoutSubmitting(false)
  }

  const handleDeleteAccount = async () => {
    if (deleteSubmitting || deleteInput !== "DELETE") return
    
    try {
      setDeleteSubmitting(true)
      await authAPI.deleteAccount("delivery")
      clearModuleAuth("delivery")
      localStorage.removeItem("app:isOnline")
      toast.success("Account deleted successfully")
      setShowDeleteConfirm(false)
      navigate("/delivery/login", { replace: true })
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete account")
      setDeleteSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center font-poppins">
        <div className="flex items-center gap-2 text-gray-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading profile...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-poppins pb-24">
      {/* Profile Header Block */}
      <div className="bg-white p-4 w-full shadow-sm">
        <div 
          onClick={() => navigate("/delivery/profile/details")}
          className="flex items-start justify-between cursor-pointer"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl md:text-3xl font-bold">{profile?.name || ""}</h2>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-gray-600 text-sm md:text-base mb-3 font-medium">{profile?.deliveryId || ""}</p>
          </div>
          <div className="relative shrink-0 ml-4">
            {profile?.profileImage?.url ? (
              <img src={profile.profileImage.url} alt="Profile" className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-gray-200" />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                <User className="w-10 h-10 md:w-12 md:h-12 text-gray-400" />
              </div>
            )}
            <div className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md border-2 border-white">
              <Briefcase className="w-4 h-4 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Navigation Buttons */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          <button
            onClick={() => navigate("/delivery/history")}
            className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 border border-transparent active:bg-gray-50 transition-colors"
          >
            <div className="rounded-full bg-gray-50 p-3">
              <Bike className="w-6 h-6 text-gray-700" />
            </div>
            <span className="text-sm font-bold text-gray-900">Trips history</span>
          </button>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {/* Share & Earn */}
          <div className="bg-white rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 mb-1">
                Share & Earn{referralReward > 0 ? ` ₹${referralReward}` : ""}
              </h3>
              <p className="text-gray-500 text-xs font-medium">Invite friends to join the delivery partner fleet.</p>
            </div>
            <button
              onClick={handleShareReferral}
              className="shrink-0 bg-black text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest shadow-md"
            >
              Share
            </button>
          </div>

          {/* Support Section */}
          <div>
            <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-1">Support</h3>
            <div 
              onClick={() => navigate("/delivery/help/tickets")}
              className="bg-white rounded-xl p-4 flex items-center justify-between cursor-pointer active:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Ticket className="w-5 h-5 text-gray-700" />
                <span className="text-sm font-bold text-gray-900">Support tickets</span>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300" />
            </div>
          </div>

          {/* Partner options Section */}
          {/* Logout Section */}
          <div className="pt-4 space-y-3">
            <div 
              onClick={() => setShowLogoutConfirm(true)}
              className="bg-white rounded-xl p-4 flex items-center justify-between cursor-pointer border border-red-50 hover:bg-red-50/30 active:bg-red-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-red-600" />
                <span className="text-sm font-bold text-red-600">Log out</span>
              </div>
              <ArrowRight className="w-5 h-5 text-red-100" />
            </div>

            <div 
              onClick={() => {
                setDeleteInput("");
                setShowDeleteConfirm(true);
              }}
              className="bg-white rounded-xl p-4 flex items-center justify-between cursor-pointer border border-red-100 hover:bg-red-50/50 active:bg-red-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-5 h-5 text-red-600" />
                <span className="text-sm font-bold text-red-600">Delete Account</span>
              </div>
              <ArrowRight className="w-5 h-5 text-red-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirm Popup */}
      {showLogoutConfirm && (
        <div 
          className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center px-4 backdrop-blur-sm"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User Info in Modal */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative mb-3">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-slate-50 shadow-inner">
                  {profile?.profileImage?.url ? (
                    <img src={profile.profileImage.url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-gray-300" />
                  )}
                </div>
              </div>
              <h3 className="text-xl font-black text-gray-900 leading-tight">{profile?.name || "Partner"}</h3>
              <p className="text-sm font-medium text-gray-500 mt-0.5">{profile?.deliveryId || ""}</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleLogout(false)}
                disabled={logoutSubmitting}
                className="w-full h-14 bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-600/20"
              >
                {logoutSubmitting ? "Logging out..." : "Logout"}
              </button>
              <button
                onClick={() => handleLogout(true)}
                disabled={logoutSubmitting}
                className="w-full h-14 bg-white hover:bg-gray-50 active:scale-95 disabled:opacity-50 text-red-600 font-bold rounded-2xl border-2 border-red-600 transition-all"
              >
                Logout from all devices
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full h-12 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}

export default ProfileV2;
