import { useState, useEffect, useRef, useMemo, Fragment } from "react"
import { createPortal } from "react-dom"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { Plus, Minus, ArrowLeft, ChevronRight, Clock, MapPin, Phone, FileText, Utensils, Tag, Percent, Share2, ChevronUp, ChevronDown, X, Check, Settings, CreditCard, Wallet, Building2, Sparkles, Banknote, Zap, CheckCircle2, MessageCircle, Send, Mail, Copy, Navigation, ShoppingBag } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"

import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { useCart } from "@food/context/CartContext"
import { useProfile } from "@food/context/ProfileContext"
import { useOrders } from "@food/context/OrdersContext"
import { useLocation as useUserLocation } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"


import { orderAPI, restaurantAPI, adminAPI, userAPI, API_ENDPOINTS } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { initRazorpayPayment } from "@food/utils/razorpay"
import { toast } from "sonner"
import { getCompanyNameAsync } from "@food/utils/businessSettings"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import zoopSound from "@food/assets/audio/zomato_sms.mp3"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

/**
 * Format full address string from address object
 * @param {Object} address - Address object with street, additionalDetails, city, state, zipCode, or formattedAddress
 * @returns {String} Formatted address string
 */
const formatFullAddress = (address) => {
  if (!address) return ""

  const looksLikeLatLng = (s) => {
    if (!s) return false
    const v = String(s).trim()
    // Matches "12.34, 56.78" (lat,lng) with optional decimals/spaces
    return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(v)
  }

  // Priority 1: Use formattedAddress if available (for live location addresses)
  if (address.formattedAddress && address.formattedAddress !== "Select location") {
    if (!looksLikeLatLng(address.formattedAddress)) {
      return address.formattedAddress
    }
  }

  // Priority 2: Build address from parts
  const addressParts = []
  if (address.street) addressParts.push(address.street)
  if (address.additionalDetails) addressParts.push(address.additionalDetails)
  if (address.city) addressParts.push(address.city)
  if (address.state) addressParts.push(address.state)
  if (address.zipCode) addressParts.push(address.zipCode)

  if (addressParts.length > 0) {
    return addressParts.join(', ')
  }

  // Priority 3: Use address field if available
  if (address.address && address.address !== "Select location") {
    return address.address
  }

  return ""
}

const RUPEE_SYMBOL = "\u20B9"
const CART_RECIPIENT_DETAILS_STORAGE_KEY = "food-cart-recipient-details-v1"
const CART_ORDER_NOTE_STORAGE_KEY = "food-cart-order-note-v1"

