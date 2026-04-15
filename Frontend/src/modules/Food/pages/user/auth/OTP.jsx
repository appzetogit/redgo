import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, AlertCircle, Smartphone } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Input } from "@food/components/ui/input"
import { Button } from "@food/components/ui/button"
import { toast } from "sonner"
import { authAPI } from "@food/api"
import { setAuthData as setUserAuthData } from "@food/utils/auth"
import loginBanner from "@food/assets/restaurant/loginbanner1.png"

export default function OTP() {
  const navigate = useNavigate()
  const [otp, setOtp] = useState(["", "", "", ""]) // exactly 4 digits
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const [verifiedOtp, setVerifiedOtp] = useState("")
  const [contactInfo, setContactInfo] = useState("")
  const [contactType, setContactType] = useState("phone")
  const [deviceToken, setDeviceToken] = useState(null)
  const [activePlatform, setActivePlatform] = useState("web")
  const inputRefs = useRef([])
  const submittingRef = useRef(false)

  useEffect(() => {
    // Redirect to home if already authenticated
    const isAuthenticated = localStorage.getItem("user_authenticated") === "true"
    if (isAuthenticated) {
      navigate("", { replace: true })
      return
    }

    // Get auth data from sessionStorage
    const stored = sessionStorage.getItem("userAuthData")
    if (!stored) {
      // No auth data, redirect to sign in
      navigate("/auth/login", { replace: true })
      return
    }
    const data = JSON.parse(stored)
    setAuthData(data)

    // Handle both phone and email
    if (data.method === "email" && data.email) {
      setContactType("email")
      setContactInfo(data.email)
    } else if (data.phone) {
      setContactType("phone")
      // Extract and format phone number for display
      const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
      if (phoneMatch) {
        const formattedPhone = `${phoneMatch[1]}-${phoneMatch[2].replace(/\D/g, "")}`
        setContactInfo(formattedPhone)
      } else {
        setContactInfo(data.phone || "")
      }

      // OTP auto-fill removed - user must manually enter OTP
    }

    // Start resend timer (60 seconds)
    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [navigate])

  useEffect(() => {
    // Focus first input on mount
    if (!showNameInput) {
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showNameInput])

  const handleChange = (index, value) => {
    // Only allow digits; OTP is exactly 4 digits
    if (value && !/^\d$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("")

    // Auto-focus next input (4 boxes only)
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 4 digits are entered
    if (!showNameInput && newOtp.slice(0, 4).every((digit) => digit !== "")) {
      handleVerify(newOtp.slice(0, 4).join(""))
    }
  }

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace") {
      if (otp[index]) {
        // If current input has value, clear it
        const newOtp = [...otp]
        newOtp[index] = ""
        setOtp(newOtp)
      } else if (index > 0) {
        // If current input is empty, move to previous and clear it
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
    // Handle paste (4 digits only)
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 4).split("")
        const newOtp = [...otp]
        digits.forEach((digit, i) => {
          if (i < 4) newOtp[i] = digit
        })
        setOtp(newOtp)
        if (!showNameInput && digits.length === 4) {
          handleVerify(newOtp.slice(0, 4).join(""))
        } else {
          inputRefs.current[Math.min(digits.length, 3)]?.focus()
        }
      })
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, 4).split("")
    const newOtp = [...otp]
    digits.forEach((digit, i) => {
      if (i < 4) newOtp[i] = digit
    })
    setOtp(newOtp)
    if (!showNameInput && digits.length === 4) {
      handleVerify(newOtp.slice(0, 4).join(""))
    } else {
      inputRefs.current[Math.min(digits.length, 3)]?.focus()
    }
  }

  const handleVerify = async (otpValue = null) => {
    if (showNameInput) return
    if (submittingRef.current) return

    const code = (otpValue || otp.join("")).replace(/\D/g, "")
    const code4 = code.slice(0, 4)
    if (code4.length !== 4) {
      setError("OTP must be exactly 4 digits")
      return
    }

    submittingRef.current = true
    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"
      const providedName = authData?.isSignUp ? authData?.name || null : null
      const referralCode = authData?.referralCode || null

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
              } catch (e) {}
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e);
      }

      setDeviceToken(fcmToken);
      setActivePlatform(platform);

      const response = await authAPI.verifyOTP(
        phone,
        code4,
        purpose,
        providedName,
        email,
        "user",
        null,
        referralCode,
        fcmToken,
        platform
      )

      const resBody = response?.data || {}
      const resData = resBody.data || {}
      
      const accessToken = resData.accessToken || resBody.accessToken
      const refreshToken = resData.refreshToken || resBody.refreshToken || null
      const user = resData.user || resBody.user || resData.data?.user

      if (!user?.name || user?.name === "" || user?.isNewUser) {
        setVerifiedOtp(code4)
        setShowNameInput(true)
        setIsLoading(false)
        submittingRef.current = false
        return
      }

      // If we reach here, we MUST have tokens and a user
      if (!accessToken || !user) {
        throw new Error("Invalid response from server: tokens or user missing")
      }

      // Clear auth data from sessionStorage
      sessionStorage.removeItem("userAuthData")

      setUserAuthData("user", accessToken, user, refreshToken)

      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("userAuthChanged"))

      setSuccess(true)

      // Redirect to user home after short delay
      setTimeout(() => {
        navigate("")
      }, 500)
    } catch (err) {
      const status = err?.response?.status
      let message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to verify OTP. Please try again."
      if (status === 401) {
        message = "Invalid OTP"
      }
      toast.error(message)
      setOtp(["", "", "", ""])
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 50)
    } finally {
      setIsLoading(false)
      submittingRef.current = false
    }
  }

  const handleSubmitName = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Name is required")
      return
    }

    if (trimmedName.length < 2) {
      setNameError("Name must be at least 2 characters")
      return
    }

    if (!verifiedOtp) {
      setError("OTP verification step missing. Please request a new OTP.")
      return
    }

    setIsLoading(true)
    setError("")
    setNameError("")

    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"
      const referralCode = authData?.referralCode || null

      // Second call with name to auto-register and login
      const response = await authAPI.verifyOTP(
        phone,
        registrationToken ? null : verifiedOtp,
        purpose,
        trimmedName,
        email,
        "user",
        null,
        referralCode,
        deviceToken,
        activePlatform
      )
      const resBody = response?.data || {}
      const resData = resBody.data || {}
      
      const accessToken = resData.accessToken || resBody.accessToken
      const refreshToken = resData.refreshToken || resBody.refreshToken || null
      const user = resData.user || resBody.user || resData.data?.user

      if (!accessToken || !user) {
        throw new Error("Invalid response from server: registration complete but tokens missing")
      }

      sessionStorage.removeItem("userAuthData")

      setUserAuthData("user", accessToken, user, refreshToken)

      window.dispatchEvent(new Event("userAuthChanged"))

      setSuccess(true)

      setTimeout(() => {
        navigate("")
      }, 500)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to complete registration. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0 || isLoading) return

    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"

      // Call backend to resend OTP
      await authAPI.sendOTP(phone, purpose, email)
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to resend OTP. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }

    // Reset timer to 60 seconds
    setResendTimer(60)
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    setOtp(["", "", "", ""])
    setShowNameInput(false)
    setName("")
    setNameError("")
    setVerifiedOtp("")
    inputRefs.current[0]?.focus()
  }

  if (!authData) {
    return null
  }

  return (
    <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Background decoration (desktop only) */}
      <div className="fixed inset-0 z-0 hidden md:block opacity-40">
        <img src={loginBanner} alt="" className="w-full h-full object-cover blur-sm" />
        <div className="absolute inset-0 bg-white/60 dark:bg-black/80" />
      </div>

      <div className="w-full max-w-[450px] bg-white dark:bg-[#1a1a1a] rounded-xl shadow-2xl relative z-10 overflow-hidden border border-gray-100 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => navigate("/auth/login")}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
          <span className="ml-4 font-bold text-gray-900 dark:text-white">
            {showNameInput ? "Welcome!" : "OTP Verification"}
          </span>
        </div>

        <div className="p-6 sm:p-8 md:p-10 space-y-6 md:space-y-8">
          {/* Message */}
          <div className="text-center space-y-4">
            {showNameInput && (
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-[#EB590E]/10 rounded-full flex items-center justify-center">
                  <div className="w-10 h-10 bg-[#EB590E] rounded-full flex items-center justify-center shadow-lg shadow-[#EB590E]/30 text-white">
                    <Smartphone className="h-5 w-5" />
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                {showNameInput 
                  ? "Help us know you better" 
                  : contactType === "email"
                    ? "Verify your email"
                    : "Verify your phone"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                {showNameInput
                  ? "We're excited to have you join us! Please tell us your full name to get started."
                  : `We've sent a 4-digit code to ${contactInfo}`}
              </p>
            </div>
          </div>

          {/* OTP Input Fields */}
          {!showNameInput && (
            <div className="space-y-6">
              <div className="flex justify-between gap-3 sm:gap-4 max-w-[280px] mx-auto">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    disabled={isLoading}
                    aria-label={`OTP digit ${index + 1} of 4`}
                    className="w-12 h-12 sm:w-14 sm:h-14 text-center text-xl font-bold border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-[#EB590E] focus:ring-1 focus:ring-[#EB590E] bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white transition-all outline-none"
                  />
                ))}
              </div>


              {/* Resend Section */}
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Didn't get the OTP?{" "}
                  {resendTimer > 0 ? (
                    <span className="font-medium text-gray-900 dark:text-white">Retry in {resendTimer}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isLoading}
                      className="text-[#EB590E] hover:text-[#D94F0C] font-bold transition-colors disabled:opacity-50"
                    >
                      Resend SMS
                    </button>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Name Input */}
          {showNameInput && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (nameError) setNameError("")
                  }}
                  disabled={isLoading}
                  placeholder="Full Name"
                  className={`h-12 md:h-14 text-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white border-gray-300 dark:border-gray-700 rounded-xl focus-visible:ring-1 focus-visible:ring-[#EB590E] focus-visible:border-[#EB590E] ${nameError ? "border-red-500" : ""} transition-all`}
                />
                {nameError && (
                  <p className="text-xs text-red-500 pl-1">
                    {nameError}
                  </p>
                )}
              </div>

              <Button
                onClick={handleSubmitName}
                disabled={isLoading}
                className="w-full h-12 md:h-14 bg-[#EB590E] hover:bg-[#D94F0C] text-white font-bold text-lg rounded-xl transition-all hover:shadow-lg active:scale-[0.98]"
              >
                {isLoading ? "Getting things ready..." : "Finish Registration"}
              </Button>
            </div>
          )}

          {/* Verification Loading Overlay */}
          {isLoading && !showNameInput && (
            <div className="flex justify-center pt-2">
              <Loader2 className="h-6 w-6 text-[#EB590E] animate-spin" />
            </div>
          )}
        </div>
        
        {/* Footer info */}
        <div className="p-6 bg-gray-50 dark:bg-[#1f1f1f] text-center">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold">
                RedGo Delivery
            </p>
        </div>
      </div>
    </AnimatedPage>
  )
}
