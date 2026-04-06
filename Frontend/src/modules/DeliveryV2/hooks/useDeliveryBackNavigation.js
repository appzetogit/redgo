import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"

const toDeliveryPath = (value) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()

  if (!trimmed) return null
  if (trimmed.startsWith("/delivery")) return trimmed
  if (trimmed === "/delivery") return "/delivery"
  if (trimmed.startsWith("/delivery/")) return `/food${trimmed}`

  return null
}

const getNormalizedDeliveryPath = (pathname) => {
  if (pathname.startsWith("/delivery")) {
    return pathname.slice("/delivery".length) || "/"
  }

  return pathname || "/"
}

const resolveDeliveryBackPath = ({ pathname, state }) => {
  const normalizedPath = getNormalizedDeliveryPath(pathname)
  const explicitBackPath = toDeliveryPath(state?.backTo) || toDeliveryPath(state?.from)

  if (normalizedPath === "/signup/details") return "/delivery/signup"
  if (normalizedPath === "/signup/documents") return "/delivery/signup/details"
  if (normalizedPath === "/otp") return explicitBackPath || "/delivery/login"
  if (normalizedPath === "/terms") return explicitBackPath || "/delivery/signup"

  if (
    normalizedPath === "/profile/details" ||
    normalizedPath === "/profile/bank" ||
    normalizedPath === "/profile/documents" ||
    normalizedPath === "/profile/terms" ||
    normalizedPath === "/profile/privacy" ||
    normalizedPath === "/help/id-card" ||
    normalizedPath === "/help/tickets"
  ) {
    return explicitBackPath || "/delivery/profile"
  }

  if (
    normalizedPath === "/help/tickets/create" ||
    /^\/help\/tickets\/[^/]+$/.test(normalizedPath)
  ) {
    return explicitBackPath || "/delivery/help/tickets"
  }

  if (
    normalizedPath === "/pocket/payout" ||
    normalizedPath === "/pocket/statement" ||
    normalizedPath === "/pocket/deductions" ||
    normalizedPath === "/pocket/limit-settlement" ||
    normalizedPath === "/pocket/balance" ||
    normalizedPath === "/pocket/cash-limit" ||
    normalizedPath === "/pocket/details"
  ) {
    return explicitBackPath || "/delivery/pocket"
  }

  if (explicitBackPath && explicitBackPath !== pathname) {
    return explicitBackPath
  }

  return "/delivery"
}

export default function useDeliveryBackNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(() => {
    navigate(resolveDeliveryBackPath(location))
  }, [location, navigate])
}