export default function Cart() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const orderSuccessAudioRef = useRef(null)
  const hasRestoredRecipientRef = useRef(false)
  const hasRestoredNoteRef = useRef(false)

  // Defensive check: Ensure CartProvider is available
  let cartContext;
  try {
    cartContext = useCart();
  } catch (error) {
    debugError('? CartProvider not found. Make sure Cart component is rendered within UserLayout.');
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] dark:bg-[#0a0a0a]">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Cart Error</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Cart functionality is not available. Please refresh the page.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const location = useLocation();
  const path = location.pathname;
  const { cart, updateQuantity, addToCart, getCartCount, clearCart, cleanCartForRestaurant } = cartContext;
  const { userProfile, loading: profileLoading, addresses, paymentMethods, vegMode, setVegMode, orderType, setOrderType, openLocationSelector, getDefaultAddress, getDefaultPaymentMethod } = useProfile()
  const isTakeaway = orderType === "takeaway" || orderType === "pickup"




  const { location: currentLocation, loading: currentLocationLoading } = useUserLocation()

  const [showCoupons, setShowCoupons] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponCode, setCouponCode] = useState("")
  const [manualCouponCode, setManualCouponCode] = useState("")
  // Default to razorpay for takeaway (safe), cash for delivery. API will correct after load.
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(() => {
    const cartMode = localStorage.getItem("food-cart-mode") || localStorage.getItem("userOrderType") || "delivery"
    return cartMode === "takeaway" ? "razorpay" : "cash"
  })
  const [showPaymentSheet, setShowPaymentSheet] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [isLoadingWallet, setIsLoadingWallet] = useState(false)
  const [note, setNote] = useState(() => {
    try {
      if (typeof window === "undefined") return ""
      const raw = window.localStorage.getItem(CART_ORDER_NOTE_STORAGE_KEY)
      if (!raw) return ""
      const stored = JSON.parse(raw)
      return String(stored?.note || "")
    } catch {
      return ""
    }
  })
  const [showNoteInput, setShowNoteInput] = useState(() => {
    try {
      if (typeof window === "undefined") return false
      const raw = window.localStorage.getItem(CART_ORDER_NOTE_STORAGE_KEY)
      if (!raw) return false
      const stored = JSON.parse(raw)
      const storedNote = String(stored?.note || "")
      return Boolean(stored?.showNoteInput) || storedNote.trim().length > 0
    } catch {
      return false
    }
  })
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharePayload, setSharePayload] = useState(null)
  const [isEditingRecipient, setIsEditingRecipient] = useState(false)
  const [recipientDetails, setRecipientDetails] = useState({
    name: "",
    phone: "",
  })

  const [sendCutlery, setSendCutlery] = useState(true)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [showBillDetails, setShowBillDetails] = useState(true)
  const [showPlacingOrder, setShowPlacingOrder] = useState(false)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  const [orderProgress, setOrderProgress] = useState(0)
  const [showOrderSuccess, setShowOrderSuccess] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState(null)
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [deliveryAddressMode, setDeliveryAddressMode] = useState(() => {
    try {
      if (typeof window === "undefined") return "saved"
      return localStorage.getItem("deliveryAddressMode") || "saved"
    } catch {
      return "saved"
    }
  })

  useEffect(() => {
    const audio = new Audio(zoopSound)
    audio.preload = "auto"
    audio.volume = 0.8
    orderSuccessAudioRef.current = audio

    return () => {
      if (orderSuccessAudioRef.current) {
        orderSuccessAudioRef.current.pause()
        orderSuccessAudioRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!showOrderSuccess || !orderSuccessAudioRef.current) return

    orderSuccessAudioRef.current.currentTime = 0
    orderSuccessAudioRef.current.play().catch((error) => {
      debugWarn("Order success sound blocked by browser:", error?.message || error)
    })
  }, [showOrderSuccess])

  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(false)
  // null = not yet loaded from API, true = enabled, false = disabled
  const [adminTakeawayCodEnabled, setAdminTakeawayCodEnabled] = useState(null)
  const [pricing, setPricing] = useState(null)
  const [loadingPricing, setLoadingPricing] = useState(false)
  const [addons, setAddons] = useState([])
  const [loadingAddons, setLoadingAddons] = useState(false)
  const [availableCoupons, setAvailableCoupons] = useState([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)
  const [userOrderCount, setUserOrderCount] = useState(0)

  const [feeSettings, setFeeSettings] = useState({
    deliveryFee: 25,
    deliveryFeeRanges: [],
    freeDeliveryThreshold: 149,
    platformFee: 5,
    gstRate: 5,
  })

  const availableTimeSlots = useMemo(() => {
    if (!isScheduled || !scheduledDate || !restaurantData) return []

    try {
      const targetDate = new Date(scheduledDate)
      const status = getRestaurantAvailabilityStatus(restaurantData, targetDate)

      let openingHour = 9
      let closingHour = 22

      if (status.openingTime) {
        const [h] = status.openingTime.split(':')
        openingHour = parseInt(h, 10)
      }

      if (status.closingTime) {
        const [h] = status.closingTime.split(':')
        closingHour = parseInt(h, 10)
      }

      if (closingHour < openingHour) {
        closingHour += 24
      }

      const slots = []
      const now = new Date()
      const nowStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
      const targetStr = scheduledDate
      const isToday = targetStr === nowStr
      const currentHour = now.getHours()

      for (let h = openingHour; h <= closingHour; h++) {
        const actualHour = h % 24
        if (isToday && h <= currentHour) continue

        const period = actualHour >= 12 ? 'PM' : 'AM'
        const display12 = actualHour % 12 || 12
        const timeString = `${String(actualHour).padStart(2, '0')}:00`
        const displayString = `${display12}:00 ${period}`

        slots.push({ value: timeString, label: displayString })
      }

      return slots
    } catch {
      return []
    }
  }, [isScheduled, scheduledDate, restaurantData])

  useEffect(() => {
    if (isScheduled && availableTimeSlots.length > 0) {
      const isValid = availableTimeSlots.some(slot => slot.value === scheduledTime)
      if (!isValid) {
        setScheduledTime(availableTimeSlots[0].value)
      }
    } else if (!isScheduled) {
      setScheduledDate("")
      setScheduledTime("")
    }
  }, [isScheduled, availableTimeSlots, scheduledTime])

  const cartCount = getCartCount()
  const getAddressId = (address) => address?.id || address?._id || null
  const normalizeAddressLabel = (label) => {
    if (!label) return ""
    const value = String(label).trim().toLowerCase()
    if (value === "work" || value === "office") return "office"
    if (value === "home") return "home"
    if (value === "other") return "other"
    return value
  }
  const getDisplayAddressLabel = (label) => {
    const normalized = normalizeAddressLabel(label)
    if (normalized === "office") return "Work"
    if (normalized === "home") return "Home"
    if (normalized === "other") return "Other"
    return label || "Saved address"
  }
  const sanitizeRecipientPhone = (value) => String(value || "").replace(/[^\d+]/g, "").slice(0, 14)
  const savedAddress = getDefaultAddress()
  const selectedAddress = addresses.find((addr) => getAddressId(addr) && getAddressId(addr) === selectedAddressId)

  const currentLocationAddress = useMemo(() => {
    let locFromStorage = null
    try {
      const storedRaw = localStorage.getItem("userLocation")
      locFromStorage = storedRaw ? JSON.parse(storedRaw) : null
    } catch {
      locFromStorage = null
    }

    const loc = currentLocation?.latitude && currentLocation?.longitude ? currentLocation : locFromStorage
    if (!loc?.latitude || !loc?.longitude) return null

    const formattedAddress = loc?.formattedAddress || loc?.address || ""
    if (!formattedAddress || formattedAddress === "Select location") return null

    return {
      label: "Home",
      formattedAddress,
      address: formattedAddress,
      street: loc?.street || loc?.address || loc?.area || "Current Location",
      additionalDetails: loc?.area || "",
      city: loc?.city || loc?.area || "Current City",
      state: loc?.state || loc?.city || "Current State",
      zipCode: loc?.postalCode || loc?.zipCode || "",
      phone: userProfile?.phone || "",
      location: {
        type: "Point",
        coordinates: [loc.longitude, loc.latitude],
      },
    }
  }, [currentLocation, userProfile?.phone, deliveryAddressMode])

  const defaultAddress = useMemo(() => {
    return deliveryAddressMode === "current"
      ? currentLocationAddress || selectedAddress || savedAddress || null
      : selectedAddress || savedAddress || currentLocationAddress || null
  }, [deliveryAddressMode, currentLocationAddress, selectedAddress, savedAddress])

  const hasSavedAddress = Boolean(defaultAddress && formatFullAddress(defaultAddress))
  const recipientName = String(recipientDetails.name || "").trim() || userProfile?.name || "Your Name"
  const recipientPhone = sanitizeRecipientPhone(recipientDetails.phone || "") || userProfile?.phone || ""
  const selectedAddressCoordinates = defaultAddress?.location?.coordinates
  const zoneLocation = selectedAddressCoordinates?.length === 2
    ? {
      latitude: selectedAddressCoordinates[1],
      longitude: selectedAddressCoordinates[0]
    }
    : currentLocation
  const { zoneId } = useZone(zoneLocation)
  const defaultPayment = getDefaultPaymentMethod()

  useEffect(() => {
    try {
      const mode = localStorage.getItem("deliveryAddressMode") || "saved"
      setDeliveryAddressMode((prev) => (prev === mode ? prev : mode))
    } catch { }
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(CART_RECIPIENT_DETAILS_STORAGE_KEY)
      if (!raw) {
        hasRestoredRecipientRef.current = true
        return
      }
      const stored = JSON.parse(raw)
      setRecipientDetails({
        name: stored?.name || "",
        phone: sanitizeRecipientPhone(stored?.phone || ""),
      })
      setIsEditingRecipient(Boolean(stored?.isEditingRecipient))
    } catch {
      setRecipientDetails({ name: "", phone: "" })
      setIsEditingRecipient(false)
    } finally {
      hasRestoredRecipientRef.current = true
    }
  }, [])

  useEffect(() => {
    setRecipientDetails((prev) => ({
      name: prev.name || userProfile?.name || "",
      phone: prev.phone || userProfile?.phone || "",
    }))
  }, [userProfile?.name, userProfile?.phone])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!hasRestoredRecipientRef.current) return
    try {
      window.localStorage.setItem(
        CART_RECIPIENT_DETAILS_STORAGE_KEY,
        JSON.stringify({
          name: recipientDetails.name || "",
          phone: sanitizeRecipientPhone(recipientDetails.phone || ""),
          isEditingRecipient,
        })
      )
    } catch { }
  }, [recipientDetails, isEditingRecipient])

  useEffect(() => {
    hasRestoredNoteRef.current = true
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!hasRestoredNoteRef.current) return
    try {
      window.localStorage.setItem(
        CART_ORDER_NOTE_STORAGE_KEY,
        JSON.stringify({ note, showNoteInput })
      )
    } catch { }
  }, [note, showNoteInput])

  useEffect(() => {
    if (deliveryAddressMode === "current") {
      setSelectedAddressId(null)
    }
  }, [deliveryAddressMode])

  useEffect(() => {
    const defaultId = getAddressId(savedAddress)
    if (deliveryAddressMode !== "current" && !selectedAddressId && defaultId) {
      setSelectedAddressId(defaultId)
    }
  }, [savedAddress, selectedAddressId, deliveryAddressMode])

  const restaurantId = cart.length > 0
    ? (restaurantData?._id || restaurantData?.restaurantId || cart[0]?.restaurantId || null)
    : null

  useEffect(() => {
    if (showPlacingOrder || showOrderSuccess) {
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.top = `-${window.scrollY}px`
      window.scrollTo({ top: 0, behavior: 'instant' })
    } else {
      const scrollY = document.body.style.top
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1)
      }
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
    }
  }, [showPlacingOrder, showOrderSuccess])

  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (cart.length === 0) {
        setRestaurantData(null)
        return
      }
      if (restaurantData) return
      setLoadingRestaurant(true)
      if (cart[0]?.restaurantId) {
        try {
          const cartRestaurantId = cart[0].restaurantId;
          const response = await restaurantAPI.getRestaurantById(cartRestaurantId)
          const data = response?.data?.data?.restaurant || response?.data?.restaurant
          if (data) {
            setRestaurantData(data)
            setLoadingRestaurant(false)
            return
          }
        } catch (error) { }
      }
      if (cart[0]?.restaurant && !restaurantData) {
        try {
          const searchResponse = await restaurantAPI.getRestaurants({ limit: 100 })
          const restaurants = searchResponse?.data?.data?.restaurants || searchResponse?.data?.data || []
          let matchingRestaurant = restaurants.find(r =>
            r.name?.toLowerCase().trim() === cart[0].restaurant?.toLowerCase().trim()
          )
          if (!matchingRestaurant) {
            matchingRestaurant = restaurants.find(r =>
              r.name?.toLowerCase().includes(cart[0].restaurant?.toLowerCase().trim()) ||
              cart[0].restaurant?.toLowerCase().trim().includes(r.name?.toLowerCase())
            )
          }
          if (matchingRestaurant) {
            setRestaurantData(matchingRestaurant)
            setLoadingRestaurant(false)
            return
          }
        } catch (searchError) { }
      }
      setRestaurantData(null)
      setLoadingRestaurant(false)
    }
    fetchRestaurantData()
  }, [cart.length, cart[0]?.restaurantId, cart[0]?.restaurant])

  useEffect(() => {
    const fetchAddonsWithId = async (idToUse) => {
      const idString = String(idToUse)
      const isValidIdFormat = /^[a-zA-Z0-9\-_]+$/.test(idString) && idString.length >= 3
      if (!isValidIdFormat) {
        setAddons([])
        return
      }
      try {
        setLoadingAddons(true)
        const response = await restaurantAPI.getAddonsByRestaurantId(idString)
        const data = response?.data?.data?.addons || response?.data?.addons || []
        setAddons(data)
      } catch (error) {
        setAddons([])
      } finally {
        setLoadingAddons(false)
      }
    }
    const fetchAddons = async () => {
      if (cart.length === 0) {
        setAddons([])
        return
      }
      if (loadingRestaurant) return
      if (!restaurantData) {
        setAddons([])
        return
      }
      const idToUse = restaurantData._id || restaurantData.restaurantId
      if (!idToUse) {
        setAddons([])
        return
      }
      fetchAddonsWithId(idToUse)
    }
    fetchAddons()
  }, [restaurantData, cart.length, loadingRestaurant])

  useEffect(() => {
    const fetchCouponsForCartItems = async () => {
      if (cart.length === 0 || !restaurantId) {
        setAvailableCoupons([])
        return
      }
      setLoadingCoupons(true)
      const allCoupons = []
      const uniqueCouponCodes = new Set()
      for (const cartItem of cart) {
        const couponItemId = cartItem.itemId || cartItem.id
        if (!couponItemId) continue
        try {
          const response = await restaurantAPI.getCouponsByItemIdPublic(restaurantId, couponItemId)
          if (response?.data?.success && response?.data?.data?.coupons) {
            const coupons = response.data.data.coupons
            coupons.forEach(coupon => {
              if (!uniqueCouponCodes.has(coupon.couponCode)) {
                uniqueCouponCodes.add(coupon.couponCode)
                allCoupons.push({
                  code: coupon.couponCode,
                  discount: coupon.originalPrice - coupon.discountedPrice,
                  discountPercentage: coupon.discountPercentage,
                  discountDisplay: coupon.discountType === "percentage"
                    ? `${coupon.discountPercentage}% OFF`
                    : `${RUPEE_SYMBOL}${Math.max(0, (coupon.originalPrice || 0) - (coupon.discountedPrice || 0))} OFF`,
                  minOrder: coupon.minOrderValue || 0,
                  description: coupon.discountType === "percentage"
                    ? `${coupon.discountPercentage}% OFF with '${coupon.couponCode}'`
                    : `Save ${RUPEE_SYMBOL}${Math.max(0, (coupon.originalPrice || 0) - (coupon.discountedPrice || 0))} with '${coupon.couponCode}'`,
                  originalPrice: coupon.originalPrice,
                  discountedPrice: coupon.discountedPrice,
                  customerGroup: coupon.customerGroup || "all",
                  isGlobalCoupon: Boolean(coupon.isGlobalCoupon),
                  itemId: couponItemId,
                  itemName: cartItem.name,
                })
              }
            })
          }
        } catch (error) { }
      }
      setAvailableCoupons(allCoupons)
      setLoadingCoupons(false)
    }
    fetchCouponsForCartItems()
  }, [cart, restaurantId])

  useEffect(() => {
    const calculatePricing = async () => {
      if (cart.length === 0 || !hasSavedAddress) {
        setPricing(null)
        return
      }
      try {
        setLoadingPricing(true)
        const items = cart.map(item => ({
          itemId: item.itemId || item.id,
          name: item.name,
          price: item.price,
          variantId: item.variantId || undefined,
          variantName: item.variantName || undefined,
          variantPrice: item.variantPrice || item.price,
          quantity: item.quantity || 1,
          image: item.image,
          description: item.description,
          isVeg: item.isVeg !== false
        }))
        const resolvedRestaurantId = restaurantData?.restaurantId || restaurantData?._id || restaurantId || undefined
        const resolvedCouponCode = appliedCoupon?.code || couponCode || undefined
        const response = await orderAPI.calculateOrder({
          items,
          restaurantId: resolvedRestaurantId,
          deliveryAddress: defaultAddress,
          couponCode: resolvedCouponCode,
          orderType: isTakeaway ? "takeaway" : (orderType || "delivery")
        })
        if (response?.data?.success && response?.data?.data?.pricing) {
          setPricing(response.data.data.pricing)
          if (response.data.data.pricing.appliedCoupon && !appliedCoupon) {
            const coupon = availableCoupons.find(c => c.code === response.data.data.pricing.appliedCoupon.code)
            if (coupon) setAppliedCoupon(coupon)
          }
        }
      } catch (error) {
        setPricing(null)
      } finally {
        setLoadingPricing(false)
      }
    }
    calculatePricing()
  }, [cart, defaultAddress, appliedCoupon, couponCode, restaurantId, orderType])

  useEffect(() => {
    const fetchWalletBalance = async () => {
      try {
        setIsLoadingWallet(true)
        const response = await userAPI.getWallet()
        if (response?.data?.success && response?.data?.data?.wallet) {
          setWalletBalance(response.data.data.wallet.balance || 0)
        }
      } catch (error) {
        setWalletBalance(0)
      } finally {
        setIsLoadingWallet(false)
      }
    }
    fetchWalletBalance()
  }, [])

  useEffect(() => {
    const fetchTakeawayCodStatus = async () => {
      try {
        const response = await orderAPI.getTakeawayCodStatus()
        const enabled = response?.data?.data?.takeaway_cod_enabled
        // Explicit boolean from API - if response is weird, default to false (safe)
        setAdminTakeawayCodEnabled(enabled === true)
      } catch (_error) {
        // On API failure: default false for takeaway (safe), don't block non-takeaway users
        setAdminTakeawayCodEnabled(false)
      }
    }
    fetchTakeawayCodStatus()

    // One-time migration: if cart has items but food-cart-mode key missing, set it now
    if (cart.length > 0 && !localStorage.getItem("food-cart-mode")) {
      const currentMode = localStorage.getItem("userOrderType") || orderType || "delivery"
      localStorage.setItem("food-cart-mode", currentMode)
    }
  }, [])

  useEffect(() => {
    const fetchOrderCount = async () => {
      try {
        const response = await userAPI.getOrders({ page: 1, limit: 1 })
        if (response?.data?.success) {
          setUserOrderCount(response?.data?.data?.pagination?.total || 0)
        }
      } catch (error) {
        setUserOrderCount(0)
      }
    }
    fetchOrderCount()
  }, [])

  useEffect(() => {
    const fetchFeeSettings = async () => {
      try {
        const response = await adminAPI.getPublicFeeSettings()
        if (response.data.success && response.data.data.feeSettings) {
          setFeeSettings({
            deliveryFee: response.data.data.feeSettings.deliveryFee || 25,
            deliveryFeeRanges: response.data.data.feeSettings.deliveryFeeRanges || [],
            freeDeliveryThreshold: response.data.data.feeSettings.freeDeliveryThreshold || 149,
            platformFee: response.data.data.feeSettings.platformFee || 5,
            gstRate: response.data.data.feeSettings.gstRate || 5,
          })
        }
      } catch (error) { }
    }
    const handleFocus = () => fetchFeeSettings()
    fetchFeeSettings()
    window.addEventListener("focus", handleFocus)
    const intervalId = setInterval(fetchFeeSettings, 30000)
    return () => {
      window.removeEventListener("focus", handleFocus)
      clearInterval(intervalId)
    }
  }, [])

  const subtotal = pricing?.subtotal || cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)
  const fallbackDeliveryFee = (() => {
    if (appliedCoupon?.freeDelivery) return 0
    const ranges = Array.isArray(feeSettings.deliveryFeeRanges) ? [...feeSettings.deliveryFeeRanges] : []
    if (ranges.length > 0) {
      const sortedRanges = ranges.sort((a, b) => Number(a.min) - Number(b.min))
      for (let i = 0; i < sortedRanges.length; i++) {
        const range = sortedRanges[i]
        const inRange = i === sortedRanges.length - 1 ? subtotal >= range.min && subtotal <= range.max : subtotal >= range.min && subtotal < range.max
        if (inRange) return Number(range.fee)
      }
      return 0
    }
    if (isTakeaway) return 0
    if (subtotal >= feeSettings.freeDeliveryThreshold) return 0
    return Number(feeSettings.deliveryFee || 0)
  })()
  // For takeaway: always force delivery fee to 0, regardless of what pricing API returns
  const deliveryFee = isTakeaway ? 0 : (pricing?.deliveryFee ?? fallbackDeliveryFee)
  const deliveryFeeBreakdownText = !isTakeaway && pricing?.deliveryFeeBreakdown?.source === "distance"
    ? `Distance ${Number(pricing.deliveryFeeBreakdown.distanceKm).toFixed(1)} km: ${RUPEE_SYMBOL}${Number(pricing.deliveryFeeBreakdown.basePayout || 0).toFixed(0)} base + ${Number(pricing.deliveryFeeBreakdown.extraDistanceKm || 0).toFixed(1)} km x ${RUPEE_SYMBOL}${Number(pricing.deliveryFeeBreakdown.commissionPerKm || 0).toFixed(0)}`
    : null
  const platformFee = pricing?.platformFee || feeSettings.platformFee
  const gstCharges = pricing?.tax || Math.round(subtotal * (feeSettings.gstRate / 100))
  const discount = pricing?.discount || (appliedCoupon ? Math.min(appliedCoupon.discount, subtotal * 0.5) : 0)
  const totalBeforeDiscount = subtotal + deliveryFee + platformFee + gstCharges
  // For takeaway: recalculate total without delivery fee even if pricing API returned one
  const total = isTakeaway
    ? (subtotal + platformFee + gstCharges - discount)
    : (pricing?.total || (totalBeforeDiscount - discount))
  const savings = pricing?.savings ?? Math.max(0, totalBeforeDiscount - total)
  const selectedPaymentLabel = selectedPaymentMethod === "wallet" ? "Quick Wallet" : selectedPaymentMethod === "razorpay" ? "Online Payment" : "Cash on Delivery"
  // showTakeawayCOD: false while API loading (null), false if disabled, true if enabled
  // Safe default: restrict COD until API confirms it's allowed
  const showTakeawayCOD = adminTakeawayCodEnabled === true

  useEffect(() => {
    // If in takeaway and COD is disabled, auto-switch off cash to online
    if (isTakeaway && !showTakeawayCOD && adminTakeawayCodEnabled !== null && selectedPaymentMethod === "cash") {
      setSelectedPaymentMethod("razorpay")
    }
  }, [isTakeaway, showTakeawayCOD, adminTakeawayCodEnabled, selectedPaymentMethod])

  const restaurantName = restaurantData?.name || cart[0]?.restaurant || "Restaurant"

  const handleShare = async () => {
    const payload = {
      title: `My Cart at ${restaurantName}`,
      text: `Check out what I'm ordering from ${restaurantName}! ${window.location.href}`,
      url: window.location.href,
    }
    if (isMobileDevice()) {
      setSharePayload(payload)
      setShowShareModal(true)
      return
    }
    if (navigator.share) {
      try {
        await navigator.share(payload)
        toast.success("Shared successfully")
        return
      } catch { }
    }
    setSharePayload(payload)
    setShowShareModal(true)
  }

  const isMobileDevice = () => /Android|iPhone|iPad|iPod|Windows Phone|Opera Mini|IEMobile/i.test(navigator.userAgent) || window.matchMedia?.("(max-width: 768px)")?.matches

  const handleBack = () => {
    // Use navigate(-1) to go back in browser history - avoids pushing a new route
    // which would cause restaurant's back button to incorrectly return to cart
    navigate(-1)
  }

  const handleSelectAddressByLabel = async (label) => {
    const targetLabel = normalizeAddressLabel(label)
    const address = addresses.find(addr => normalizeAddressLabel(addr.label) === targetLabel)
    if (!address) {
      toast.error(`No ${label} address found.`)
      return
    }
    handleSelectSavedAddress(address)
  }

  const handleSelectSavedAddress = async (address) => {
    try {
      const addressId = getAddressId(address)
      if (addressId) {
        setSelectedAddressId(addressId)
        setDefaultAddress(addressId)
      }
      const coordinates = address.location?.coordinates || []
      await userAPI.updateLocation({
        latitude: coordinates[1],
        longitude: coordinates[0],
        address: `${address.street}, ${address.city}`,
        city: address.city,
        state: address.state,
        area: address.additionalDetails || "",
        formattedAddress: formatFullAddress(address)
      })
      localStorage.setItem("deliveryAddressMode", "saved")
      setDeliveryAddressMode("saved")
      toast.success(`${address.label || "Saved"} address selected!`)
    } catch (error) {
      toast.error("Failed to select address")
    }
  }

  const handleApplyCoupon = async (coupon) => {
    if (coupon?.customerGroup === "new" && userOrderCount > 0) {
      toast.error("For first-time users only")
      return
    }
    if (subtotal < (Number(coupon.minOrder) || 0)) {
      toast.error(`Min order ${RUPEE_SYMBOL}${coupon.minOrder}`)
      return
    }
    setAppliedCoupon(coupon)
    setCouponCode(coupon.code)
    setShowCoupons(false)
  }

  const handleApplyCouponCode = async () => {
    const inputCode = manualCouponCode.trim().toUpperCase()
    if (!inputCode) return
    const matchedCoupon = availableCoupons.find(c => c.code === inputCode)
    if (matchedCoupon) handleApplyCoupon(matchedCoupon)
    else toast.error("Invalid coupon code")
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode("")
    setManualCouponCode("")
  }

  const handlePlaceOrder = async () => {
    if (!hasSavedAddress) {
      toast.error("Select delivery location")
      openLocationSelector()
      return
    }
    setIsPlacingOrder(true)
    try {
      const finalRestaurantId = restaurantData?.restaurantId || restaurantData?._id || null;
      if (!finalRestaurantId) throw new Error("Restaurant missing")

      const orderPayload = {
        items: cart.map(item => ({
          itemId: item.itemId || item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          variantId: item.variantId,
          variantName: item.variantName
        })),
        address: {
          ...defaultAddress,
          phone: recipientPhone || defaultAddress?.phone || "",
          name: recipientName
        },
        restaurantId: finalRestaurantId,
        pricing: pricing || { subtotal, deliveryFee, tax: gstCharges, platformFee, discount, total, couponCode: appliedCoupon?.code },
        paymentMethod: selectedPaymentMethod,
        orderType: isTakeaway ? "takeaway" : (orderType || "delivery"),
        scheduledAt: isScheduled ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString() : undefined,
        note
      }

      if (selectedPaymentMethod === "wallet" && walletBalance < total) {
        toast.error("Insufficient wallet balance")
        setIsPlacingOrder(false)
        return
      }

      const response = await orderAPI.createOrder(orderPayload)
      const { order, razorpay } = response.data.data

      if (selectedPaymentMethod === "cash" || selectedPaymentMethod === "wallet") {
        setPlacedOrderId(order._id || order.id)
        setShowOrderSuccess(true)
        clearCart()
        setIsPlacingOrder(false)
        return
      }

      if (razorpay) {
        await initRazorpayPayment({
          key: razorpay.key,
          amount: razorpay.amount,
          order_id: razorpay.orderId,
          name: companyName,
          prefill: { name: recipientName, email: userProfile?.email || "", contact: recipientPhone },
          handler: async (paymentRes) => {
            const verify = await orderAPI.verifyPayment({
              orderId: order._id || order.id,
              razorpayOrderId: paymentRes.razorpay_order_id,
              razorpayPaymentId: paymentRes.razorpay_payment_id,
              razorpaySignature: paymentRes.razorpay_signature
            })
            if (verify.data.success) {
              setPlacedOrderId(order._id || order.id)
              setShowOrderSuccess(true)
              clearCart()
            }
            setIsPlacingOrder(false)
          },
          onError: () => setIsPlacingOrder(false)
        })
      }
    } catch (error) {
      toast.error(error.message || "Failed to place order")
      setIsPlacingOrder(false)
    }
  }

  const handleGoToOrders = () => {
    setShowOrderSuccess(false)
    navigate(`/user/orders/${placedOrderId}?confirmed=true`)
  }

  if (cart.length === 0 && !showOrderSuccess && !showPlacingOrder) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="bg-white dark:bg-[#1a1a1a] border-b dark:border-gray-800 sticky top-0 z-10">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}><ArrowLeft className="h-4 w-4" /></Button>
            <span className="font-semibold text-gray-800 dark:text-white">Cart</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4"><Utensils className="h-10 w-10 text-gray-400" /></div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Your cart is empty</h2>
          <Button className="mt-4 bg-[#EB590E] text-white" onClick={() => navigate('/user')}>Browse Restaurants</Button>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1a1a] border-b dark:border-gray-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-3 md:px-6 py-2 md:py-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" onClick={handleBack}><ArrowLeft className="h-4 w-4 md:h-5 md:w-5" /></Button>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{restaurantName}</p>
              {isTakeaway ? (
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 mb-0.5">

                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Takeaway Mode</span>

                  </div>
                  <p className="text-sm md:text-base font-medium text-gray-800 dark:text-white truncate">
                    <span className="font-semibold">Pickup from Restaurant</span>
                    <span className="text-gray-400 dark:text-gray-500 ml-1 text-xs md:text-sm">
                      {restaurantData ? `${restaurantData.area || ""}${restaurantData.area ? ", " : ""}${restaurantData.city || ""}` : ""}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="text-sm md:text-base font-medium text-gray-800 dark:text-white truncate">
                  {restaurantData?.estimatedDeliveryTime || "10-15 mins"} to <span className="font-semibold">Location</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-1 text-xs md:text-sm">{defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || defaultAddress?.city || "Select address") : "Select address"}</span>
                </p>
              )}

            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0" onClick={handleShare}><Share2 className="h-4 w-4 md:h-5 md:w-5" /></Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-44">
        {savings > 0 && (
          <div className="bg-blue-100 dark:bg-blue-900/20 px-4 py-2 text-center text-sm font-semibold text-blue-800 dark:text-blue-200">
            You are saving {RUPEE_SYMBOL}{savings} on this order!
          </div>
        )}

        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {/* Cart Items */}
          <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-start gap-4">
                  <div className={`w-4 h-4 border-2 ${item.isVeg !== false ? 'border-green-600' : 'border-red-600'} rounded mt-1 p-[2px]`}>
                    <div className={`w-full h-full rounded-full ${item.isVeg !== false ? 'bg-green-600' : 'bg-red-600'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</p>
                    {item.variantName && <p className="text-xs text-gray-500">{item.variantName}</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border border-[#EB590E] rounded h-8 overflow-hidden">
                      <button className="px-2 text-[#EB590E]" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus className="h-3 w-3" /></button>
                      <span className="px-1 text-sm font-bold text-[#EB590E] min-w-[20px] text-center">{item.quantity}</span>
                      <button className="px-2 text-[#EB590E]" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="h-3 w-3" /></button>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white w-16 text-right">{RUPEE_SYMBOL}{(item.price * item.quantity).toFixed(0)}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleBack} className="mt-4 flex items-center gap-2 text-[#EB590E] text-sm font-bold"><Plus className="h-4 w-4" /> Add more items</button>
          </div>

          {/* Addons */}
          {addons.length > 0 && (
            <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#EB590E]" /> Complete your meal</p>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {addons.map(addon => (
                  <div key={addon.id} className="flex-shrink-0 w-32">
                    <div className="relative">
                      <img src={addon.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"} className="w-32 h-32 object-cover rounded-xl" alt={addon.name} />
                      <button 
                        onClick={() => addToCart({ ...addon, restaurant: restaurantName, restaurantId })}
                        className="absolute bottom-2 right-2 w-7 h-7 bg-white border border-[#EB590E] rounded flex items-center justify-center shadow-lg"
                      >
                        <Plus className="h-4 w-4 text-[#EB590E]" />
                      </button>
                    </div>
                    <p className="text-xs font-bold mt-2 truncate text-gray-800 dark:text-gray-200">{addon.name}</p>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{RUPEE_SYMBOL}{addon.price}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800 flex gap-4">
            <button 
              onClick={() => setShowNoteInput(!showNoteInput)}
              className="flex-1 flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-800 rounded-xl text-left"
            >
              <FileText className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-500 truncate">{note || "Add instructions..."}</span>
            </button>
          </div>
          {showNoteInput && (
            <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-2xl border border-orange-100">
              <textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Special instructions for restaurant/delivery..."
                className="w-full h-24 p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#EB590E] bg-white dark:bg-black"
                maxLength={240}
              />
            </div>
          )}

          {/* Coupons */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-slate-100 dark:border-gray-800 overflow-hidden">
            {appliedCoupon ? (
              <div className="p-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/10">
                <div className="flex items-center gap-3">
                  <Percent className="h-5 w-5 text-[#EB590E]" />
                  <div>
                    <p className="text-sm font-bold">'{appliedCoupon.code}' applied</p>
                    <p className="text-xs text-[#EB590E] font-bold">Saved {RUPEE_SYMBOL}{discount}</p>
                  </div>
                </div>
                <button onClick={handleRemoveCoupon} className="text-xs font-black text-[#EB590E]">REMOVE</button>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Tag className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Offers & Coupons</span>
                  </div>
                  <button onClick={() => setShowCoupons(!showCoupons)} className="text-[#EB590E] text-sm font-bold">VIEW ALL</button>
                </div>
                {showCoupons && (
                  <div className="mt-4 space-y-4 pt-4 border-t border-dashed border-gray-100">
                    <div className="flex gap-2">
                      <input 
                        value={manualCouponCode}
                        onChange={(e) => setManualCouponCode(e.target.value.toUpperCase())}
                        placeholder="Coupon code"
                        className="flex-1 h-10 px-4 border border-gray-100 rounded-lg text-sm bg-gray-50 dark:bg-black"
                      />
                      <button onClick={handleApplyCouponCode} className="h-10 px-6 bg-white border border-[#EB590E] text-[#EB590E] rounded-lg text-xs font-black">APPLY</button>
                    </div>
                    <div className="space-y-4">
                      {availableCoupons.map(c => (
                        <div key={c.code} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold">{c.code}</p>
                            <p className="text-xs text-gray-500">{c.description}</p>
                          </div>
                          <button onClick={() => handleApplyCoupon(c)} className="text-[#EB590E] text-xs font-black">APPLY</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delivery/Pickup Location */}
          <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
            {isTakeaway ? (
              <div className="flex items-start gap-4">
                <div className="bg-orange-50 p-3 rounded-xl"><MapPin className="h-6 w-6 text-[#EB590E]" /></div>
                <div className="flex-1">
                  <p className="text-sm font-black uppercase text-gray-400 tracking-wider">Pickup From</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white mt-1">{restaurantName}</p>
                  <p className="text-sm text-gray-500 mt-1">{restaurantData ? `${restaurantData.addressLine1}, ${restaurantData.city}` : "Restaurant Location"}</p>
                  <div className="mt-4 flex items-center gap-2 text-green-600"><CheckCircle2 className="h-4 w-4" /><span className="text-xs font-bold uppercase">Ready for pickup in {restaurantData?.estimatedDeliveryTime || "15-20 mins"}</span></div>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="bg-orange-50 p-3 rounded-xl"><MapPin className="h-6 w-6 text-[#EB590E]" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-black uppercase text-gray-400 tracking-wider">Delivering To</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white mt-1">{deliveryAddressMode === "current" ? "Current Location" : (defaultAddress?.label || "Saved Address")}</p>
                    <p className="text-sm text-gray-500 mt-1 truncate max-w-[200px]">{defaultAddress ? formatFullAddress(defaultAddress) : "Select address"}</p>
                  </div>
                </div>
                <button onClick={openLocationSelector} className="text-[#EB590E] text-sm font-bold uppercase">Change</button>
              </div>
            )}
            {!hasSavedAddress && !isTakeaway && (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-100 rounded-xl">
                <p className="text-sm text-[#EB590E] font-bold">Address selection needed</p>
                <button onClick={openLocationSelector} className="mt-2 w-full py-2 bg-[#EB590E] text-white rounded-lg text-sm font-bold">ADD ADDRESS</button>
              </div>
            )}
          </div>

          {/* Recipient */}
          <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Phone className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-bold">{recipientName}</p>
                <p className="text-xs text-gray-500">{recipientPhone}</p>
              </div>
            </div>
            <button onClick={() => setIsEditingRecipient(!isEditingRecipient)} className="text-[#EB590E] text-sm font-bold uppercase">{isEditingRecipient ? "Done" : "Edit"}</button>
          </div>
          {isEditingRecipient && (
            <div className="p-4 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 space-y-3">
              <input value={recipientDetails.name} onChange={e => setRecipientDetails(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="w-full p-3 bg-gray-50 rounded-xl text-sm" />
              <input value={recipientDetails.phone} onChange={e => setRecipientDetails(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" className="w-full p-3 bg-gray-50 rounded-xl text-sm" />
            </div>
          )}

          {/* Bill Details */}
          <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-bold">Bill Details</span>
              </div>
              <button onClick={() => setShowBillDetails(!showBillDetails)}>{showBillDetails ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}</button>
            </div>
            {showBillDetails && (
              <div className="space-y-3">
                {isTakeaway && (
                  <div className="bg-orange-50 dark:bg-orange-950/20 px-3 py-2 rounded-lg border border-orange-100 dark:border-orange-900/30 mb-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
                     <p className="text-[11px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                       <CheckCircle2 className="h-3.5 w-3.5" />
                       Takeaway Order
                     </p>
                     <p className="text-[10px] text-orange-600/80 dark:text-orange-500/80 mt-0.5 font-medium">
                       Pickup from {restaurantName}
                     </p>
                  </div>
                )}
                <div className="flex justify-between text-sm"><span className="text-gray-500">Item Total</span><span>{RUPEE_SYMBOL}{subtotal.toFixed(2)}</span></div>
                {!isTakeaway && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Delivery Fee
                      {deliveryFeeBreakdownText && (
                        <span className="block text-[11px] text-gray-400 font-normal mt-0.5">{deliveryFeeBreakdownText}</span>
                      )}
                    </span>
                    <span className={deliveryFee === 0 ? "text-green-600 font-bold" : ""}>{deliveryFee === 0 ? "FREE" : `${RUPEE_SYMBOL}${deliveryFee}`}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm"><span className="text-gray-500">Platform Fee</span><span>{RUPEE_SYMBOL}{platformFee}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">GST and Restaurant Charges</span><span>{RUPEE_SYMBOL}{gstCharges}</span></div>
                {discount > 0 && <div className="flex justify-between text-sm text-[#EB590E] font-bold"><span>Coupon Discount</span><span>-{RUPEE_SYMBOL}{discount.toFixed(2)}</span></div>}
                <div className="pt-3 border-t border-gray-100 flex justify-between items-center"><span className="text-base font-semibold">To Pay</span><span className="text-base font-bold">{RUPEE_SYMBOL}{total.toFixed(2)}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Sticky */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-[#1a1a1a] border-t dark:border-gray-800 z-50">
        <div className="max-w-2xl mx-auto space-y-4">
          <div 
            onClick={() => setShowPaymentSheet(true)}
            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#222222] rounded-xl border border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#282828] active:scale-[0.98] transition-all duration-200 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-100/80 dark:bg-orange-900/40 flex items-center justify-center flex-shrink-0">
                {selectedPaymentMethod === "wallet" ? <Wallet className="h-5 w-5 text-[#EB590E]" /> : selectedPaymentMethod === "razorpay" ? <Zap className="h-5 w-5 text-[#EB590E]" /> : <Banknote className="h-5 w-5 text-[#EB590E]" />}
              </div>
              <div className="leading-tight">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold opacity-80">PAYING WITH</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{selectedPaymentLabel}</p>
                  {selectedPaymentMethod === "wallet" && (
                    <p className="text-[10px] text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 px-1 rounded">{RUPEE_SYMBOL}{walletBalance.toFixed(0)}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5 text-[#EB590E] font-bold text-[11px] uppercase tracking-widest bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-lg">
              CHANGE <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>

          <button 
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder || (!hasSavedAddress && !isTakeaway)}
            className="w-full bg-gradient-to-r from-[#EB590E] to-[#E23744] h-14 rounded-2xl flex items-center justify-between px-6 text-white shadow-xl shadow-orange-500/30 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <div className="text-left border-r border-white/20 pr-6">
              <p className="text-lg font-black">{RUPEE_SYMBOL}{total.toFixed(0)}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Total</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight">{isPlacingOrder ? "Placing Order..." : "Place Order"}</span>
              <ChevronRight className="h-6 w-6" />
            </div>
          </button>
        </div>
      </div>

      {/* Payment Sheet */}
      <AnimatePresence>
        {showPaymentSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPaymentSheet(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-[2.5rem] p-6 z-[101] shadow-2xl">
              <div className="w-12 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mx-auto mb-8" />
              <h2 className="text-2xl font-black mb-6">Payment Method</h2>
              <div className="space-y-4 mb-8">
                {[
                  { id: 'razorpay', icon: <Zap className="w-5 h-5" />, label: 'Online Payment', desc: 'UPI, Cards, Netbanking', badge: 'SECURE' },
                  { id: 'wallet', icon: <Wallet className="w-5 h-5" />, label: 'Quick Wallet', desc: 'Pay from your wallet', subInfo: `Bal: ${RUPEE_SYMBOL}${walletBalance.toFixed(0)}`, disabled: walletBalance < total, disabledText: 'Low Balance' },
                  { id: 'cash', icon: <Banknote className="w-5 h-5" />, label: 'Cash on Delivery', desc: isTakeaway ? 'Pay at restaurant' : 'Pay when order arrives', disabled: isTakeaway && !showTakeawayCOD, disabledText: 'Not available' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      if (!opt.disabled) {
                        setSelectedPaymentMethod(opt.id)
                        setShowPaymentSheet(false)
                      }
                    }}
                    disabled={opt.disabled}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 group ${selectedPaymentMethod === opt.id
                        ? 'border-[#EB590E] bg-[#EB590E] shadow-lg shadow-orange-500/30'
                        : 'border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#222222] hover:border-orange-200 dark:hover:border-orange-900/30 shadow-sm'
                      } ${opt.disabled ? 'opacity-40 grayscale-[0.8] cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${selectedPaymentMethod === opt.id
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                        {opt.icon}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black tracking-tight leading-none transition-colors ${selectedPaymentMethod === opt.id ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                            }`}>
                            {opt.label}
                          </span>
                          {opt.badge && (
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm tracking-wider ${selectedPaymentMethod === opt.id
                                ? 'bg-white/20 text-white'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              }`}>
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <p className={`text-[11px] font-bold transition-colors ${selectedPaymentMethod === opt.id ? 'text-white/80' : 'text-gray-400'
                            }`}>
                            {opt.disabled ? opt.disabledText : opt.desc}
                          </p>
                          {opt.subInfo && !opt.disabled && (
                            <>
                              <span className={`w-1 h-1 rounded-full ${selectedPaymentMethod === opt.id ? 'bg-white/40' : 'bg-orange-300 dark:bg-orange-700'
                                }`} />
                              <p className={`text-[10px] font-black uppercase tracking-tighter transition-colors ${selectedPaymentMethod === opt.id ? 'text-white' : 'text-green-600 dark:text-green-500'
                                }`}>
                                {opt.subInfo}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${selectedPaymentMethod === opt.id
                        ? 'bg-white border-white'
                        : 'border-gray-200 dark:border-gray-700'
                      }`}>
                      {selectedPaymentMethod === opt.id && !opt.disabled && <Check className="w-3.5 h-3.5 text-[#EB590E]" strokeWidth={4} />}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      {showOrderSuccess && (
        <div className="fixed inset-0 z-[1000] bg-white dark:bg-black flex flex-col items-center justify-center p-6 bg-texture">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 12 }} className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-green-200">
            <Check className="h-16 w-16 text-white" strokeWidth={4} />
          </motion.div>
          <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-4xl font-black text-center mb-2 tracking-tight">Order Placed!</motion.h2>
          <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-gray-500 text-lg mb-10">Your food is being prepared with love.</motion.p>
          <motion.button initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }} onClick={handleGoToOrders} className="bg-black text-white px-10 py-4 rounded-2xl font-black shadow-xl">TRACK ORDER</motion.button>
        </div>
      )}

      {/* Share Modal Portal */}
      {typeof window !== "undefined" && showShareModal && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
          <div className="relative bg-white dark:bg-[#1a1a1a] w-full max-w-sm rounded-[2rem] p-8 overflow-hidden">
            <h3 className="text-2xl font-black mb-6">Share RedGo</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'WhatsApp', icon: <MessageCircle />, action: () => openShareTarget('whatsapp') },
                { label: 'Copy Link', icon: <Copy />, action: copyShareLink }
              ].map(opt => (
                <button key={opt.label} onClick={opt.action} className="p-6 bg-gray-50 dark:bg-black rounded-3xl flex flex-col items-center gap-3 active:scale-95 transition-transform">
                  <div className="w-12 h-12 bg-white dark:bg-[#1a1a1a] rounded-2xl flex items-center justify-center shadow-sm">{opt.icon}</div>
                  <span className="text-xs font-bold uppercase tracking-widest">{opt.label}</span>
                </button>
              ))}
            </div>
            <X className="absolute top-6 right-6 h-6 w-6 text-gray-400 cursor-pointer" onClick={() => setShowShareModal(false)} />
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .bg-texture { background-image: radial-gradient(#EB590E 0.5px, transparent 0.5px); background-size: 24px 24px; }
      `}</style>
    </div>
  )
}
