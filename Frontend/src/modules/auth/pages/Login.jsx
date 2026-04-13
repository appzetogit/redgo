import React, { useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom"
import { Phone, Lock, ArrowRight, ShieldCheck, Loader2, User, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { authAPI, userAPI } from "@food/api"
import { setAuthData } from "@food/utils/auth"
import quickSpicyLogo from "@food/assets/redgo-logo-transparent.png"
import AnimatedPage from "@food/components/user/AnimatedPage"

export default function UnifiedOTPFastLogin() {
  const RESEND_COOLDOWN_SECONDS = 59
  const [phoneNumber, setPhoneNumber] = useState("")
  const [fullName, setFullName] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [userData, setUserData] = useState(null)
  const [otpSent, setOtpSent] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [error, setError] = useState("")
  const [phoneFieldError, setPhoneFieldError] = useState("")
  const [showExitModal, setShowExitModal] = useState(false)
  const [blockTimer, setBlockTimer] = useState(0) // Seconds remaining in block

  const navigate = useNavigate()
  const submitting = useRef(false)

  const normalizedPhone = () => {
    const digits = String(phoneNumber).replace(/\D/g, "").slice(-15)
    return digits.length >= 8 ? digits : ""
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    const phone = normalizedPhone()
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setPhoneFieldError("Enter a valid mobile number starting with 6–9")
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
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to send OTP."
      const lowerMsg = msg.toLowerCase();

      // Better detection for security block
      const isBlocked = lowerMsg.includes("blocked") ||
        lowerMsg.includes("too many attempts") ||
        lowerMsg.includes("try again after");

      if (isBlocked) {
        // Try to parse time: "3:43 minutes" or "5 minutes"
        let totalSeconds = 180; // default 3 mins
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/); // Matches "3" or "3:43"

        if (timeMatch) {
          const mins = parseInt(timeMatch[1]);
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          totalSeconds = (mins * 60) + secs;
        }

        setBlockTimer(totalSeconds);
        setStep(2); // Redirect to Step 2 (OTP index)
        toast.error("Account temporarily locked due to failed attempts.");
        return;
      }

      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleResendOTP = async () => {
    const phone = normalizedPhone()
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setPhoneFieldError("Enter a valid mobile number starting with 6–9")
      return
    }
    if (resendTimer > 0 || submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await authAPI.sendOTP(phoneNumber, "login", null)
      setOtp("")
      setResendTimer(RESEND_COOLDOWN_SECONDS)
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
    setBlockTimer(0) // Clear block timer when changing number
    setError("")
  }

  // Auto-focus OTP input when moving to Step 2
  useEffect(() => {
    if (step === 2 && blockTimer <= 0) {
      const timer = setTimeout(() => {
        const firstInput = document.querySelector('input[name="otp-0"]');
        if (firstInput) firstInput.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step, blockTimer]);

  // Auto-verify when OTP is 4 digits
  useEffect(() => {
    if (step === 2 && otp.length === 4 && !submitting.current) {
      handleVerifyOTP();
    }
  }, [otp, step]);

  const handleVerifyOTP = async (e) => {
    if (e) e.preventDefault()
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

      // Check if user has a name (to decide if we show Step 3)
      if (!user.name || user.name.trim() === "" || user.isNewUser) {
        setAuthData("user", accessToken, user, refreshToken) // Save auth first
        setUserData({ accessToken, user, refreshToken })
        setStep(3)
      } else {
        setAuthData("user", accessToken, user, refreshToken)
        navigate("/", { replace: true })
      }
    } catch (err) {
      const status = err?.response?.status
      let msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Invalid OTP"

      // Check for blocked status in message
      if (msg.toLowerCase().includes("blocked") || msg.toLowerCase().includes("too many attempts")) {
        // Parse minutes from message: e.g. "Blocked for 3 minutes"
        const timeMatch = msg.match(/(\d+)(?::(\d+))?/);
        if (timeMatch) {
          const mins = parseInt(timeMatch[1]);
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          setBlockTimer((mins * 60) + secs);
          msg = ""; // Clear message so only Block UI shows
        }
      } else if (status === 401) {
        if (/deactivat(ed|e)/i.test(String(msg))) {
          msg = "Your account is deactivated. Please contact support."
        } else {
          msg = "Invalid OTP"
        }
      }

      setError(msg)
      setOtp(""); // Also reset on general invalid OTP
      
      // Auto-focus first input on error
      setTimeout(() => {
        const firstInput = document.querySelector('input[name="otp-0"]');
        if (firstInput) firstInput.focus();
      }, 10);
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleCompleteProfile = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error("Please enter your full name")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await userAPI.updateProfile({ name: fullName.trim() })

      // Update local storage user data with the new name
      const updatedUser = { ...userData.user, name: fullName.trim() }
      setAuthData("user", userData.accessToken, updatedUser, userData.refreshToken)

      toast.success("Profile completed!")
      navigate("/", { replace: true })
    } catch (err) {
      toast.error("Failed to update name. Please try again.")
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleExitLogin = () => {
    // Clear any temporary auth data
    localStorage.removeItem("user_accessToken")
    localStorage.removeItem("user_refreshToken")
    localStorage.removeItem("user_authenticated")
    localStorage.removeItem("user_user")

    // Reset to step 1
    setShowExitModal(false)
    setPhoneNumber("")
    setFullName("")
    setOtp("")
    setStep(1)
    setOtpSent(false)
    setError("")
    toast.info("Registration cancelled.")
  }

  // Handle browser back button/gestures for Step 3
  useEffect(() => {
    if (step === 3) {
      const handlePopState = (e) => {
        e.preventDefault();
        setShowExitModal(true);
        window.history.pushState(null, null, window.location.pathname);
      };

      window.history.pushState(null, null, window.location.pathname);
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [step]);

  useEffect(() => {
    if (resendTimer <= 0) return
    const intervalId = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [resendTimer])

  useEffect(() => {
    if (blockTimer <= 0) return
    const intervalId = setInterval(() => {
      setBlockTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(intervalId)
  }, [blockTimer])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  // Visual Assets
  const bowl1 = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80"
  const bowl2 = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80"
  const bowl3 = "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=500&q=80"

  return (
    <AnimatedPage className="min-h-screen bg-[#FFF9F0] flex relative font-sans overflow-hidden">

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowExitModal(false)}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[32px] p-8 w-full max-w-[340px] relative z-[1001] shadow-2xl text-center"
          >
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-[#EF4F5F]" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Cancel Registration?</h3>
            <p className="text-sm font-medium text-gray-500 mb-8 leading-relaxed">
              If you exit now, you'll have to verify your phone number again.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleExitLogin}
                className="w-full py-4 bg-[#EF4F5F] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-red-200 active:scale-95 transition-all"
              >
                Exit Registration
              </button>
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Background Lightning Bolts (Only for Steps 1 & 2) */}
      {step !== 3 && (
        <>
          <svg className="absolute top-12 right-[20%] w-6 h-8 text-black opacity-80 z-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
          <svg className="absolute bottom-[20%] right-[10%] w-6 h-8 text-[#EF4F5F] opacity-80 z-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
          <svg className="absolute top-[40%] right-[5%] w-4 h-6 text-black opacity-50 z-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
          <svg className="absolute bottom-[5%] left-[60%] w-5 h-7 text-black opacity-80 z-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>

        </>
      )}

      {/* Left Panel - Diagonal Graphic (Hidden on Step 3) */}
      <div
        className={`hidden lg:block absolute top-0 left-0 bottom-0 w-[55%] bg-[#EF4F5F] z-10 transition-transform duration-700 ${step === 3 ? '-translate-x-full' : 'translate-x-0'}`}
        style={{ clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0 100%)' }}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path stroke="#000" strokeWidth="2" fill="none" d="M300,100 C400,200 200,400 400,600 C500,700 600,500 700,800" />
            <path stroke="#000" strokeWidth="2" fill="none" d="M150,50 C50,250 250,550 50,750" />
            <path stroke="#000" strokeWidth="2" fill="none" d="M800,200 C700,300 900,500 700,700" />
            <circle cx="200" cy="150" r="40" stroke="#000" strokeWidth="2" fill="none" />
            <circle cx="600" cy="850" r="60" stroke="#000" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <div className="absolute top-0 left-0 bottom-0 w-[28%] bg-[#1A1A1A] z-20 shadow-2xl" />
        <div className="absolute top-1/2 left-[14%] -translate-y-[45%] flex flex-col gap-6 z-30">
          <div className="relative transform -translate-x-6 z-30 hover:scale-105 transition-transform duration-500">
            <div className="w-[280px] h-[280px] rounded-full overflow-hidden border-[6px] border-[#1A1A1A] shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
              <img src={bowl1} alt="Bowl 1" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="relative transform translate-x-12 z-20 hover:scale-105 transition-transform duration-500">
            <div className="w-[220px] h-[220px] rounded-full overflow-hidden border-[6px] border-[#1A1A1A] shadow-[0_15px_35px_rgba(0,0,0,0.3)]">
              <img src={bowl2} alt="Bowl 2" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="relative transform -translate-x-2 z-10 hover:scale-105 transition-transform duration-500">
            <div className="w-[240px] h-[240px] rounded-full overflow-hidden border-[6px] border-[#1A1A1A] shadow-[0_15px_35px_rgba(0,0,0,0.3)]">
              <img src={bowl3} alt="Bowl 3" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className={`w-full min-h-screen flex flex-col transition-all duration-700 ${step === 3 || step === 2 ? 'bg-white' : 'lg:w-[45%] lg:ml-auto relative'}`}>

        {/* Step 2 Back Button */}
        {step === 2 && (
          <button
            onClick={handleEditNumber}
            className="absolute top-6 left-6 p-3 bg-white rounded-full shadow-lg text-[#EF4F5F] hover:bg-gray-50 transition-all z-50 active:scale-95"
            aria-label="Back to phone number"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}

        {/* Step 3 Header (Matching screenshots exactly) */}
        {step === 3 && (
          <header className="w-full bg-white border-b border-gray-100 flex items-center h-20 px-4 shrink-0 relative z-50">
            <button
              onClick={() => setShowExitModal(true)}
              className="absolute left-6 p-3 hover:bg-gray-50 rounded-full transition-colors active:scale-90"
            >
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <div className="flex-1 flex justify-center">
              <h1 className="text-xl md:text-2xl font-black text-[#1A1A1A] tracking-tight text-center">Complete Your Profile</h1>
            </div>
          </header>
        )}

        <div className={`flex-1 flex flex-col items-center px-6 md:px-12 py-12 relative z-20 ${step === 3 ? 'bg-white justify-start pt-8 md:pt-16' : 'justify-center'}`}>

          <div className="w-full max-w-[420px] flex flex-col pt-0 items-center">

            {/* Step 1 & 2 Logo Section */}
            {step !== 3 && (
              <div className="text-center flex flex-col items-center -mt-24 mb-12">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="z-10">
                  <img src={quickSpicyLogo} alt="RedGo Main Logo" className="w-[240px] md:w-[260px] object-contain drop-shadow-sm" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-[11px] font-[800] text-gray-500 uppercase tracking-[0.2em] whitespace-nowrap -mt-8 z-20 relative"
                >
                  Taste The Best, Forget The Rest
                </motion.p>
              </div>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-12 text-center w-full">
                <h2 className="text-4xl md:text-5xl font-black text-[#1A1A1A] tracking-tight">Welcome!</h2>
              </motion.div>
            )}

            <form onSubmit={step === 1 ? handleSendOTP : step === 2 ? handleVerifyOTP : handleCompleteProfile} className="space-y-4">
              {step === 1 && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                  <div className="mb-3 flex flex-col items-start px-2">
                    <h2 className="text-[28px] font-[900] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 pb-2 leading-normal">
                      Login & Signup
                    </h2>
                  </div>
                  <div className={`relative flex items-center rounded-full h-[52px] md:h-[56px] px-6 transition-all shadow-sm hover:shadow ${phoneFieldError ? "border-2 border-[#EF4F5F] bg-red-50" : "bg-[#EBEBEB] focus-within:ring-2 focus-within:ring-[#EF4F5F] focus-within:bg-white"}`}>
                    <span className="font-semibold text-gray-600 text-sm md:text-base border-r-2 border-gray-300 pr-3 mr-3 pt-0.5">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      autoFocus
                      value={phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10)
                        setPhoneNumber(val)
                        setError("")
                        
                        if (val.length > 0 && !/^[6-9]/.test(val)) {
                          setPhoneFieldError("Enter a valid mobile number starting with 6–9")
                        } else {
                          setPhoneFieldError("")
                        }
                      }}
                      maxLength={10}
                      placeholder="Phone number"
                      className="flex-1 bg-transparent border-none outline-none text-gray-800 text-sm md:text-base font-medium placeholder:text-gray-400 h-full w-full"
                    />
                  </div>
                  {phoneFieldError && (
                    <div className="mt-2 px-6 w-full text-left">
                      <p className="text-[12px] font-bold text-[#EF4F5F] transition-all">
                        {phoneFieldError}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  <div className="text-center space-y-1 mb-8">
                    <p className="text-base text-black leading-relaxed">
                      We have sent a verification code to <br />
                      <span className="text-black font-bold tracking-tight">+91 {phoneNumber}</span>
                    </p>
                  </div>

                  <div className="flex justify-between gap-2 mt-4 px-2">
                    {[0, 1, 2, 3].map((i) => (
                      <input
                        key={i}
                        name={`otp-${i}`}
                        type="tel"
                        inputMode="numeric"
                        required
                        autoFocus={i === 0}
                        value={otp[i] || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 1)
                          setOtp(prev => {
                            const newOtp = prev.split("")
                            newOtp[i] = val
                            return newOtp.join("")
                          })
                          setError("") // Clear error on typing
                          if (val && i < 3) {
                            const nextInput = document.querySelector(`input[name="otp-${i + 1}"]`)
                            if (nextInput) nextInput.focus()
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace") {
                            if (!otp[i] && i > 0) {
                              document.querySelector(`input[name="otp-${i - 1}"]`)?.focus();
                            } else {
                              const newOtp = otp.split("");
                              newOtp[i] = "";
                              setOtp(newOtp.join(""));
                            }
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
                          if (pasteData) {
                            setOtp(pasteData);
                            setError("");
                          }
                        }}
                        disabled={blockTimer > 0}
                        className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-black rounded-xl outline-none transition-all ${blockTimer > 0
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : error
                            ? "border-2 border-red-500 bg-red-50 text-red-600"
                            : "bg-[#EBEBEB] border-2 border-transparent focus:border-[#EF4F5F] text-gray-900"
                          }`}
                        onFocus={(e) => {
                          e.target.select();
                        }}
                        placeholder="-"
                      />
                    ))}
                  </div>

                  {blockTimer > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                      <p className="text-[11px] font-bold text-[#EF4F5F] uppercase tracking-wider">
                        Too many failed attempts
                      </p>
                      <p className="text-sm font-bold text-[#ef4f5f]">
                        Try again after {Math.floor((blockTimer - 1) / 60)}:{String((blockTimer - 1) % 60).padStart(2, '0')}
                      </p>
                    </motion.div>
                  )}

                  {/* Inline Error Message */}
                  {error && !blockTimer && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center"
                    >
                      <p className="text-sm font-bold text-red-600">{error}</p>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                    <div className="group relative flex items-center bg-white rounded-2xl h-[56px] border border-gray-200 focus-within:ring-2 focus-within:ring-[#EF4F5F] focus-within:border-transparent transition-all shadow-sm">
                      <div className="pl-4 pr-3 border-r border-gray-100 mr-2 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-300 group-focus-within:text-[#EF4F5F] transition-colors" />
                      </div>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your name"
                        className="flex-1 bg-transparent border-none outline-none text-gray-900 text-lg font-bold placeholder:text-gray-300 w-full"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4 flex justify-center w-full">
                <button
                  type="submit"
                  disabled={loading || (step === 1 && (phoneNumber.length !== 10 || phoneFieldError)) || (step === 2 && blockTimer > 0)}
                  className={`bg-[#EF4F5F] hover:bg-[#D63948] text-white font-[900] text-sm tracking-wider uppercase h-[52px] px-8 sm:px-12 w-full rounded-[20px] shadow-[0_8px_25px_rgba(239,79,95,0.4)] hover:shadow-[0_12px_30px_rgba(239,79,95,0.6)] hover:-translate-y-1 transition-all flex items-center justify-center whitespace-nowrap ${(loading || (step === 1 && (phoneNumber.length !== 10 || phoneFieldError)) || (step === 2 && blockTimer > 0)) ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {loading ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : null}
                  {loading ? "VERIFYING..." : (step === 1 ? "Get Verification Code" : step === 2 ? "Verify" : "Complete Profile")}
                </button>
              </div>
            </form>

            {/* Resend OTP - Below Verify Button */}
            {step === 2 && (
              <div className="mt-6 text-center space-y-2">
                <p className="text-xs font-medium text-gray-500">Didn't get the OTP?</p>
                {blockTimer > 0 ? (
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">
                    RESEND SMS
                  </p>
                ) : resendTimer > 0 ? (
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">
                    RESEND SMS IN {formatTime(resendTimer)}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-xs font-black text-[#EF4F5F] hover:text-[#d63a4a] uppercase tracking-[0.2em] transition-colors"
                  >
                    RESEND SMS
                  </button>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="mt-8 text-center space-y-2 relative z-[100] pointer-events-auto">
                <p className="text-[10px] sm:text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em] leading-relaxed">
                  By continuing, you agree to our <br />
                  <Link to="/profile/terms" className="text-gray-900 underline cursor-pointer hover:text-[#ef4f5f] transition-colors relative z-50">Terms of Service</Link> & <Link to="/profile/privacy" className="text-gray-900 underline cursor-pointer hover:text-[#ef4f5f] transition-colors relative z-50">Privacy Policy</Link>
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </AnimatedPage>
  )
}
