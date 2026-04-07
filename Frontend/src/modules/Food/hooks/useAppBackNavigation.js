import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"

const toFoodPath = (value) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/")) return trimmed
  if (trimmed === "/food") return trimmed
  if (trimmed.startsWith("/user/")) return `/food${trimmed}`
  if (trimmed === "/user") return ""
  return null
}

const resolveBackPath = ({ pathname, search, state }) => {
  const explicitBackPath = state?.backTo || state?.from
  const searchParams = new URLSearchParams(search || "")

  if (
    pathname === "/profile/payments/new" ||
    /^\/profile\/payments\/[^/]+\/edit$/.test(pathname)
  ) {
    return "/profile/payments"
  }

  if (
    /^\/profile\/(edit|favorites|support|coupons|about|report-safety-emergency|accessibility|logout|refer-earn|payments)$/.test(
      pathname,
    )
  ) {
    return "/profile"
  }

  if (
    /^\/profile\/(terms|privacy|refund|shipping|cancellation)$/.test(
      pathname,
    )
  ) {
    return explicitBackPath || "/profile"
  }

  if (pathname === "/wallet") {
    return "/profile"
  }

  if (pathname === "/notifications") {
    return explicitBackPath || "/"
  }

  if (/^\/restaurants\/[^/]+$/.test(pathname)) {
    if (searchParams.get("under250") === "true") {
      return "/under-250"
    }
    return explicitBackPath || "/"
  }

  if (/^\/dining\/book(\/|$)/.test(pathname)) {
    return explicitBackPath || "/dining"
  }

  if (/^\/dining\/[^/]+\/[^/]+$/.test(pathname)) {
    return explicitBackPath || "/dining"
  }

  if (
    pathname === "/dining/restaurants" ||
    pathname === "/dining/explore/upto50" ||
    pathname === "/dining/explore/near-rated" ||
    pathname === "/dining/coffee"
  ) {
    return "/dining"
  }

  if (/^\/dining\/[^/]+$/.test(pathname)) {
    return "/dining"
  }

  if (/^\/orders\/[^/]+(\/invoice|\/details)?$/.test(pathname)) {
    return "/orders"
  }

  if (
    pathname === "/cart/checkout" ||
    pathname === "/cart/select-address" ||
    pathname === "/cart/address-selector"
  ) {
    // If we have an explicit back path (like from the Home page), use it.
    // Otherwise fallback to /cart.
    if (explicitBackPath) return explicitBackPath;
    return "/cart"
  }

  if (/^\/collections\/[^/]+$/.test(pathname)) {
    return "/collections"
  }

  if (pathname === "/categories") {
    return "/"
  }

  if (/^\/category\/[^/]+$/.test(pathname)) {
    return "/categories"
  }

  if (
    pathname === "/offers" ||
    pathname === "/gourmet" ||
    pathname === "/coffee"
  ) {
    return "/"
  }

  if (/^\/product\/[^/]+$/.test(pathname)) {
    return explicitBackPath || "/"
  }

  if (/^\/complaints(\/|$)/.test(pathname)) {
    return explicitBackPath || "/orders"
  }

  if (explicitBackPath && explicitBackPath !== pathname) {
    return explicitBackPath
  }

  return "/"
}

export default function useAppBackNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(() => {
    navigate(resolveBackPath(location))
  }, [location, navigate])
}
