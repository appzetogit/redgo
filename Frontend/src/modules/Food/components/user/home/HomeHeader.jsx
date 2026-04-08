import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ChevronDown, Search, Mic, Wallet } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@food/components/ui/avatar";
import { Switch } from "@food/components/ui/switch";
import { useProfile } from "@food/context/ProfileContext";


export default function HomeHeader({ 
  location, 
  savedAddressText, 
  handleLocationClick, 
  handleSearchFocus, 
  placeholderIndex, 
  placeholders 
}) {
  const { userProfile, vegMode, setVegMode } = useProfile();

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const profileImageUrl = useMemo(() => {
    if (!userProfile?.profileImage) return null;
    if (typeof userProfile.profileImage === 'string') return userProfile.profileImage;
    return userProfile.profileImage.url || userProfile.profileImage.secure_url;
  }, [userProfile]);


  return (
    <div className="relative bg-gradient-to-b from-[#f36371] to-[#ef4f5f] pt-5 pb-5 px-4 space-y-5 shadow-xl overflow-hidden dark:from-[#141414] dark:to-[#0a0a0a] dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      {/* Abstract Background Design */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <circle cx="10%" cy="10%" r="20" fill="white" />
          <circle cx="90%" cy="20%" r="15" fill="white" />
          <circle cx="50%" cy="80%" r="25" fill="white" />
          <path d="M 0 50 Q 25 30 50 50 T 100 50" stroke="white" strokeWidth="0.5" fill="none" />
          <path d="M 0 70 Q 25 50 50 70 T 100 70" stroke="white" strokeWidth="0.5" fill="none" />
        </svg>
      </div>

      {/* Decorative Glows */}
      <div className="absolute top-0 left-1/4 w-32 h-32 bg-white/20 blur-[60px] rounded-full pointer-events-none dark:bg-white/10" />
      <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-yellow-400/10 blur-[80px] rounded-full pointer-events-none dark:bg-orange-500/10" />

      {/* Location & Notification Row - Clean Pixel Match Design */}
      <div className="relative z-30 flex items-center justify-between">
        <div 
          className="flex items-center gap-1 cursor-pointer group active:scale-95 transition-all p-1 -m-1"
          onClick={(e) => {
            e.stopPropagation();
            handleLocationClick();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleLocationClick();
            }
          }}
        >
          <div className="bg-white/10 p-1.5 rounded-full backdrop-blur-md border border-white/10 group-hover:bg-white/20 transition-colors dark:bg-white/5 dark:border-white/5 dark:group-hover:bg-white/10">
            <MapPin className="h-4 w-4 text-white fill-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Deliver to</span>
              <ChevronDown className="h-3 w-3 text-white/80" />
            </div>
            <span className="text-sm font-bold text-white truncate max-w-[200px] drop-shadow-sm">
              {location?.area || location?.city || savedAddressText || "Select Location"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Wallet Icon */}
          <Link to="/wallet" className="h-10 w-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/20 shadow-lg active:scale-95 transition-all">
            <Wallet className="h-5 w-5 text-white" />
          </Link>

          {/* Profile Avatar */}
          <Link to="/profile" className="h-10 w-10 flex items-center justify-center rounded-full bg-white border-2 border-white/30 shadow-lg active:scale-95 transition-all overflow-hidden">
            <Avatar className="h-full w-full">
              <AvatarImage src={profileImageUrl} />
              <AvatarFallback className="bg-orange-100 text-orange-600 font-bold text-sm">
                {getInitials(userProfile?.name || userProfile?.fullName)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-3 mx-1">
        <div 
          className="flex-1 bg-white rounded-xl flex items-center px-4 py-3 shadow-md border border-white/20 cursor-pointer active:scale-[0.99] transition-all duration-200 dark:bg-[#1a1a1a] dark:border-gray-800 dark:shadow-[0_12px_30px_rgba(0,0,0,0.3)]"
          onClick={handleSearchFocus}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSearchFocus();
            }
          }}
        >
          <Search className="h-4 w-4 text-gray-500 mr-3 dark:text-gray-400" strokeWidth={2.5} />
          <div className="flex-1 overflow-hidden relative h-5">
            <AnimatePresence mode="wait">
              <motion.span
                key={placeholderIndex}
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -15, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="absolute inset-0 text-[13px] font-medium text-gray-400 dark:text-gray-500"
              >
                {placeholders?.[placeholderIndex] || 'Search "pizza"'}
              </motion.span>
            </AnimatePresence>
          </div>
          <div 
            className="ml-2 border-l border-gray-100 dark:border-gray-800 pl-3 py-1 flex items-center justify-center group/mic"
            onClick={(e) => {
              e.stopPropagation();
              handleSearchFocus(true); 
            }}
          >
            <Mic className="h-5 w-5 text-gray-400 group-hover/mic:text-primary-orange transition-colors" />
          </div>
        </div>

        {/* Veg Mode Switch */}
        <div className="flex flex-col items-center justify-center gap-1 min-w-[44px]">
          <div className="flex flex-col items-center space-y-0.5">
            <span className="text-[11px] font-semibold text-white leading-none tracking-wide">VEG</span>
            <span className="text-[10px] font-semibold text-white/90 leading-none tracking-wide">MODE</span>
          </div>
          <Switch 
            checked={vegMode} 
            onCheckedChange={setVegMode}
            className="scale-[0.8] data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-zinc-400 transition-transform active:scale-90"
          />
        </div>
      </div>
    </div>
  );
}
