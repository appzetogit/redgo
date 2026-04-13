import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft, ShieldCheck, Timer, RefreshCw } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { toast } from "sonner"
import { restaurantAPI } from "@food/api"
import {
  setAuthData as setRestaurantAuthData,
  setRestaurantPendingPhone,
} from "@food/utils/auth"
import { checkOnboardingStatus, isRestaurantOnboardingComplete } from "@food/utils/onboardingUtils"
import { useCompanyName } from "@food/hooks/useCompanyName"

export default function RestaurantOTP() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const location = useLocation()
  const [otp, setOtp] = useState(["", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [contactInfo, setContactInfo] = useState("") 
  const [focusedIndex, setFocusedIndex] = useState(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [blockTimer, setBlockTimer] = useState(0) // Seconds remaining in block
  const inputRefs = useRef([])
  const hasSubmittedRef = useRef(false)
  const otpSectionRef = useRef(null)

  useEffect(() => {
    const stored = sessionStorage.getItem("restaurantAuthData")
    if (stored) {
      const data = JSON.parse(stored)
      setAuthData(data)

      if (data.method === "email" && data.email) {
        setContactInfo(data.email)
      } else if (data.phone) {
        const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
        if (phoneMatch) {
          const formattedPhone = `${phoneMatch[1]} ${phoneMatch[2].replace(/\D/g, "")}`
          setContactInfo(formattedPhone)
        } else {
          setContactInfo(data.phone || "")
        }
      }

      // 1. Resume Block Timer
      const savedBlockExpiry = sessionStorage.getItem("restaurant_block_expires_at");
      if (savedBlockExpiry) {
        const remaining = Math.max(0, Math.floor((parseInt(savedBlockExpiry) - Date.now()) / 1000));
        if (remaining > 0) {
          setBlockTimer(remaining);
          setError("Too many failed attempts");
        } else {
          sessionStorage.removeItem("restaurant_block_expires_at");
        }
      } else if (location.state?.initialBlockMins) {
        // Handle initial block from login
        const seconds = location.state.initialBlockMins * 60;
        setBlockTimer(seconds);
        setError("Too many failed attempts");
        sessionStorage.setItem("restaurant_block_expires_at", (Date.now() + (seconds * 1000)).toString());
      }

      // 2. Resume Resend Timer
      const savedResendExpiry = sessionStorage.getItem("restaurant_resend_expires_at");
      if (savedResendExpiry) {
        const remaining = Math.max(0, Math.floor((parseInt(savedResendExpiry) - Date.now()) / 1000));
        if (remaining > 0) {
          setResendTimer(remaining);
        } else {
          sessionStorage.removeItem("restaurant_resend_expires_at");
        }
      } else {
        // Only start a new timer if none exists
        setResendTimer(59);
        sessionStorage.setItem("restaurant_resend_expires_at", (Date.now() + (60 * 1000)).toString());
      }

    } else {
      navigate("/restaurant/login")
      return
    }
  }, [navigate, location])

  useEffect(() => {
    if (resendTimer <= 0) return
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendTimer])

  useEffect(() => {
    if (blockTimer <= 0) return
    const timer = setInterval(() => {
      setBlockTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [blockTimer])

  useEffect(() => {
    // Auto focus first input on mount or when block expires
    if (blockTimer <= 0) {
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [blockTimer])

  useEffect(() => {
    if (typeof window === "undefined") return

    const viewport = window.visualViewport
    if (!viewport) return

    const updateKeyboardState = () => {
      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height)
      setKeyboardOffset(keyboardHeight > 120 ? keyboardHeight : 0)
    }

    updateKeyboardState()
    viewport.addEventListener("resize", updateKeyboardState)
    viewport.addEventListener("scroll", updateKeyboardState)

    return () => {
      viewport.removeEventListener("resize", updateKeyboardState)
      viewport.removeEventListener("scroll", updateKeyboardState)
    }
  }, [])

  useEffect(() => {
    if (focusedIndex == null) return

    const targetInput = inputRefs.current[focusedIndex]
    if (!targetInput) return

    const id = window.setTimeout(() => {
      try {
        targetInput.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        })
        otpSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        })
      } catch {
        // no-op
      }
    }, 120)

    return () => window.clearTimeout(id)
  }, [focusedIndex, keyboardOffset])

  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("") // Clear error on typing
    setError("")

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newOtp.every((digit) => digit !== "") && newOtp.length === 4) {
      if (!hasSubmittedRef.current) {
        hasSubmittedRef.current = true
        handleVerify(newOtp.join(""))
      }
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        const newOtp = [...otp]
        newOtp[index] = ""
        setOtp(newOtp)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 4).split("")
        const newOtp = [...otp]
        digits.forEach((digit, i) => {
          if (i < 4) {
            newOtp[i] = digit
          }
        })
        setOtp(newOtp)
        if (digits.length === 4) {
          handleVerify(newOtp.join(""))
        } else {
          inputRefs.current[digits.length]?.focus()
        }
      })
    }
  }

  const handlePaste = (index, e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, 4).split("")
    const newOtp = [...otp]
    digits.forEach((digit, i) => {
      if (i < 4) {
        newOtp[i] = digit
      }
    })
    setOtp(newOtp)
    if (digits.length === 4) {
      handleVerify(newOtp.join(""))
    }
  }

  const handleVerify = async (otpValue = null) => {
    const code = otpValue || otp.join("")

    if (hasSubmittedRef.current && !otpValue) {
      // Allow only one manual click at a time
    }

    if (code.length !== 4) {
      setError("Please enter the complete 4-digit code")
      hasSubmittedRef.current = false
      return
    }

    setIsLoading(true)
    setError("")

    try {
      if (!authData) {
        throw new Error("Session expired. Please try logging in again.")
      }

      const phone = authData.method === "phone" ? authData.phone : null
      const email = authData.method === "email" ? authData.email : null
      const purpose = authData.isSignUp ? "register" : "login"

      const response = await restaurantAPI.verifyOTP(phone, code, purpose, null, email)
      const data = response?.data?.data || response?.data

      const needsRegistration = data?.needsRegistration === true
      const normalizedPhone = data?.phone || phone

      if (needsRegistration) {
        setRestaurantPendingPhone(normalizedPhone)
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")
        navigate("/restaurant/onboarding", { replace: true })
        return
      }

      const accessToken = data?.accessToken || data?.token
      const refreshToken = data?.refreshToken ?? null
      const restaurant = data?.user ?? data?.restaurant ?? data?.owner ?? data?.data?.user

      if (accessToken && restaurant) {
        setRestaurantAuthData("restaurant", accessToken, restaurant, refreshToken)
        
        window.dispatchEvent(new Event("restaurantAuthChanged"))
        sessionStorage.removeItem("restaurantAuthData")
        sessionStorage.removeItem("restaurantLoginPhone")
        sessionStorage.removeItem("restaurant_resend_expires_at")
        sessionStorage.removeItem("restaurant_block_expires_at")

        setTimeout(async () => {
          if (authData?.isSignUp) {
            navigate("/restaurant/onboarding", { replace: true })
          } else {
            try {
              const onboardingComplete = isRestaurantOnboardingComplete(restaurant)
              
              if (!onboardingComplete) {
                const incompleteStep = await checkOnboardingStatus()
                if (incompleteStep) {
                  navigate(`/restaurant/onboarding?step=${incompleteStep}`, { replace: true })
                  return
                }
              }
              navigate("/restaurant", { replace: true })
            } catch (err) {
              navigate("/restaurant", { replace: true })
            }
          }
        }, 500)
      } else {
        throw new Error("Invalid response from server. Please try again.")
      }
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Invalid OTP"

      if (message.toLowerCase().includes("blocked") || message.toLowerCase().includes("too many attempts")) {
        const match = message.match(/(\d+)/);
        if (match) {
          const mins = parseInt(match[0]);
          setBlockTimer(mins * 60);
          setError("Too many failed attempts");
        }
      } else if (/pending approval/i.test(message)) {
        const pendingPhone = authData?.phone || authData?.email || contactInfo
        setPendingMessage(message)
        setPhoneNumber(pendingPhone)
      } else {
        setError(message)
      }

      setOtp(["", "", "", ""])
      hasSubmittedRef.current = false
      if (blockTimer <= 0) {
        setTimeout(() => {
          inputRefs.current[0]?.focus()
        }, 50)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0 || blockTimer > 0) return

    setIsLoading(true)
    setError("")

    try {
      if (!authData) {
        throw new Error("Session expired. Please go back and try again.")
      }

      const purpose = authData.isSignUp ? "register" : "login"
      const phone = authData.method === "phone" ? authData.phone : null
      const email = authData.method === "email" ? authData.email : null

      await restaurantAPI.sendOTP(phone, purpose, email)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to resend OTP. Please try again."
      setError(message)
      setOtp(["", "", "", ""]) // Clear OTP fields
      
      // Auto-focus first input on error
      setTimeout(() => {
        const firstInput = document.querySelector('input[name="otp-0"]');
        if (firstInput) firstInput.focus();
      }, 10);
    }

    const expiry = Date.now() + (60 * 1000);
    sessionStorage.setItem("restaurant_resend_expires_at", expiry.toString());
    
    setResendTimer(59)
    setIsLoading(false)
    setOtp(["", "", "", ""])
    inputRefs.current[0]?.focus()
  }

  const isOtpComplete = otp.every((digit) => digit !== "")

  if (!authData) {
    return null
  }

  return (
    <div
      className={`h-[100dvh] bg-white flex flex-col font-sans ${keyboardOffset > 0 ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden"}`}
      style={{ 
        height: keyboardOffset ? `${window.visualViewport?.height || window.innerHeight}px` : "100dvh",
        paddingBottom: keyboardOffset ? "20px" : "0px"
      }}
    >
      {/* Curved Header Background */}
      <div className="relative h-[240px] sm:h-[300px] w-full bg-[#ef4f5f] overflow-hidden">
        {/* Abstract Circles like in the image */}
        <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute top-20 -right-10 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-white/5" />
        
        {/* The dominant curve */}
        <div className="absolute bottom-0 w-full h-[100px] bg-white rounded-t-[100px] shadow-[0_-20px_40px_rgba(0,0,0,0.05)]" />
        
        {/* Back Button */}
        <button
          onClick={() => {
            // Keep the data so it pre-fills the login page
            navigate("/restaurant/login", { replace: true });
          }}
          className="absolute top-10 sm:top-12 left-6 sm:left-8 p-2.5 sm:p-3 bg-white shadow-xl rounded-full text-[#ef4f5f] hover:scale-110 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 sm:px-8 -mt-12 sm:-mt-16 z-10 overflow-hidden">
        {/* Central Logo / Branding */}
        <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-slate-50 mb-4 sm:mb-6 overflow-hidden">
          <div className="text-center">
             <div className="w-16 h-16 bg-[#ef4f5f] rounded-2xl mx-auto flex items-center justify-center transform rotate-12 shadow-lg mb-1">
                <ShieldCheck className="w-8 h-8 text-white -rotate-12" />
             </div>
          </div>
        </div>

        <div className="text-center space-y-1 mb-8">
          <p className="text-base text-black leading-relaxed">
            We have sent a verification code to <br />
            <span className="text-black font-bold tracking-tight">{contactInfo}</span>
          </p>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify();
          }}
          className="w-full max-w-[400px] flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <div className="space-y-6">
            <div ref={otpSectionRef} className="flex justify-center gap-4">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={(e) => handlePaste(index, e)}
                  onFocus={() => setFocusedIndex(index)}
                  disabled={isLoading || blockTimer > 0}
                  required
                  className={`w-12 h-14 sm:w-14 sm:h-16 bg-slate-50 border-2 rounded-2xl text-center text-2xl font-black text-slate-900 focus:outline-none transition-all duration-300 ${
                    error || blockTimer > 0
                      ? "border-red-500 bg-red-50" 
                      : focusedIndex === index 
                        ? "border-[#ef4f5f] ring-4 ring-[#ef4f5f]/10 shadow-lg bg-white" 
                        : "border-slate-100"
                  } ${blockTimer > 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                />
              ))}
            </div>


              <div className="space-y-3">
                {blockTimer > 0 && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-center">
                      <p className="text-[10px] font-black text-[#EF4F5F] tracking-[0.2em] uppercase mb-1">Too many failed attempts</p>
                    <p className="text-sm font-black text-[#ef4f5f]">
                      Try again after {Math.floor((blockTimer - 1) / 60)}:{String((blockTimer - 1) % 60).padStart(2, '0')}
                    </p>
                  </div>
                )}

                {error && blockTimer <= 0 && (
                  <div className="text-center">
                    <p className="text-xs font-bold text-[#ef4f5f]">{error}</p>
                  </div>
                )}
                
                <Button
                  type="submit"
                  disabled={isLoading || blockTimer > 0}
                  className={`w-full h-14 sm:h-16 rounded-[32px] font-black text-base sm:text-lg tracking-widest uppercase shadow-lg transition-all duration-300 bg-[#ef4f5f] hover:bg-[#d63a4a] text-white shadow-[#ef4f5f]/20 transform active:scale-[0.98] ${
                    (isLoading || blockTimer > 0)
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {isLoading ? "VERIFYING..." : "VERIFY"}
                </Button>
              </div>

              <div className="flex flex-col items-center gap-1 mt-4">
                <p className="text-xs font-semibold text-slate-500">Didn't get the OTP?</p>
                {blockTimer > 0 ? (
                  <div className="flex items-center gap-2 text-slate-300 text-xs font-black tracking-[0.2em] uppercase">
                    RESEND SMS
                  </div>
                ) : resendTimer > 0 ? (
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-black tracking-widest uppercase">
                    RESEND SMS IN <span className="text-[#ef4f5f]">{resendTimer}S</span>
                  </div>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={isLoading}
                    className="flex items-center gap-2 text-[#ef4f5f] font-black text-xs tracking-[0.2em] uppercase hover:underline"
                  >
                    RESEND SMS
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

      <div className="py-3 text-center">
          <p className="text-[10px] font-black text-slate-300 tracking-[0.2em] uppercase">
            SECURE VERIFICATION SYSTEM &bull; {companyName.toUpperCase()}
          </p>
      </div>
    </div>
  )
}
