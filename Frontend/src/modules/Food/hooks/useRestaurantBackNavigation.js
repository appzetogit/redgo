import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"

const toRestaurantPath = (value) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()

  if (!trimmed) return null
  if (trimmed.startsWith("/restaurant")) return trimmed
  if (trimmed === "/restaurant") return "/restaurant"
  if (trimmed.startsWith("/restaurant/")) return `/food${trimmed}`

  return null
}

const resolveRestaurantBackPath = ({ pathname, state }) => {
  const explicitBackPath = state?.backTo || state?.from

  if (
    pathname === "/orders/all" ||
    /^\/orders\/[^/]+$/.test(pathname)
  ) {
    return explicitBackPath || "/restaurant/orders"
  }

  if (
    pathname === "/all" ||
    /^\/food\/[^/]+$/.test(pathname) ||
    /^\/food\/[^/]+\/edit$/.test(pathname)
  ) {
    return explicitBackPath || "/restaurant/all"
  }

  if (
    pathname === "/advertisements/new" ||
    /^\/advertisements\/[^/]+$/.test(pathname) ||
    /^\/advertisements\/[^/]+\/edit$/.test(pathname)
  ) {
    return explicitBackPath || "/restaurant/advertisements"
  }

  if (
    pathname === "/coupon/new" ||
    /^\/coupon\/[^/]+\/edit$/.test(pathname)
  ) {
    return explicitBackPath || "/restaurant/coupon"
  }

  if (
    pathname === "/edit" ||
    pathname === "/edit-owner" ||
    pathname === "/edit-cuisines" ||
    pathname === "/edit-address" ||
    pathname === "/phone" ||
    pathname === "/manage-outlets" ||
    pathname === "/update-bank-details" ||
    pathname === "/fssai" ||
    pathname === "/fssai/update" ||
    pathname === "/outlet-info" ||
    pathname === "/outlet-timings" ||
    /^\/outlet-timings\/[^/]+$/.test(pathname) ||
    pathname === "/zone-setup"
  ) {
    return explicitBackPath || "/restaurant/details"
  }

  if (
    pathname === "/settings" ||
    pathname === "/delivery-settings" ||
    pathname === "/rush-hour" ||
    pathname === "/status" ||
    pathname === "/business-plan" ||
    pathname === "/config" ||
    pathname === "/categories" ||
    pathname === "/menu-categories" ||
    pathname === "/privacy" ||
    pathname === "/terms"
  ) {
    return explicitBackPath || "/restaurant"
  }

  if (
    pathname === "/reviews" ||
    /^\/reviews\/[^/]+\/reply$/.test(pathname) ||
    pathname === "/ratings-reviews" ||
    pathname === "/dish-ratings"
  ) {
    return explicitBackPath || "/restaurant/reviews"
  }

  if (
    pathname === "/help-centre/support" ||
    pathname === "/share-feedback"
  ) {
    return explicitBackPath || "/restaurant/feedback"
  }

  if (
    pathname === "/finance-details" ||
    pathname === "/download-report"
  ) {
    return explicitBackPath || "/restaurant/hub-finance"
  }

  if (/^\/hub-menu\/item\/[^/]+$/.test(pathname)) {
    return explicitBackPath || "/restaurant/explore"
  }

  if (explicitBackPath && explicitBackPath !== pathname) {
    return explicitBackPath
  }

  return "/restaurant"
}

export default function useRestaurantBackNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(() => {
    navigate(resolveRestaurantBackPath(location))
  }, [location, navigate])
}
