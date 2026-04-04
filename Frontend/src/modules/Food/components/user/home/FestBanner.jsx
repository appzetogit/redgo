import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightCircle } from 'lucide-react';
import bannerFood1 from "@food/assets/category-icons/food.png"; // Burger
// Using placeholders for variety as in image
const tacoImg = "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200&h=200&fit=crop";
const platterImg = "https://images.unsplash.com/photo-1544025162-d76694265947?w=200&h=200&fit=crop";

export default function FestBanner() {
  return (
    <div className="relative bg-gradient-to-b from-[#ef4f5f] to-[#d63a4a] px-4 pt-4 pb-10 overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <circle cx="85%" cy="15%" r="15" stroke="white" strokeWidth="0.5" fill="none" />
          <path d="M -10 30 Q 20 10 50 30 T 110 30" stroke="white" strokeWidth="0.3" fill="none" />
          <path d="M -10 50 Q 20 30 50 50 T 110 50" stroke="white" strokeWidth="0.3" fill="none" />
          <circle cx="10%" cy="80%" r="20" stroke="white" strokeWidth="0.2" fill="none" />
          <rect x="70" y="70" width="10" height="10" stroke="white" strokeWidth="0.2" fill="none" transform="rotate(45 75 75)" />
        </svg>
      </div>

      {/* Glossy Glow Behind Text */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-32 bg-yellow-400/20 blur-[60px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center space-y-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 12 }}
        >
          <h2 
            className="text-4xl font-bold text-[#fff200] italic tracking-tight drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] uppercase"
            style={{ WebkitTextStroke: '1px white' }}
          >
            FLAVOUR FEST
          </h2>
        </motion.div>
        
        <div className="flex items-center gap-3 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-lg group cursor-pointer active:scale-95 transition-all">
          <span className="text-xl font-black text-white uppercase tracking-[0.15em] drop-shadow-md">UPTO 60% OFF</span>
          <ArrowRightCircle className="h-6 w-6 text-[#fff200] animate-pulse" fill="rgba(0,0,0,0.1)" />
        </div>

        {/* Food Images Row - More Premium Stacking */}
        <div className="flex items-end justify-center gap-3 pt-6 relative">
          {/* Subtle glow behind center image */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-40 h-10 bg-black/30 blur-[25px] rounded-full sm:blur-[35px]" />
          
          <motion.div 
            whileHover={{ y: -5, rotate: -5 }}
            className="w-24 h-24 rotate-[-12deg] translate-y-3 z-10 transition-all duration-300"
          >
            <img src={tacoImg} alt="taco" className="w-full h-full object-cover rounded-2xl border-[3px] border-white shadow-xl" />
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.15 }}
            className="w-36 h-36 z-20 transition-all duration-500 hover:z-30"
          >
            <div className="relative h-full w-full">
              <div className="absolute -inset-1 bg-yellow-400/30 blur-md rounded-3xl animate-pulse" />
              <img src={platterImg} alt="platter" className="relative w-full h-full object-cover rounded-3xl border-[4px] border-white shadow-2xl" />
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5, rotate: 5 }}
            className="w-24 h-24 rotate-[12deg] translate-y-3 z-10 transition-all duration-300"
          >
            <img src={bannerFood1} alt="burger" className="w-full h-full object-contain p-2 rounded-2xl border-[3px] border-white bg-white shadow-xl" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
