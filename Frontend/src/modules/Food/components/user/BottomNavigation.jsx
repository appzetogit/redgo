import { Link, useLocation } from "react-router-dom"
import { Tag, User, Truck, UtensilsCrossed, ShoppingBag } from "lucide-react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function BottomNavigation() {
  const location = useLocation()
  const pathname = location.pathname
  
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [accumulatedScrollUp, setAccumulatedScrollUp] = useState(0)
  const [accumulatedScrollDown, setAccumulatedScrollDown] = useState(0)

  // Scroll logic to hide/show footer
  useEffect(() => {
    const SHOW_THRESHOLD = 150 // Pixels to scroll up to show
    const HIDE_THRESHOLD = 80 // Pixels to scroll down to hide
    
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        const currentScrollY = window.scrollY
        
        if (currentScrollY > lastScrollY) {
          // Scrolling Down
          const delta = currentScrollY - lastScrollY
          const newAccumulation = accumulatedScrollDown + delta
          setAccumulatedScrollDown(newAccumulation)
          setAccumulatedScrollUp(0) // Reset upward accumulation

          if (newAccumulation > HIDE_THRESHOLD && currentScrollY > 100) {
            setIsVisible(false)
          }
        } else {
          // Scrolling Up
          const delta = lastScrollY - currentScrollY
          const newAccumulation = accumulatedScrollUp + delta
          setAccumulatedScrollUp(newAccumulation)
          setAccumulatedScrollDown(0) // Reset downward accumulation
          
          if (newAccumulation > SHOW_THRESHOLD) {
            setIsVisible(true)
          }
        }
        
        setLastScrollY(currentScrollY)
      }
    }

    window.addEventListener('scroll', controlNavbar)
    return () => window.removeEventListener('scroll', controlNavbar)
  }, [lastScrollY, accumulatedScrollUp, accumulatedScrollDown])

  // Check active routes
  const isDining = pathname === "/dining" || pathname.startsWith("/dining")
  const isUnder250 = pathname === "/under-250" || pathname.startsWith("/under-250")
  const isTakeaway = pathname === "/takeaway" || pathname.startsWith("/takeaway")
  const isProfile = pathname.startsWith("/profile")
  const isDelivery =
    !isDining &&
    !isUnder250 &&
    !isTakeaway &&
    !isProfile &&
    (pathname === "/food" ||
      pathname === "/" ||
      pathname === "" ||
      (pathname.startsWith("") &&
        !pathname.includes("/dining") &&
        !pathname.includes("/under-250") &&
        !pathname.includes("/takeaway") &&
        !pathname.includes("/profile")))

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 120, x: "-50%" }}
          animate={{ y: 0, x: "-50%" }}
          exit={{ y: 120, x: "-50%" }}
          transition={{ 
            type: "tween",
            ease: [0.22, 1, 0.36, 1],
            duration: 0.5
          }}
          style={{ backfaceVisibility: 'hidden', perspective: 1000, WebkitBackfaceVisibility: 'hidden' }}
          className="md:hidden fixed bottom-6 left-1/2 w-[92%] max-w-md z-50 pointer-events-auto"
        >
          <div className="bg-white dark:bg-[#111111] border border-gray-100 dark:border-white/5 rounded-full shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)] px-1.5 py-1.5 flex items-center justify-between">
            {/* Delivery Tab */}
            <Link
              to="/"
              className={`flex flex-1 flex-col items-center gap-0.5 px-3 py-2 rounded-full transition-all duration-300 ${
                isDelivery
                  ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50"
              }`}
            >
              <Truck className={`h-5 w-5 ${isDelivery ? "fill-red-600/10" : ""}`} strokeWidth={2} />
              <span className={`text-[11px] font-semibold tracking-tight ${isDelivery ? "text-red-600" : "text-gray-600 dark:text-gray-400"}`}>
                Delivery
              </span>
            </Link>

            {/* Dining Tab */}
            <Link
              to="/dining"
              className={`flex flex-1 flex-col items-center gap-0.5 px-3 py-2 rounded-full transition-all duration-300 ${
                isDining
                  ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50"
              }`}
            >
              <UtensilsCrossed className="h-5 w-5" strokeWidth={2} />
              <span className={`text-[11px] font-semibold tracking-tight ${isDining ? "text-red-600" : "text-gray-600 dark:text-gray-400"}`}>
                Dining
              </span>
            </Link>

            {/* Under 250 Tab */}
            <Link
              to="/under-250"
              className={`flex flex-1 flex-col items-center gap-0.5 px-3 py-2 rounded-full transition-all duration-300 ${
                isUnder250
                  ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50"
              }`}
            >
              <Tag className={`h-5 w-5 ${isUnder250 ? "fill-red-600/10" : ""}`} strokeWidth={2} />
              <span className={`text-[11px] font-semibold tracking-tight ${isUnder250 ? "text-red-600" : "text-gray-600 dark:text-gray-400"}`}>
                Under 250
              </span>
            </Link>

            {/* Takeaway Tab */}
            <Link
              to="/takeaway"
              className={`flex flex-1 flex-col items-center gap-0.5 px-3 py-2 rounded-full transition-all duration-300 ${
                isTakeaway
                  ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50"
              }`}
            >
              <ShoppingBag className={`h-5 w-5 ${isTakeaway ? "fill-red-600/10" : ""}`} strokeWidth={2} />
              <span className={`text-[11px] font-semibold tracking-tight ${isTakeaway ? "text-red-600" : "text-gray-600 dark:text-gray-400"}`}>
                Takeaway
              </span>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
