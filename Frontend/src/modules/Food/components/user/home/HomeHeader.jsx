import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ChevronDown, Search, Mic, Bell, CheckCircle2, Tag, Gift, AlertCircle, Clock, BellOff, X } from 'lucide-react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@food/components/ui/popover";
import { Badge } from "@food/components/ui/badge";
import { Avatar, AvatarFallback } from "@food/components/ui/avatar";
import foodIcon from "@food/assets/category-icons/food.png";
import quickIcon from "@food/assets/category-icons/quick.png";
import taxiIcon from "@food/assets/category-icons/taxi.png";
import hotelIcon from "@food/assets/category-icons/hotel.png";
import useNotificationInbox from "@food/hooks/useNotificationInbox";

const ICON_MAP = {
  CheckCircle2,
  Tag,
  Gift,
  AlertCircle
};

export default function HomeHeader({ 
  activeTab,
  setActiveTab,
  location, 
  savedAddressText, 
  handleLocationClick, 
  handleSearchFocus, 
  placeholderIndex, 
  placeholders 
}) {
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('food_user_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const {
    items: broadcastNotifications,
    unreadCount: broadcastUnreadCount,
    dismiss: dismissBroadcastNotification,
  } = useNotificationInbox("user", { limit: 20 });

  useEffect(() => {
    const syncNotifications = () => {
      const saved = localStorage.getItem('food_user_notifications');
      setNotifications(saved ? JSON.parse(saved) : []);
    };

    // Listen for updates from the main Notifications page
    window.addEventListener('notificationsUpdated', syncNotifications);
    // Also listen for new notifications being added via listeners in Notifications.jsx (indirectly via localStorage update)
    // But since localStorage doesn't fire events on same window, we can use a custom event or a simple interval if needed.
    // However, the Notifications.jsx already multi-dispatches.
    
    return () => window.removeEventListener('notificationsUpdated', syncNotifications);
  }, []);

  const festCategories = [
    { id: "food", name: "Food", icon: foodIcon, bgColor: "bg-white dark:bg-[#1a1a1a]" },
    { id: "quick", name: "Quick", icon: quickIcon, bgColor: "bg-white dark:bg-[#1a1a1a]" },
    { id: "taxi", name: "Taxi", icon: taxiIcon, bgColor: "bg-white dark:bg-[#1a1a1a]" },
    { id: "hotel", name: "Hotel", icon: hotelIcon, bgColor: "bg-white dark:bg-[#1a1a1a]" },
  ];

  const mergedNotifications = useMemo(() => {
    const localItems = Array.isArray(notifications)
      ? notifications.map((item) => ({ ...item, source: "local" }))
      : [];
    const broadcastItems = (broadcastNotifications || []).map((item) => ({
      ...item,
      source: "broadcast",
      time: item.createdAt
        ? new Date(item.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "Just now",
      type: "broadcast",
      icon: "Bell",
      iconColor: "text-blue-600",
    }));

    return [...broadcastItems, ...localItems].sort(
      (a, b) =>
        new Date(b.createdAt || b.timestamp || 0).getTime() -
        new Date(a.createdAt || a.timestamp || 0).getTime()
    );
  }, [broadcastNotifications, notifications]);

  const unreadCount = notifications.filter(n => !n.read).length + broadcastUnreadCount;

  const handleDeleteNotification = (id, source = "local") => {
    if (source === "broadcast") {
      dismissBroadcastNotification(id);
      return;
    }
    setNotifications((prev) => {
      const next = prev.filter((notification) => notification.id !== id);
      localStorage.setItem('food_user_notifications', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { count: next.filter((n) => !n.read).length } }));
      return next;
    });
  };

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
      <div className="relative z-10 flex items-center justify-between">
        <div 
          className="flex items-center gap-1 cursor-pointer group"
          onClick={handleLocationClick}
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
        <Popover>
          <PopoverTrigger asChild>
            <div className="h-11 w-11 relative flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg cursor-pointer active:scale-95 transition-all dark:bg-white/5 dark:border-white/10">
              <Bell className="h-6 w-6 text-white" />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-yellow-400 rounded-full border-2 border-[#ef4f5f] animate-pulse dark:border-[#111111]" />
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 overflow-hidden border-none shadow-2xl rounded-2xl mt-2" align="end">
            <div className="bg-white dark:bg-gray-900">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Notifications
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-600 border-none text-[10px] h-4">
                      {unreadCount} New
                    </Badge>
                  )}
                </h3>
                <Link to="/food/user/notifications" className="text-xs font-bold text-orange-600 hover:text-orange-700">
                  {mergedNotifications.length > 0 ? "View All" : ""}
                </Link>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {mergedNotifications.length > 0 ? (
                  mergedNotifications.slice(0, 5).map((notif) => {
                    const Icon = ICON_MAP[notif.icon] || Bell;
                    return (
                      <div 
                        key={notif.id}
                        className={`p-4 flex items-start gap-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${!notif.read ? 'bg-orange-50/20' : ''}`}
                      >
                        <div className={`mt-1 p-2 rounded-full ${notif.type === "order" ? "bg-green-100/50 text-green-600" : "bg-orange-100/50 text-orange-600"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{notif.title}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400 whitespace-nowrap">{notif.time}</span>
                              <button
                                type="button"
                                aria-label="Delete notification"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteNotification(notif.id, notif.source);
                                }}
                                className="rounded-full p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center flex flex-col items-center gap-2">
                    <BellOff className="h-10 w-10 text-gray-200" />
                    <p className="text-xs text-gray-400 font-medium">All caught up!</p>
                  </div>
                )}
              </div>
              <div className="p-3 bg-gray-50/50 dark:bg-gray-800/50 text-center">
                <Link to="/food/user/notifications" className="text-xs font-bold text-gray-400 hover:text-gray-600">
                  {mergedNotifications.length > 0 ? "Manage Settings" : "Check Notifications Page"}
                </Link>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Main Category Grid (4 Items) - Compact & Centered */}
      <div className="relative z-10 flex justify-center pb-1">
        <div className="grid grid-cols-4 gap-3 w-full max-w-[340px]">
          {festCategories.map((cat) => (
            <div 
              key={cat.id}
              className={`flex flex-col items-center gap-2 cursor-pointer group relative`}
              onClick={() => setActiveTab(cat.id)}
            >
              <motion.div 
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                className={`w-full aspect-square ${cat.bgColor} rounded-xl flex items-center justify-center p-0 overflow-hidden transition-all duration-300 ${activeTab === cat.id ? 'bg-white scale-105 shadow-[0_0_20px_rgba(255,255,255,0.4)] dark:bg-[#1f1f1f] dark:shadow-[0_0_24px_rgba(255,255,255,0.08)]' : 'bg-white/90 shadow-sm dark:bg-[#161616] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]'}`}
              >
                <img src={cat.icon} alt={cat.name} className={`w-full h-full object-cover transition-transform duration-700 ${activeTab === cat.id ? 'scale-105' : 'scale-100 group-hover:scale-110'}`} />
              </motion.div>
              <span className={`text-[10px] font-bold tracking-wider uppercase transition-all ${activeTab === cat.id ? 'text-white translate-y-0 opacity-100' : 'text-white/40 group-hover:text-white/60'}`}>
                {cat.name}
              </span>
              
              {activeTab === cat.id && (
                <>
                  <motion.div 
                    layoutId="activeTabBadge"
                    className="absolute -top-1 -right-0.5 z-30"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                  >
                    <div className="bg-yellow-400 text-[6px] font-black text-red-600 w-4 h-4 flex items-center justify-center rounded-full border border-white leading-none shadow-xl dark:border-[#1a1a1a]">
                      {"\u2605"}
                    </div>
                  </motion.div>
                  <motion.div 
                    layoutId="indicator"
                    className="absolute -bottom-1.5 w-1 h-1 bg-yellow-400 rounded-full"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Search Bar - More Normal & Clean */}
      <div 
        className="relative z-10 bg-white rounded-xl flex items-center px-4 py-3 shadow-md border border-white/20 cursor-pointer active:scale-[0.99] transition-all duration-200 mx-1 dark:bg-[#1a1a1a] dark:border-gray-800 dark:shadow-[0_12px_30px_rgba(0,0,0,0.3)]"
        onClick={handleSearchFocus}
        onTouchStart={handleSearchFocus}
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
          <input
            type="text"
            readOnly
            aria-label="Search"
            onFocus={handleSearchFocus}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
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
      </div>
    </div>
  );
}
