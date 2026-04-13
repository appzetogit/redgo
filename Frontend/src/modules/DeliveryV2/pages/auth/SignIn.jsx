import { useState, useEffect } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import { deliveryAPI } from "@food/api"
import { clearModuleAuth } from "@food/utils/auth"
import { useCompanyName } from "@food/hooks/useCompanyName"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// Common country codes
const countryCodes = [
  { code: "+91", country: "IN", flag: "🇮🇳" },
]

export default function DeliverySignIn() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91",
  })

  // Pre-fill form from sessionStorage if data exists (e.g., when coming back from OTP)
  useEffect(() => {
    const stored = sessionStorage.getItem("deliveryAuthData")
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.phone) {
          // Extract digits after +91
          const phoneDigits = data.phone.replace("+91", "").trim()
          setFormData(prev => ({
            ...prev,
            phone: phoneDigits
          }))
        }
      } catch (err) {
        debugError("Error parsing stored auth data:", err)
      }
    }
  }, [])
  const [error, setError] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Get selected country details dynamically
  const selectedCountry = countryCodes.find(c => c.code === formData.countryCode) || countryCodes[2] // Default to India (+91)

  const validatePhone = (phone, countryCode) => {
    const digitsOnly = phone.replace(/\D/g, "")

    if (digitsOnly.length > 0 && !/^[6-9]/.test(digitsOnly)) {
      return "Enter a valid mobile number starting with 6–9"
    }

    return ""
  }

  const handleSendOTP = async () => {
    setError("")

    const phoneError = validatePhone(formData.phone, formData.countryCode)
    if (phoneError) {
      setError(phoneError)
      return
    }

    const fullPhone = `${formData.countryCode} ${formData.phone}`.trim()

    try {
      setIsSending(true)
      // Start a fresh login flow and prevent stale-token auto redirects.
      clearModuleAuth("delivery")

      // Call backend to send OTP for delivery login
      await deliveryAPI.sendOTP(fullPhone, "login")

      // Store auth data in sessionStorage for OTP page
      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        purpose: "login",
        module: "delivery",
      }
      sessionStorage.setItem("deliveryAuthData", JSON.stringify(authData))

      // Navigate to OTP page
      navigate("/delivery/otp")
    } catch (err) {
      debugError("Send OTP Error:", err)
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send OTP. Please try again."

      const lowerMsg = message.toLowerCase();
      // Improved detection for security block
      const isBlocked = lowerMsg.includes("blocked") || 
                        lowerMsg.includes("too many attempts") || 
                        lowerMsg.includes("try again after");

      if (isBlocked) {
        // Try to parse time: "3:43 minutes" or "5 minutes"
        let totalMins = 3;
        const timeMatch = message.match(/(\d+)(?::(\d+))?/);
        if (timeMatch) {
          const mins = parseInt(timeMatch[1]);
          const secs = timeMatch[2] ? parseInt(timeMatch[2]) / 60 : 0;
          totalMins = mins + (secs / 60);
        }

        const authData = {
          method: "phone",
          phone: fullPhone,
          isSignUp: false,
          purpose: "login",
          module: "delivery",
        }
        sessionStorage.setItem("deliveryAuthData", JSON.stringify(authData))
        navigate("/delivery/otp", { state: { initialBlockMins: totalMins } })
        return;
      }

      let displayMsg = message;
      if (lowerMsg.includes("timeout") || lowerMsg.includes("network error")) {
        displayMsg = "Server is not responding. Please try again later.";
      }
      setError(displayMsg);
    } finally {
      setIsSending(false)
    }
  }

  const handlePhoneChange = (e) => {
    // Only allow digits and limit to 10 digits
    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
    setFormData({
      ...formData,
      phone: value,
    })
    
    // Always update error on change if user has started typing
    if (value.length > 0) {
      setError(validatePhone(value, formData.countryCode))
    } else {
      setError("")
    }
  }

  const handleCountryCodeChange = (value) => {
    setFormData({
      ...formData,
      countryCode: value,
    })
  }

  const isValid = formData.phone.length === 10 && !validatePhone(formData.phone, formData.countryCode)

  return (
    <div className="max-h-screen h-screen bg-white flex flex-col">
      {/* Top Section - Logo and Badge */}
      <div className="flex flex-col items-center pt-8 pb-6 px-6">
        {/* Appzeto Logo */}
        <div>
          <h1 className="text-3xl text-black font-extrabold italic tracking-tight">
            {companyName}
          </h1>
        </div>

        {/* DELIVERY Badge */}
        <div className="bg-black px-6 py-2 rounded mt-2">
          <span className="text-white font-semibold text-sm uppercase tracking-wide">
            DELIVERY
          </span>
        </div>
      </div>

      {/* Main Content - Form Section */}
      <div className="flex-1 flex flex-col px-6">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Sign In Heading */}
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold text-black">
              Sign in to your account
            </h2>
            <p className="text-base text-gray-600">
              Login with your phone number
            </p>
          </div>

          {/* Mobile Number Input */}
          <div className="space-y-2 w-full">
            <div className="flex gap-2 items-stretch w-full">
              <div className="flex items-center px-4 h-12 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg shrink-0">
                <span className="flex items-center gap-2 text-base font-medium">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </span>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="Enter 10-digit mobile number"
                value={formData.phone}
                onChange={handlePhoneChange}
                autoComplete="off"
                autoFocus={false}
                className={`flex-1 h-12 px-4 text-gray-900 placeholder-gray-400 focus:outline-none text-base border rounded-lg min-w-0 ${error ? "border-[#EF4F5F] bg-red-50 text-[#EF4F5F]" : "border-gray-300"
                  }`}
              />
            </div>


            {error && (
              <div className="text-left w-full px-1">
                <p className="text-[12px] font-bold text-[#EF4F5F]">
                  {error}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section - Continue Button and Terms */}
      <div className="px-6 pb-8 pt-4">
        <div className="w-full max-w-md mx-auto space-y-4">
          {/* Continue Button */}
          <button
            onClick={handleSendOTP}
            disabled={!isValid || isSending}
            className={`w-full py-4 rounded-lg font-bold text-base transition-colors ${isValid && !isSending
              ? "bg-[#ef4f5f] hover:bg-[#d63a4a] active:bg-[#c03442] text-white"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
          >
            {isSending ? "Sending OTP..." : "Continue"}
          </button>

          {/* Terms and Conditions */}
          <p className="text-xs text-center text-gray-600 px-4">
            By continuing, you agree to our{" "}
            <Link to="/delivery/terms" className="text-blue-600 hover:underline">
              Terms and Conditions
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
