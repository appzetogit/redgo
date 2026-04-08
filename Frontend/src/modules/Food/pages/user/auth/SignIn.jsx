import { useState, useEffect, useRef } from "react"
import { useNavigate, Link, useSearchParams } from "react-router-dom"
import { AlertCircle, Loader2 } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { authAPI } from "@food/api"
import quickSpicyLogo from "@food/assets/redgo-logo-transparent.png"

const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [formData, setFormData] = useState({
    phone: "",
    countryCode: "+91", // required; default +91 for India
  })

  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    const stored = sessionStorage.getItem("userAuthData")
    if (!stored) return

    try {
      const data = JSON.parse(stored)
      const fullPhone = String(data.phone || "").trim()
      const phoneDigits = fullPhone.replace(/^\+91\s*/, "").replace(/\D/g, "").slice(0, 10)

      setFormData((prev) => ({
        ...prev,
        phone: phoneDigits || prev.phone,
      }))
    } catch (err) {
      debugError("Error parsing stored auth data:", err)
    }
  }, [])

  const validatePhone = (phone) => {
    if (!phone.trim()) return "Phone number is required"
    const cleanPhone = phone.replace(/\D/g, "")
    if (!/^\d{10}$/.test(cleanPhone)) return "Phone number must be exactly 10 digits"
    return ""
  }

  const handleChange = (e) => {
    const { name } = e.target
    let { value } = e.target

    if (name === "phone") {
      value = value.replace(/\D/g, "").slice(0, 10)
      setError(validatePhone(value))
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const phoneError = validatePhone(formData.phone)
    setError(phoneError)
    if (phoneError) return
    if (submittingRef.current) return
    submittingRef.current = true
    setIsLoading(true)
    setError("")

    try {
      const countryCode = formData.countryCode?.trim() || "+91"
      const phoneDigits = String(formData.phone ?? "").replace(/\D/g, "").slice(0, 10)
      if (phoneDigits.length !== 10) {
        setError("Phone number must be exactly 10 digits")
        setIsLoading(false)
        submittingRef.current = false
        return
      }
      const fullPhone = `${countryCode} ${phoneDigits}`
      await authAPI.sendOTP(fullPhone, "login", null)

      const ref = String(searchParams.get("ref") || "").trim()
      const authData = {
        method: "phone",
        phone: fullPhone,
        email: null,
        name: null,
        referralCode: ref || null,
        isSignUp: false,
        module: "user",
      }

      sessionStorage.setItem("userAuthData", JSON.stringify(authData))
      navigate("/auth/otp")
    } catch (apiError) {
      const message =
        apiError?.response?.data?.message ||
        apiError?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
      submittingRef.current = false
    }
  }

  // Visual Assets
  const bowl1 = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80" // Veggie Salad
  const bowl2 = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80" // Mixed Salad
  const bowl3 = "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=500&q=80" // Walnut Salad

  return (
    <AnimatedPage className="min-h-screen bg-[#FFF9F0] flex relative font-sans overflow-hidden">

      {/* Background Lightning Bolts */}
      <svg className="absolute top-12 right-[20%] w-6 h-8 text-black opacity-80 z-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      <svg className="absolute bottom-[20%] right-[10%] w-6 h-8 text-[#F8A62B] opacity-80 z-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      <svg className="absolute top-[40%] right-[5%] w-4 h-6 text-black opacity-50 z-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      <svg className="absolute bottom-[5%] left-[60%] w-5 h-7 text-black opacity-80 z-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      <svg className="absolute top-[25%] left-[55%] w-6 h-8 text-black opacity-80 z-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      {/* Large faint leaf graphic behind form */}
      <div className="absolute right-[-10%] bottom-[-5%] w-[400px] h-[400px] opacity-10 pointer-events-none grayscale z-0">
        <img src={bowl1} alt="leaf" className="w-full h-full object-cover blur-sm" />
      </div>

      {/* Left Panel - Diagonal Graphic */}
      <div
        className="hidden lg:block absolute top-0 left-0 bottom-0 w-[55%] bg-[#F6A122] z-10"
        style={{ clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0 100%)' }}
      >
        {/* Outline abstract doodles */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path stroke="#000" strokeWidth="2" fill="none" d="M300,100 C400,200 200,400 400,600 C500,700 600,500 700,800" />
            <path stroke="#000" strokeWidth="2" fill="none" d="M150,50 C50,250 250,550 50,750" />
            <path stroke="#000" strokeWidth="2" fill="none" d="M800,200 C700,300 900,500 700,700" />
            <circle cx="200" cy="150" r="40" stroke="#000" strokeWidth="2" fill="none" />
            <circle cx="600" cy="850" r="60" stroke="#000" strokeWidth="2" fill="none" />
          </svg>
        </div>

        {/* The Dark Vertical Strip */}
        <div className="absolute top-0 left-0 bottom-0 w-[28%] bg-[#1A1A1A] z-20 shadow-2xl" />

        {/* Top Left Logo */}
        <div className="absolute top-6 left-6 z-30 flex items-center gap-2">
          <div className="w-10 h-10 bg-[#FFF] rounded-full flex items-center justify-center p-1">
            <img src={quickSpicyLogo} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col text-white">
            <span className="text-xl font-bold leading-none tracking-wide text-white font-serif">RedGo</span>
            <span className="text-[9px] uppercase tracking-[0.2em] opacity-80 leading-tight">Vegetarian</span>
          </div>
        </div>

        {/* The 3 Food Bowls positioned strategically */}
        <div className="absolute top-1/2 left-[14%] -translate-y-[45%] flex flex-col gap-6 z-30">
          <div className="relative transform -translate-x-6 z-30 hover:scale-105 transition-transform duration-500">
            <div className="w-[280px] h-[280px] rounded-full overflow-hidden border-[6px] border-[#1A1A1A] shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
              <img src={bowl1} alt="Bowl 1" className="w-full h-full object-cover" />
            </div>
            {/* Small floating leaves/accents could go here */}
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

      {/* Right Side - Form Container */}
      <div className="w-full lg:w-[45%] ml-auto min-h-screen flex flex-col justify-center items-center px-6 md:px-12 py-12 relative z-20">

        {/* Mobile Logo Fallback */}
        <div className="lg:hidden flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#F6A122] rounded-full flex items-center justify-center p-2 mb-2 shadow-lg">
            <img src={quickSpicyLogo} alt="Logo" className="w-full h-full object-contain filter brightness-0 invert" />
          </div>
          <h2 className="text-2xl font-black text-black">RedGo</h2>
        </div>

        <div className="w-full max-w-[360px] space-y-8">
          {/* Heading */}
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-[34px] font-[900] text-black tracking-widest uppercase">
              BINE AI REVENIT!
            </h1>
          </div>

          <form id="user-signin-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Form Input for Phone */}
            <div className="space-y-4">
              <div className="relative flex items-center bg-[#EBEBEB] rounded-full h-[52px] md:h-[56px] px-6 transition-all focus-within:ring-2 focus-within:ring-[#8AC34A] focus-within:bg-white shadow-sm hover:shadow">
                <span className="font-semibold text-gray-600 text-sm md:text-base border-r-2 border-gray-300 pr-3 mr-3 pt-0.5">
                  +91
                </span>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={handleChange}
                  className="flex-1 bg-transparent border-none text-gray-800 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 shadow-none text-sm md:text-base font-medium placeholder:text-gray-400 h-full"
                />
              </div>
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-500 pl-4">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Forgot password mimicking text */}
            <div className="flex justify-end px-2">
              <Link
                to="#"
                className="text-xs font-semibold text-[#8AC34A] hover:text-[#6a9937] transition-colors tracking-wide"
                onClick={(e) => e.preventDefault()}
              >
                Need help?
              </Link>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-center">
              <Button
                type="submit"
                form="user-signin-form"
                disabled={isLoading}
                className="bg-[#8AC34A] hover:bg-[#72A63B] text-black font-[800] text-sm tracking-wider uppercase h-[48px] px-12 rounded-[20px] shadow-[0_8px_20px_rgba(138,195,74,0.4)] hover:shadow-[0_10px_25px_rgba(138,195,74,0.6)] hover:-translate-y-0.5 transition-all w-[140px]"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
              </Button>
            </div>
          </form>

          {/* Registration link at the bottom matching 'Nu ai un cont existent? Inscrie-te' */}
          <div className="text-center mt-12 text-[13px] font-semibold tracking-wide text-gray-800">
            <span>Nu ai un cont existent? </span>
            <Link to="/auth/signup" className="text-[#8AC34A] hover:underline" onClick={(e) => { e.preventDefault(); navigate('/auth/signup') }}>
              Înscrie-te
            </Link>
          </div>

          <div className="text-center pt-8 text-[11px] font-medium text-gray-400">
            <p className="mb-2">BY CONTINUING, YOU AGREE TO OUR</p>
            <div className="flex justify-center gap-3">
              <Link to="/profile/terms" className="hover:text-gray-600 uppercase tracking-wider">Terms</Link>
              <span className="text-gray-300">•</span>
              <Link to="/profile/privacy" className="hover:text-gray-600 uppercase tracking-wider">Privacy</Link>
            </div>
          </div>

        </div>
      </div>
    </AnimatedPage>
  )
}

