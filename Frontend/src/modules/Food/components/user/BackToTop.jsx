import { ArrowUp } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"

export default function BackToTop() {
  const [show, setShow] = useState(false)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [isAutoScrolling, setIsAutoScrolling] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // If we are near the top, always hide and reset
      if (currentScrollY < 500) {
        setShow(false)
        setIsAutoScrolling(false)
        setLastScrollY(currentScrollY)
        return
      }

      // If we are currently auto-scrolling to top, keep it hidden
      if (isAutoScrolling) {
        setLastScrollY(currentScrollY)
        return
      }

      // Logic: Show button only if:
      // 1. We are deep enough in the page (> 2500px)
      // 2. We are specifically scrolling UP (current < last)
      // 3. We are not scrolling too fast down (optional, but keep it simple first)
      if (currentScrollY > 2500) {
        const isScrollingUp = currentScrollY < lastScrollY
        // Buffer of 5px to avoid flicker on tiny movements
        if (isScrollingUp && (lastScrollY - currentScrollY > 5)) {
          setShow(true)
        } else if (!isScrollingUp && (currentScrollY - lastScrollY > 5)) {
          setShow(false)
        }
      } else {
        setShow(false)
      }

      setLastScrollY(currentScrollY)
    }

    const throttledScroll = () => {
      requestAnimationFrame(handleScroll)
    }

    window.addEventListener("scroll", throttledScroll, { passive: true })
    return () => window.removeEventListener("scroll", throttledScroll)
  }, [isAutoScrolling, lastScrollY])

  const scrollToTop = () => {
    setIsAutoScrolling(true)
    setShow(false)
    
    // Zomato-style "warped" scroll:
    // We smooth scroll for a short distance (1000px) to give visual feedback,
    // then snap to top to avoid scrolling through thousands of items.
    
    const startY = window.scrollY
    const startTime = performance.now()
    const warpDistance = 1000 // How many pixels to "show" scrolling
    const duration = 250 // Duration for the visual "zip"

    const step = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease out quad for the initial zip
      const easeOutQuad = progress * (2 - progress)
      
      // Calculate how much we've traveled in this warp
      const travel = warpDistance * easeOutQuad
      
      if (progress < 1) {
        window.scrollTo(0, startY - travel)
        requestAnimationFrame(step)
      } else {
        // Snap to absolute top at the end
        window.scrollTo(0, 0)
        // Small timeout to ensure the snap is processed before resetting state
        setTimeout(() => setIsAutoScrolling(false), 50)
      }
    }

    requestAnimationFrame(step)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.8, x: "-50%" }}
          animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
          exit={{ opacity: 0, y: -20, scale: 0.8, x: "-50%" }}
          transition={{ 
            type: "spring",
            stiffness: 260,
            damping: 20,
            mass: 0.5
          }}
          className="fixed top-80 left-1/2 z-[60] pointer-events-auto"
        >
          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-black/60 dark:bg-black/80 backdrop-blur-xl border border-white/20 rounded-full shadow-lg text-white font-medium text-[11px] group active:scale-95 transition-all"
          >
            <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" strokeWidth={3} />
            <span>Back to top</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
