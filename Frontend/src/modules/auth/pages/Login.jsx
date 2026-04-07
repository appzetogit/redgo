import React, { useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom"
import { Phone, Lock, ArrowRight, ShieldCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { authAPI } from "@food/api"
import { setAuthData } from "@food/utils/auth"
import quickSpicyLogo from "@food/assets/redgo-logo-transparent.png"

export default function UnifiedOTPFastLogin() {
  const RESEND_COOLDOWN_SECONDS = 60
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const navigate = useNavigate()
  const submitting = useRef(false)

  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-15)
    return digits.length >= 8 ? digits : ""
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    const phone = normalizedPhone()
    if (phone.length < 8) {
      toast.error("Please enter a valid phone number (at least 8 digits)")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtpSent(true)
      setOtp("")
      setStep(2)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP sent! Check your phone.")
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to send OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleResendOTP = async () => {
    const phone = normalizedPhone()
    if (phone.length < 8) {
      toast.error("Please enter a valid phone number (at least 8 digits)")
      return
    }
    if (resendTimer > 0 || submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setOtpSent(true)
      setResendTimer(RESEND_COOLDOWN_SECONDS)
      toast.success("OTP resent successfully.")
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to resend OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleEditNumber = () => {
    setStep(1)
    setOtp("")
    setResendTimer(0)
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    const phone = normalizedPhone()
    const otpDigits = String(otp).replace(/\D/g, "").slice(0, 4)
    if (otpDigits.length !== 4) {
      toast.error("Please enter the 4-digit OTP")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      // Try to get FCM token before verifying OTP
      let fcmToken = null;
      let platform = "web";
      try {
        if (typeof window !== "undefined") {
          if (window.flutter_inappwebview) {
            platform = "mobile";
            const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"];
            for (const handlerName of handlerNames) {
              try {
                const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "user" });
                if (t && typeof t === "string" && t.length > 20) {
                  fcmToken = t.trim();
                  break;
                }
              } catch (e) { }
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e);
      }

      const response = await authAPI.verifyOTP(phoneNumber, otpDigits, "login", null, null, "user", null, null, fcmToken, platform)
      const data = response?.data?.data || response?.data || {}
      const accessToken = data.accessToken
      const refreshToken = data.refreshToken || null
      const user = data.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server")
      }

      setAuthData("user", accessToken, user, refreshToken)
      toast.success("Login successful!")
      navigate("/", { replace: true })
    } catch (err) {
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Invalid OTP. Please try again."
      if (status === 401) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          msg = "Your account is deactivated. Please contact support."
        } else {
          msg = "Invalid or expired code, or account not active."
        }
      }
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return
    const intervalId = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [step, resendTimer])

  const formatResendTimer = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  // Service images (served from public folder)
  const foodIcon = "/super-app/food.png"
  const taxiIcon = "/super-app/taxi.png"
  const groceryIcon = "/super-app/grocery.png"
  const hotelIcon = "/super-app/hotel.png"

  const services = [
    { id: 'food', name: 'Food Delivery', icon: foodIcon, label: 'Zomato', color: 'bg-red-500', shadow: 'shadow-red-200' },
    { id: 'taxi', name: 'Taxi', icon: taxiIcon, label: 'Taxi', color: 'bg-yellow-400', shadow: 'shadow-yellow-200' },
    { id: 'grocery', name: 'Quick Commerce', icon: groceryIcon, label: 'Blinkit', color: 'bg-green-500', shadow: 'shadow-green-200' },
    { id: 'hotels', name: 'Hotels', icon: hotelIcon, label: 'Hotels', color: 'bg-blue-500', shadow: 'shadow-blue-200' },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex flex-col pt-0 sm:pt-0">
      {/* Top Banner section - Matching RedGo aesthetic */}
      <div className="relative w-full bg-[#ef4f5f] dark:bg-[#b01c27] pt-12 pb-14 px-6 rounded-b-[40px] shadow-lg overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-32 h-32 bg-yellow-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-2 shadow-2xl"
          >
            <img src={quickSpicyLogo} alt="RedGo Logo" className="w-full h-full object-contain" />
          </motion.div>
          
          <div className="text-center space-y-1">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-black text-white tracking-tight drop-shadow-md"
            >
              RedGo
            </motion.h1>
            <p className="text-[10px] sm:text-xs font-bold text-white/90 uppercase tracking-[0.2em]">
              Taste the best, forget the rest
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-[480px] mx-auto w-full px-6 py-4 flex flex-col justify-center -mt-8 relative z-20">
        {/* Main Card */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-[2rem] p-6 sm:p-8 md:p-12 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] dark:shadow-none border border-gray-50 dark:border-gray-800">
          <div className="text-center mb-6 space-y-2">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Login or Signup</h2>
            <div className="h-1 w-12 bg-[#ef4f5f] mx-auto rounded-full" />
          </div>

          <form onSubmit={step === 1 ? handleSendOTP : handleVerifyOTP} className="space-y-5">
            {step === 1 ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-1 flex items-center pointer-events-none">
                      <Phone className="w-5 h-5 text-gray-400 group-focus-within:text-[#ef4f5f] transition-colors" />
                    </div>
                    <div className="absolute left-8 inset-y-0 flex items-center pointer-events-none">
                      <span className="text-sm font-bold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-800 pr-3">+91</span>
                    </div>
                    <input
                      type="tel"
                      required
                      autoFocus
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      maxLength={10}
                      className="block w-full pl-20 pr-4 py-3 bg-transparent text-gray-900 dark:text-white border-b-2 border-gray-100 dark:border-gray-800 focus:border-[#ef4f5f] outline-none transition-all placeholder:text-gray-300 font-bold text-lg"
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                  We will send success notifications and order updates via SMS
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                    <div className="w-10 h-10 bg-[#ef4f5f]/10 rounded-full flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-[#ef4f5f]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest leading-none mb-1">Sent to</p>
                      <p className="text-sm font-black text-gray-900 dark:text-white">+91 {phoneNumber}</p>
                    </div>
                    <button type="button" onClick={handleEditNumber} className="text-xs text-[#ef4f5f] font-black underline cursor-pointer">Edit</button>
                  </div>

                  <div className="flex justify-center gap-3 mt-4">
                    {[0, 1, 2, 3].map((index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="tel"
                        inputMode="numeric"
                        required
                        autoFocus={index === 0}
                        value={otp[index] || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(-1);
                          if (!val) return;
                          const newOtp = otp.split("");
                          newOtp[index] = val;
                          const combined = newOtp.join("").slice(0, 4);
                          setOtp(combined);

                          // Focus next
                          if (index < 3 && val) {
                            document.getElementById(`otp-${index + 1}`)?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace") {
                            if (!otp[index] && index > 0) {
                              document.getElementById(`otp-${index - 1}`)?.focus();
                            } else {
                              const newOtp = otp.split("");
                              newOtp[index] = "";
                              setOtp(newOtp.join(""));
                            }
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
                          if (pasteData) {
                            setOtp(pasteData);
                            document.getElementById(`otp-${Math.min(pasteData.length, 3)}`)?.focus();
                          }
                        }}
                        className="w-14 h-14 sm:w-16 sm:h-16 text-center text-xl sm:text-3xl font-black bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 focus:border-[#ef4f5f] rounded-xl sm:rounded-2xl outline-none transition-all text-gray-900 dark:text-white"
                        placeholder="-"
                      />
                    ))}
                  </div>
                  <div className="text-center mt-4">
                    {resendTimer > 0 ? (
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Resend OTP in {formatResendTimer(resendTimer)}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={loading}
                        className="text-xs font-black text-[#ef4f5f] underline disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-black text-lg transition-all relative overflow-hidden shadow-xl ${loading
                  ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-50"
                  : "bg-[#ef4f5f] hover:bg-[#d43d4c] text-white hover:shadow-2xl hover:shadow-[#ef4f5f]/30 active:scale-[0.98] hover:-translate-y-0.5"
                }`}
            >
              {loading ? (
                <Loader2 className="w-7 h-7 animate-spin mx-auto text-white" />
              ) : (
                step === 1 ? "Get Verification Code" : "Continue"
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center space-y-2">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] leading-relaxed">
            By continuing, you agree to our <br />
            <Link to="/profile/terms" className="text-gray-900 dark:text-white underline cursor-pointer hover:text-[#ef4f5f] transition-colors">Terms of Service</Link> & <Link to="/profile/privacy" className="text-gray-900 dark:text-white underline cursor-pointer hover:text-[#ef4f5f] transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
