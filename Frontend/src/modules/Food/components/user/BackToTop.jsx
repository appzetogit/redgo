import { ArrowUp } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"

export default function BackToTop() {
  const [show, setShow] = useState(false)
  const [isAutoScrolling, setIsAutoScrolling] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // If we are currently auto-scrolling to top, don't show the button
      if (isAutoScrolling) return

      // Show when scrolled down more than 2500px (approx 7-8 restaurants on mobile)
      if (window.scrollY > 2500) {
        setShow(true)
      } else {
        setShow(false)
      }

      // Reset auto-scrolling flag if we've reached near the top
      if (window.scrollY < 100) {
        setIsAutoScrolling(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isAutoScrolling])

  const scrollToTop = () => {
    setIsAutoScrolling(true)
    setShow(false)
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    })
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.8, x: "-50%" }}
          animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
          exit={{ opacity: 0, y: -10, scale: 0.8, x: "-50%" }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 30 
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
