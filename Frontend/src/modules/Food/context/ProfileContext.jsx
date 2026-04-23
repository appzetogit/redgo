import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import { authAPI, userAPI } from "@food/api"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const ProfileContext = createContext(null)
const USER_SESSION_PREFERENCE_KEYS = ["userVegMode", "userOrderType", "food-under-250-filters"]

export function ProfileProvider({ children }) {
  const getAddressId = (address) => address?.id || address?._id || null
  const normalizeAddressLabel = (label) => {
    const normalized = String(label || "").trim().toLowerCase()
    if (normalized === "home") return "Home"
    if (normalized === "office" || normalized === "work") return "Office"
    return "Other"
  }
  const normalizeAddress = (address) => {
    if (!address || typeof address !== "object") return null
    const id = getAddressId(address)
    return {
      ...address,
      label: normalizeAddressLabel(address.label),
      ...(id ? { id: String(id) } : {}),
    }
  }
  const dedupeAddressesByLabel = (addressList = []) => {
    const addressMap = new Map()
    addressList.forEach((addr, index) => {
      const normalizedAddress = normalizeAddress(addr)
      if (!normalizedAddress) return
      const key = normalizedAddress.label || getAddressId(normalizedAddress) || index
      // Keep latest address for each label so newly saved Home/Work/Other is visible immediately
      addressMap.set(key, normalizedAddress)
    })
    return Array.from(addressMap.values())
  }
  const [userProfile, setUserProfile] = useState(() => {
    const userStr = localStorage.getItem("user_user")
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch (e) {
        debugError("Error parsing user_user from localStorage:", e)
      }
    }
    const saved = localStorage.getItem("userProfile")
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        debugError("Error parsing userProfile from localStorage:", e)
      }
    }
    return null
  })
  
  const [loading, setLoading] = useState(true)

  const [addresses, setAddresses] = useState([])

  const [paymentMethods, setPaymentMethods] = useState(() => {
    const saved = localStorage.getItem("userPaymentMethods")
    return saved ? JSON.parse(saved) : []
  })

  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("userFavorites")
    return saved ? JSON.parse(saved) : []
  })

  // Dish favorites state - stored in localStorage for persistence
  const [dishFavorites, setDishFavorites] = useState(() => {
    const saved = localStorage.getItem("userDishFavorites")
    return saved ? JSON.parse(saved) : []
  })

  // VegMode state - stored in localStorage for persistence
  const [vegMode, setVegMode] = useState(() => {
    const saved = localStorage.getItem("userVegMode")
    // Default to false (OFF) if not set
    return saved !== null ? saved === "true" : false
  })

  // orderType state - stored in localStorage for persistence
  const [orderType, _setOrderType] = useState(() => {
    const saved = localStorage.getItem("userOrderType")
    return (saved && ["delivery", "dining", "takeaway"].includes(saved)) ? saved : "delivery"
  })

  // UI States (merged here to keep it simple as requested)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [isVoiceRequested, setIsVoiceRequested] = useState(false)

  // Helper to check if authenticated
  const isAuthenticated = useMemo(() => {
    return localStorage.getItem("user_authenticated") === "true" || !!localStorage.getItem("user_accessToken")
  }, [userProfile])

  // Save to localStorage whenever userProfile, addresses or paymentMethods change
  useEffect(() => {
    if (userProfile || isAuthenticated) {
      localStorage.setItem("userProfile", JSON.stringify(userProfile))
    }
  }, [userProfile, isAuthenticated])

  useEffect(() => {
    if (addresses.length > 0 || isAuthenticated) {
      localStorage.setItem("userAddresses", JSON.stringify(addresses))
    }
  }, [addresses, isAuthenticated])

  useEffect(() => {
    if (paymentMethods.length > 0 || isAuthenticated) {
      localStorage.setItem("userPaymentMethods", JSON.stringify(paymentMethods))
    }
  }, [paymentMethods, isAuthenticated])

  useEffect(() => {
    if (favorites.length > 0 || isAuthenticated) {
      localStorage.setItem("userFavorites", JSON.stringify(favorites))
    }
  }, [favorites, isAuthenticated])

  useEffect(() => {
    if (dishFavorites.length > 0 || isAuthenticated) {
      localStorage.setItem("userDishFavorites", JSON.stringify(dishFavorites))
    }
  }, [dishFavorites, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem("userVegMode", vegMode.toString())
    }
  }, [vegMode, isAuthenticated])

  // Wrap setOrderType to SYNCHRONOUSLY save to localStorage before React re-render
  const setOrderType = (newType) => {
    if (["delivery", "dining", "takeaway"].includes(newType)) {
      localStorage.setItem("userOrderType", newType)
      _setOrderType(newType)
    }
  }

  // UI Handlers
  const openSearch = useCallback((voice = false) => {
    setIsSearchOpen(true)
    setIsVoiceRequested(voice === true)
  }, [])

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false)
    setIsVoiceRequested(false)
    setSearchValue("")
  }, [])

  const openLocationSelector = useCallback(() => {
    window.dispatchEvent(new CustomEvent('openLocationSelector'))
  }, [])

  // Fetch user profile and addresses from API
  useEffect(() => {
    const fetchUserProfile = async () => {
      const auth = localStorage.getItem("user_authenticated") === "true" || 
                   localStorage.getItem("user_accessToken")
      
      if (!auth) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await authAPI.getCurrentUser()
        const userData = response?.data?.data?.user || response?.data?.user || response?.data
        if (userData) setUserProfile(userData)

        const addressesResponse = await userAPI.getAddresses()
        const addressesData = addressesResponse?.data?.data?.addresses || addressesResponse?.data?.addresses || []
        setAddresses(dedupeAddressesByLabel(addressesData))
      } catch (error) {
        debugError("Error fetching user profile:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
    window.addEventListener("userAuthChanged", fetchUserProfile)
    return () => window.removeEventListener("userAuthChanged", fetchUserProfile)
  }, [])

  // Address functions
  const addAddress = useCallback(async (address) => {
    const response = await userAPI.addAddress(address)
    const newAddr = response?.data?.data?.address || response?.data?.address
    if (newAddr) setAddresses(prev => dedupeAddressesByLabel([...prev, newAddr]))
    return newAddr
  }, [])

  const updateAddress = useCallback(async (id, updatedAddress) => {
    const response = await userAPI.updateAddress(id, updatedAddress)
    const updated = response?.data?.data?.address || response?.data?.address
    if (updated) setAddresses(prev => dedupeAddressesByLabel(prev.map(a => String(getAddressId(a)) === String(id) ? updated : a)))
  }, [])

  const deleteAddress = useCallback(async (id) => {
    await userAPI.deleteAddress(id)
    setAddresses(prev => prev.filter(a => String(getAddressId(a)) !== String(id)))
  }, [])

  const setDefaultAddress = useCallback(async (id) => {
    setAddresses(prev => prev.map(a => ({ ...a, isDefault: String(getAddressId(a)) === String(id) })))
    await userAPI.setDefaultAddress(id)
  }, [])

  const getDefaultAddress = useCallback(() => addresses.find(a => a.isDefault) || addresses[0] || null, [addresses])
  const getAddressById = useCallback((id) => addresses.find(a => String(getAddressId(a)) === String(id)), [addresses])

  // Payment functions
  const addPaymentMethod = useCallback((p) => setPaymentMethods(prev => [...prev, { ...p, id: Date.now().toString(), isDefault: prev.length === 0 }]), [])
  const updatePaymentMethod = useCallback((id, up) => setPaymentMethods(prev => prev.map(p => p.id === id ? { ...p, ...up } : p)), [])
  const deletePaymentMethod = useCallback((id) => setPaymentMethods(prev => prev.filter(p => p.id !== id)), [])
  const setDefaultPaymentMethod = useCallback((id) => setPaymentMethods(prev => prev.map(p => ({ ...p, isDefault: p.id === id }))), [])
  const getDefaultPaymentMethod = useCallback(() => paymentMethods.find(p => p.isDefault) || paymentMethods[0] || null, [paymentMethods])
  const getPaymentMethodById = useCallback((id) => paymentMethods.find(p => p.id === id), [paymentMethods])

  // Favorites
  const addFavorite = useCallback((r) => setFavorites(p => p.find(f => f.slug === r.slug) ? p : [...p, r]), [])
  const removeFavorite = useCallback((s) => setFavorites(p => p.filter(f => f.slug !== s)), [])
  const isFavorite = useCallback((s) => favorites.some(f => f.slug === s), [favorites])
  const addDishFavorite = useCallback((d) => setDishFavorites(p => p.find(f => f.id === d.id) ? p : [...p, d]), [])
  const removeDishFavorite = useCallback((id) => setDishFavorites(p => p.filter(f => f.id !== id)), [])
  const isDishFavorite = useCallback((id) => dishFavorites.some(f => f.id === id), [dishFavorites])

  const updateUserProfile = useCallback((u) => setUserProfile(p => ({ ...p, ...u })), [])

  const value = useMemo(() => ({
    userProfile, loading, updateUserProfile, addresses, paymentMethods, favorites, vegMode, setVegMode,
    orderType, setOrderType, addAddress, updateAddress, deleteAddress, setDefaultAddress, getDefaultAddress,
    getAddressById, addPaymentMethod, updatePaymentMethod, deletePaymentMethod, setDefaultPaymentMethod,
    getDefaultPaymentMethod, getPaymentMethodById, addFavorite, removeFavorite, isFavorite, dishFavorites,
    addDishFavorite, removeDishFavorite, isDishFavorite, isSearchOpen, searchValue, setSearchValue,
    openSearch, closeSearch, isVoiceRequested, openLocationSelector
  }), [
    userProfile, loading, updateUserProfile, addresses, paymentMethods, favorites, vegMode, setVegMode,
    orderType, setOrderType, addAddress, updateAddress, deleteAddress, setDefaultAddress, getDefaultAddress,
    getAddressById, addPaymentMethod, updatePaymentMethod, deletePaymentMethod, setDefaultPaymentMethod,
    getDefaultPaymentMethod, getPaymentMethodById, addFavorite, removeFavorite, isFavorite, dishFavorites,
    addDishFavorite, removeDishFavorite, isDishFavorite, isSearchOpen, searchValue, setSearchValue,
    openSearch, closeSearch, isVoiceRequested, openLocationSelector
  ])

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) {
    debugWarn("useProfile called outside ProfileProvider")
    return {
      userProfile: null, loading: false, updateUserProfile: () => {}, addresses: [], paymentMethods: [],
      favorites: [], dishFavorites: [], vegMode: false, setVegMode: () => {}, orderType: "delivery",
      setOrderType: () => {}, isSearchOpen: false, searchValue: "", setSearchValue: () => {},
      openSearch: () => {}, closeSearch: () => {}, isVoiceRequested: false, openLocationSelector: () => {}
    }
  }
  return context
}
