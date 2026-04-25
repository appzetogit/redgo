import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { useProximityCheck } from '@/modules/DeliveryV2/hooks/useProximityCheck';
import { useOrderManager } from '@/modules/DeliveryV2/hooks/useOrderManager';
import { useDeliveryNotifications } from '@food/hooks/useDeliveryNotifications';
import { writeOrderTracking } from '@food/realtimeTracking';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';

// Components
import LiveMap from '@/modules/DeliveryV2/components/map/LiveMap';
import { NewOrderModal } from '@/modules/DeliveryV2/components/modals/NewOrderModal';
import { PickupActionModal } from '@/modules/DeliveryV2/components/modals/PickupActionModal';
import { DeliveryVerificationModal } from '@/modules/DeliveryV2/components/modals/DeliveryVerificationModal';
import { OrderSummaryModal } from '@/modules/DeliveryV2/components/modals/OrderSummaryModal';
import ActionSlider from '@/modules/DeliveryV2/components/ui/ActionSlider';

// Sub Pages
import PocketV2 from '@/modules/DeliveryV2/pages/PocketV2';
import HistoryV2 from '@/modules/DeliveryV2/pages/HistoryV2';
import ProfileV2 from '@/modules/DeliveryV2/pages/ProfileV2';

// Icons
import {
  Bell, HelpCircle, AlertTriangle,
  Wallet, History, User as UserIcon, LayoutGrid,
  Plus, Minus, Navigation2, Target, Play, CheckCircle2, Clock, ChevronDown,
  Contact, Package
} from 'lucide-react';

import { getHaversineDistance, calculateETA, calculateHeading } from '@/modules/DeliveryV2/utils/geo';
import { useCompanyName } from "@food/hooks/useCompanyName";
import { useNavigate } from 'react-router-dom';
import useNotificationInbox from "@food/hooks/useNotificationInbox";

/** Minimal bottom-sheet popup (Restored from legacy FeedNavbar) */
function BottomPopup({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[600] flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full bg-white rounded-t-3xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <AlertTriangle className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

/**
 * DeliveryHomeV2 - Premium 1:1 Match with Original App UI.
 * Featuring logical tab switching for Feed, Pocket, History, and Profile.
 */
export default function DeliveryHomeV2({ tab = 'feed' }) {
  const navigate = useNavigate();
  const { isOnline, toggleOnline, activeOrder, tripStatus, setRiderLocation, setActiveOrder, updateTripStatus, clearActiveOrder, riderLocation } = useDeliveryStore();
  const { isWithinRange, distanceToTarget } = useProximityCheck();
  const { acceptOrder, reachPickup, pickUpOrder, reachDrop, completeDelivery, resetTrip } = useOrderManager();
  const { newOrder, clearNewOrder, orderStatusUpdate, clearOrderStatusUpdate, isConnected: isSocketConnected, emitLocation } = useDeliveryNotifications();
  const companyName = useCompanyName();
  const { unreadCount: notificationUnreadCount } = useNotificationInbox("delivery", { limit: 20 });

  const [incomingOrder, setIncomingOrder] = useState(null);
  const [currentTab, setCurrentTab] = useState(tab);

  // Track URL changes (Prop changes) to update sub-page content
  useEffect(() => {
    setCurrentTab(tab);
  }, [tab]);

  const [showVerification, setShowVerification] = useState(false);
  const [showEmergencyPopup, setShowEmergencyPopup] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [emergencyNumbers, setEmergencyNumbers] = useState({
    medicalEmergency: "",
    accidentHelpline: "",
    contactPolice: "",
    insurance: "",
  });

  const [isModalMinimized, setIsModalMinimized] = useState(false);
  const [eta, setEta] = useState(null);
  const lastLocationSentAt = useRef(0);
  const lastCoordRef = useRef(null);
  const rollingSpeedRef = useRef([]);
  const lastAutoArrivalRef = useRef({ PICKING_UP: false, PICKED_UP: false });

  const [zoom, setZoom] = useState(14);
  const [isSimMode, setIsSimMode] = useState(false);
  const [delayedOnline, setDelayedOnline] = useState(false);

  // Intentional transition delay for a "Premium" feel
  useEffect(() => {
    if (isOnline) {
      setDelayedOnline(false);
      const timer = setTimeout(() => setDelayedOnline(true), 1200);
      return () => clearTimeout(timer);
    } else {
      setDelayedOnline(false);
    }
  }, [isOnline]);

  const [simPath, setSimPath] = useState([]);
  const [simIndex, setSimIndex] = useState(0);
  const [simProgress, setSimProgress] = useState(0); // 0 to 1 between points
  const [activePolyline, setActivePolyline] = useState(null);
  const mapRef = useRef(null);

  const isLoggingOut = useRef(false);
  const handleLogout = useCallback((reason = 'expired') => {
    if (isLoggingOut.current) return;

    // If it's a manual logout or already unauthenticated, don't show "Session Expired"
    const isActuallyAuth = localStorage.getItem('delivery_accessToken');

    isLoggingOut.current = true;

    // 1. Clear tokens and state
    localStorage.removeItem('delivery_accessToken');
    localStorage.removeItem('delivery_refreshToken');
    localStorage.removeItem('delivery_authenticated');
    localStorage.removeItem('delivery_user');
    localStorage.removeItem("delivery-v2-session");

    // 2. Alert user ONLY IF it was an unexpected expiration
    if (reason === 'expired' && isActuallyAuth) {
      toast.error("Session Expired", {
        description: "Your session has ended. Please log in again.",
        id: 'session-expired-toast' // Deduplication
      });
    }

    navigate("/delivery/login", { replace: true });

    // Optional: Reset store state
    useDeliveryStore.getState().toggleOnline(); // Reset online status
  }, [navigate]);

  useEffect(() => {
    const onAuthFailure = (e) => {
      if (e.detail?.module === 'delivery') {
        handleLogout('expired');
      }
    };
    window.addEventListener('authRefreshFailed', onAuthFailure);
    return () => window.removeEventListener('authRefreshFailed', onAuthFailure);
  }, [handleLogout]);

  // 0. Auto-Simulation Effect (High-Precision Smooth Glide)
  const lastSimUpdateSentAt = useRef(0);
  useEffect(() => {
    let interval;
    if (isSimMode && simPath.length > 1 && simIndex < simPath.length - 1) {
      interval = setInterval(() => {
        setSimProgress(prev => {
          const nextProgress = prev + 0.08; // 8% movement per tick

          if (nextProgress >= 1) {
            setSimIndex(idx => idx + 1);
            return 0; // Move to next segment
          }

          const currentPoint = simPath[simIndex];
          const nextPoint = simPath[simIndex + 1];

          if (currentPoint && nextPoint) {
            // Linear Interpolation (LERP)
            const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * nextProgress;
            const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * nextProgress;
            const heading = calculateHeading(currentPoint.lat, currentPoint.lng, nextPoint.lat, nextPoint.lng);

            setRiderLocation({ lat, lng, heading });

            if (mapRef.current) {
              mapRef.current.panTo({ lat, lng });
            }

            // Sync with backend every 2.5 seconds during simulation so customer sees it
            const now = Date.now();
            if (now - lastSimUpdateSentAt.current >= 2000) { // Reduced to 2s to match backend throttle
              lastSimUpdateSentAt.current = now;
              const payload = {
                lat,
                lng,
                heading,
                orderId: activeOrder?.orderId || activeOrder?._id,
                status: 'on_the_way',
                polyline: activePolyline // Include polyline in every stream update for resilience
              };
              // A. HTTP Backup
              deliveryAPI.updateLocation(lat, lng, true, { heading }).catch(() => { });

              // B. SOCKET LIVE (SILKY SMOOTH)
              if (payload.orderId) emitLocation(payload);

              // C. FIREBASE REALTIME DB (Persistent Route for Customer Map)
              if (payload.orderId) {
                writeOrderTracking(payload.orderId, {
                  lat,
                  lng,
                  heading,
                  polyline: activePolyline,
                  status: tripStatus,
                  eta: eta // Publish live ETA to Firebase
                }).catch(() => { });
              }
            }
          }
          return nextProgress;
        });
      }, 50); // 20 FPS movement
    }
    return () => clearInterval(interval);
  }, [isSimMode, simPath, simIndex, activeOrder, emitLocation, activePolyline, eta, tripStatus]);

  // Fetch Emergency numbers and Profile (Restored logic)
  useEffect(() => {
    (async () => {
      try {
        const [emergencyRes, profileRes] = await Promise.all([
          deliveryAPI.getEmergencyHelp(),
          deliveryAPI.getProfile()
        ]);
        if (emergencyRes?.data?.success && emergencyRes.data.data) {
          setEmergencyNumbers(emergencyRes.data.data);
        }
        if (profileRes?.data?.success && profileRes.data.data?.profile) {
          const profile = profileRes.data.data.profile;
          setProfileImage(profile.profileImage?.url || profile.documents?.photo || null);
        }
      } catch (err) { }
    })();
  }, []);

  const emergencyOptions = [
    { title: "Medical Emergency", subtitle: "Call an ambulance", icon: <AlertTriangle className="text-red-600" />, phone: emergencyNumbers.medicalEmergency },
    { title: "Accident Helpline", subtitle: "Report an accident", icon: <AlertTriangle className="text-orange-600" />, phone: emergencyNumbers.accidentHelpline },
    { title: "Contact Police", subtitle: "Nearest police support", icon: <AlertTriangle className="text-blue-600" />, phone: emergencyNumbers.contactPolice },
    { title: "Insurance", subtitle: "Policy & claim help", icon: <AlertTriangle className="text-green-600" />, phone: emergencyNumbers.insurance },
  ];

  useEffect(() => {
    if (isSimMode) {
      setSimIndex(0);
      setSimProgress(0);
    }
  }, [simPath, tripStatus, isSimMode]);

  // Auto-restore modal when status or content changes
  useEffect(() => {
    setIsModalMinimized(false);
  }, [tripStatus, showVerification, incomingOrder]);

  // 1. Initial Sync (Force sync with server to avoid 'stuck' persistent state)
  useEffect(() => {
    const syncWithServer = async () => {
      const token = localStorage.getItem('delivery_accessToken');
      if (!token || isLoggingOut.current) return;

      try {
        const response = await deliveryAPI.getCurrentDelivery();
        const rawData = response?.data?.data?.activeOrder || response?.data?.data;
        const serverData = (rawData && (rawData._id || rawData.orderId)) ? rawData : null;

        if (serverData) {
          // Robust location mapping (Same as acceptOrder logic)
          const getLoc = (ref, keysLat, keysLng) => {
            if (!ref) return null;
            if (ref.location) {
              if (Array.isArray(ref.location.coordinates) && ref.location.coordinates.length >= 2) {
                return {
                  lat: ref.location.coordinates[1],
                  lng: ref.location.coordinates[0]
                };
              }
              return {
                lat: ref.location.latitude || ref.location.lat,
                lng: ref.location.longitude || ref.location.lng
              };
            }
            for (const k of keysLat) { if (ref[k] != null) return { lat: ref[k], lng: ref[keysLng[keysLat.indexOf(k)]] }; }
            return null;
          };

          const resLoc = getLoc(serverData.restaurantId, ['latitude', 'lat'], ['longitude', 'lng']) ||
            getLoc(serverData, ['restaurant_lat', 'restaurantLat', 'latitude'], ['restaurant_lng', 'restaurantLng', 'longitude']);

          const cusLoc = getLoc(serverData.deliveryAddress, ['latitude', 'lat'], ['longitude', 'lng']) ||
            getLoc(serverData, ['customer_lat', 'customerLat', 'latitude'], ['customer_lng', 'customerLng', 'longitude']);

          const syncedOrder = {
            ...serverData,
            restaurantLocation: resLoc,
            customerLocation: cusLoc
          };

          setActiveOrder(syncedOrder);

          const backendStatus = serverData.deliveryStatus || serverData.orderState?.status || serverData.orderStatus || serverData.status;
          const currentPhase = serverData.deliveryState?.currentPhase;

          if (['delivered', 'completed', 'DELIVERED'].includes(backendStatus)) {
            updateTripStatus('COMPLETED');
          } else if (currentPhase === 'at_drop' || ['reached_drop', 'REACHED_DROP'].includes(backendStatus)) {
            updateTripStatus('REACHED_DROP');
          } else if (['picked_up', 'PICKED_UP', 'delivering'].includes(backendStatus)) {
            updateTripStatus('PICKED_UP');
          } else if (currentPhase === 'at_pickup' || ['reached_pickup', 'REACHED_PICKUP'].includes(backendStatus)) {
            updateTripStatus('REACHED_PICKUP');
          } else if (['confirmed', 'preparing', 'ready_for_pickup'].includes(backendStatus)) {
            updateTripStatus('PICKING_UP');
          }
        } else {
          clearActiveOrder();
        }
      } catch (err) {
        clearActiveOrder();
      }
    };
    syncWithServer();
  }, []); // Only on mount to stabilize state

  // 1.5 Professional Unified ETA Calculation Hook
  useEffect(() => {
    // If we have distance, calculate ETA. Fallback to 8m/s (28km/h) avg if GPS speed is unknown.
    if (distanceToTarget != null && distanceToTarget !== Infinity) {
      const avgSpeed = rollingSpeedRef.current.length > 0
        ? rollingSpeedRef.current.reduce((a, b) => a + b, 0) / rollingSpeedRef.current.length
        : 8;

      setEta(calculateETA(distanceToTarget, avgSpeed));
    } else {
      setEta(null);
    }
  }, [distanceToTarget]);

  // 2. Online/Offline Status Sync (Low Frequency)
  useEffect(() => {
    // Only attempt sync if we have a token to prevent console 401s during login/logout transitions
    const token = localStorage.getItem('delivery_accessToken');
    if (!token || isLoggingOut.current) return;

    deliveryAPI.updateOnlineStatus(isOnline).catch(() => { });
  }, [isOnline]);

  // 3. Location logic (Smart Frequency Tracking)
  useEffect(() => {
    let errorCount = 0;
    const watchId = navigator.geolocation.watchPosition((pos) => {
      errorCount = 0;
      if (isSimMode) return;

      const { latitude: lat, longitude: lng, heading, speed } = pos.coords;
      const now = Date.now();

      const currentRiderPos = { lat, lng, heading: heading || 0 };
      setRiderLocation(currentRiderPos);

      if (speed && speed > 0) {
        rollingSpeedRef.current = [...rollingSpeedRef.current.slice(-4), speed]; // keep last 5 points
      }

      const distMoved = lastCoordRef.current
        ? getHaversineDistance(lat, lng, lastCoordRef.current.lat, lastCoordRef.current.lng)
        : 1000;

      if (isOnline || activeOrder) {
        if (distMoved >= 25 || (now - lastLocationSentAt.current >= 7000)) {
          lastLocationSentAt.current = now;
          lastCoordRef.current = { lat, lng };

          deliveryAPI.updateLocation(lat, lng, true, {
            heading: heading || 0,
            speed: speed || 0,
            accuracy: pos.coords.accuracy
          }).catch(() => { });

          if (activeOrder?._id || activeOrder?.orderId) {
            emitLocation({
              lat, lng, heading: heading || 0,
              orderId: activeOrder._id || activeOrder.orderId
            });
            writeOrderTracking(activeOrder._id || activeOrder.orderId, {
              lat, lng, heading: heading || 0,
              polyline: activePolyline,
              status: tripStatus,
              eta: eta
            }).catch(() => { });
          }
        }
      }
    }, (err) => {
      errorCount++;
      if (errorCount >= 3) {
        toast.error('GPS Signal Weak', { description: 'Please check your location settings.' });
        errorCount = 0;
      }
    }, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, setRiderLocation, isSimMode, activeOrder, activePolyline, tripStatus, eta]);

  useEffect(() => {
    if (!isOnline) return;
    const pingInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastLocationSentAt.current >= 15000 && lastCoordRef.current) {
        lastLocationSentAt.current = now;
        deliveryAPI.updateLocation(lastCoordRef.current.lat, lastCoordRef.current.lng, true).catch(() => { });
      }
    }, 10000);
    return () => clearInterval(pingInterval);
  }, [isOnline]);

  useEffect(() => { if (newOrder) setIncomingOrder(newOrder); }, [newOrder]);

  useEffect(() => {
    if (activeOrder && incomingOrder) {
      setIncomingOrder(null);
    }
  }, [activeOrder, incomingOrder]);

  useEffect(() => {
    if (!isOnline) return;
    if (currentTab !== 'feed') return;
    if (activeOrder) return;

    let cancelled = false;
    const hydrateAvailableOrder = async () => {
      try {
        const currentResponse = await deliveryAPI.getCurrentDelivery();
        const currentPayload = currentResponse?.data?.data?.activeOrder || currentResponse?.data?.data || null;

        if (!cancelled && currentPayload && (currentPayload._id || currentPayload.orderId)) {
          setActiveOrder(currentPayload);
          return;
        }

        const availableResponse = await deliveryAPI.getOrders({ limit: 20, page: 1 });
        const availablePayload = availableResponse?.data?.data || availableResponse?.data || {};
        const availableOrders = Array.isArray(availablePayload?.docs) ? availablePayload.docs :
          Array.isArray(availablePayload?.items) ? availablePayload.items :
            Array.isArray(availablePayload) ? availablePayload : [];

        const nextIncomingOrder = availableOrders.find((order) => {
          const dispatchStatus = String(order?.dispatch?.status || '').toLowerCase();
          const orderStatus = String(order?.orderStatus || order?.status || '').toLowerCase();
          return (
            ['unassigned', 'assigned'].includes(dispatchStatus) &&
            ['confirmed', 'preparing', 'ready_for_pickup'].includes(orderStatus)
          );
        });

        if (!cancelled && nextIncomingOrder) {
          setIncomingOrder((prev) => {
            const prevId = prev?.orderId || prev?._id || prev?.orderMongoId;
            const nextId = nextIncomingOrder?.orderId || nextIncomingOrder?._id || nextIncomingOrder?.orderMongoId;
            return prevId === nextId && prev ? prev : nextIncomingOrder;
          });
        }
      } catch (error) { }
    };

    void hydrateAvailableOrder();
    const poller = window.setInterval(() => {
      if (!document.hidden) void hydrateAvailableOrder();
    }, isSocketConnected ? 12000 : 5000);

    return () => {
      cancelled = true;
      window.clearInterval(poller);
    };
  }, [activeOrder, currentTab, isOnline, isSocketConnected, setActiveOrder]);

  useEffect(() => {
    if (orderStatusUpdate) {
      if (orderStatusUpdate.status === 'cancelled') {
        toast.error('Order cancelled');
        resetTrip();
      }
      clearOrderStatusUpdate();
    }
  }, [orderStatusUpdate, resetTrip, clearOrderStatusUpdate]);

  const handleCenterMap = () => {
    if (mapRef.current && useDeliveryStore.getState().riderLocation) {
      const loc = useDeliveryStore.getState().riderLocation;
      mapRef.current.panTo({ lat: parseFloat(loc.lat || loc.latitude), lng: parseFloat(loc.lng || loc.longitude) });
    }
  };

  const handleMapClick = (lat, lng) => {
    if (activeOrder || incomingOrder || showVerification) {
      setIsModalMinimized(true);
    }
  };

  return (
    <div className="relative h-screen w-full bg-white text-gray-900 overflow-hidden flex flex-col">
      {/* ─── 1. TOP HEADER (Premium Dark Gray) ─── */}
      {currentTab !== 'history' && (
        <div className="absolute top-0 inset-x-0 bg-[#121212]/95 backdrop-blur-2xl shadow-2xl z-[200] safe-top pb-2 border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-4">
              <div
                onClick={() => navigate('/delivery/profile')}
                className="w-10 h-10 rounded-full border border-white/20 p-0.5 shadow-xl overflow-hidden bg-white/10 cursor-pointer active:scale-95 transition-all"
              >
                <img
                  src={profileImage || "https://img.icons8.com/ios-filled/100/ffffff/user-male-circle.png"}
                  alt="Profile"
                  className="w-full h-full object-cover rounded-full opacity-80"
                />
              </div>
              <button
                onClick={async () => {
                  const nextState = !isOnline;
                  toggleOnline();
                  if (nextState) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      deliveryAPI.updateLocation(pos.coords.latitude, pos.coords.longitude, true).catch(() => { });
                    }, null, { enableHighAccuracy: true });
                  } else {
                    deliveryAPI.updateOnlineStatus(false).catch(() => { });
                  }
                }}
                className={`relative w-[92px] h-8 rounded-full p-1 transition-all duration-500 flex items-center ${isOnline ? 'bg-green-500 shadow-lg shadow-green-500/20' : 'bg-gray-400'}`}
              >
                <div className={`flex items-center justify-between w-full px-2 text-[8.5px] font-black uppercase tracking-widest text-white`}>
                  <span>{isOnline ? 'Online' : ''}</span>
                  <span>{!isOnline ? 'Offline' : ''}</span>
                </div>
                <motion.div animate={{ x: isOnline ? 59 : 0 }} className="absolute left-1 w-6 h-6 bg-white rounded-full shadow-sm" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowEmergencyPopup(true)} className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 active:scale-95 transition-all shadow-lg"><AlertTriangle className="w-4 h-4" /></button>
              <button onClick={() => navigate('/delivery/help/id-card')} className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 active:scale-95 transition-all shadow-lg"><Contact className="w-4 h-4" /></button>
              <button onClick={() => navigate('/delivery/notifications')} className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/10 active:scale-95 transition-all shadow-lg"><Bell className="w-4 h-4" />{notificationUnreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-400 border border-[#1f1f1f]" />}</button>
            </div>
          </div>

          {currentTab === 'feed' && (
            <AnimatePresence>
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="px-4 mt-1">
                {activeOrder ? (
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <div className="bg-[#ff8100] rounded-2xl p-3.5 shadow-xl shadow-orange-500/20 border border-orange-400/50 flex items-center justify-between overflow-hidden relative">
                      <div className="flex flex-col z-10">
                        <span className="text-[9px] text-white/70 font-black uppercase tracking-[0.15em] mb-1">Distance</span>
                        <div className="flex items-end gap-1">
                          <span className="text-2xl font-black text-white leading-none tracking-tighter">{distanceToTarget && distanceToTarget !== Infinity ? (distanceToTarget / 1000).toFixed(1) : '--'}</span>
                          <span className="text-[11px] text-white/80 font-bold mb-0.5">KM</span>
                        </div>
                      </div>
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center z-10 shadow-lg"><Navigation2 className="w-4 h-4 text-[#ff8100] rotate-45" /></div>
                    </div>
                    <div className="bg-[#10B981] rounded-2xl p-3.5 shadow-xl shadow-green-500/20 border border-green-400/50 flex items-center justify-between relative overflow-hidden group">
                      <div className="flex flex-col z-10">
                        <span className="text-[9px] text-white/70 font-black uppercase tracking-[0.15em] mb-1">Arrival</span>
                        <div className="flex items-end gap-1">
                          <span className="text-2xl font-black text-white leading-none tracking-tighter">{eta ? String(eta) : '--'}</span>
                          <span className="text-[11px] text-white/80 font-bold mb-0.5">MIN</span>
                        </div>
                      </div>
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center z-10 shadow-lg"><Clock className="w-4 h-4 text-[#10B981]" /></div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-2xl p-4 flex items-center border border-white/5 shadow-sm backdrop-blur-md">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center"><div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} /></div>
                      <div>
                        <h3 className="text-white font-black text-[11px] uppercase tracking-widest leading-none mb-1">{isOnline ? 'System Online' : 'System Offline'}</h3>
                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-tight">{isOnline ? 'Waiting for order requests' : 'Go online to receive jobs'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}

      {/* ─── 2. MAIN CONTENT ─── */}
      <div className={`flex-1 relative overflow-y-auto ${currentTab === 'history' ? 'pt-0' : (currentTab === 'feed' ? 'pt-[120px]' : 'pt-[64px]')} no-scrollbar bg-transparent`}>
        {currentTab === 'feed' ? (
          <div className="absolute inset-0 top-[-120px]">
            <div className={`absolute inset-0 transition-all duration-1000 ease-out ${(delayedOnline || activeOrder) ? 'opacity-100 scale-100 translate-y-0 blur-0' : 'opacity-0 scale-95 -translate-y-8 blur-sm pointer-events-none'}`}>
              <LiveMap
                key={`map-v2-${isOnline}`}
                onMapLoad={(m) => mapRef.current = m}
                onMapClick={handleMapClick}
                onPathReceived={setSimPath}
                onPolylineReceived={(poly) => {
                  setActivePolyline(poly);
                  const orderId = activeOrder?.orderId || activeOrder?._id;
                  if (orderId && poly) writeOrderTracking(orderId, { polyline: poly, status: tripStatus, eta: eta }).catch(() => { });
                }}
                zoom={zoom}
              />
            </div>

            {(!isOnline && !activeOrder) && (
              <div className="absolute inset-x-0 bottom-0 top-[120px] bg-white flex items-center justify-center z-[10]">
                <div className="flex flex-col items-center gap-6 px-10 text-center animate-in fade-in zoom-in duration-500">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center shadow-sm border border-slate-100"><LayoutGrid className="w-10 h-10 text-slate-300" /></div>
                  <div className="space-y-2">
                    <p className="text-slate-900 font-bold text-lg leading-tight">You’re currently offline</p>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed">Go online to view the map and start receiving delivery requests.</p>
                  </div>
                </div>
              </div>
            )}

            {(isOnline && !delayedOnline && !activeOrder) && (
              <div className="absolute inset-x-0 bottom-0 top-[120px] bg-white flex items-center justify-center z-[11] animate-in fade-in duration-300">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin shadow-sm" />
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-slate-900 font-bold text-sm tracking-tight uppercase">Loading Map...</span>
                    <span className="text-slate-400 text-[10px] font-medium tracking-widest uppercase animate-pulse">Establishing Connection</span>
                  </div>
                </div>
              </div>
            )}

            {isSimMode && (
              <div className="absolute top-[180px] left-4 right-4 z-[100] bg-black/80 backdrop-blur-md rounded-xl p-4 border border-white/20 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center animate-pulse"><Play className="w-4 h-4 text-white fill-current" /></div>
                  <div className="flex flex-col">
                    <span className="text-orange-500 text-[10px] font-bold uppercase tracking-widest">Auto Navigation Active</span>
                    <span className="text-white text-[11px] font-medium">Following actual road path...</span>
                  </div>
                </div>
                <button onClick={() => setIsSimMode(false)} className="bg-white/10 text-white/50 hover:text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/10">Stop</button>
              </div>
            )}

            {/* MAP TOOLS (Original Logic Restored) */}
            {(delayedOnline || activeOrder) && (
              <div className="absolute right-4 bottom-28 md:bottom-32 flex flex-col gap-4 z-[120] animate-in fade-in slide-in-from-right-8 duration-700 delay-300">
                <div className="flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                  <button onClick={() => setZoom(z => Math.min(22, z + 1))} className="p-3 hover:bg-gray-50 border-b border-gray-100 text-gray-900 active:scale-90 transition-all font-sans" aria-label="Zoom in"><Plus className="w-5 h-5 stroke-[2.75]" /></button>
                  <button onClick={() => setZoom(z => Math.max(8, z - 1))} className="p-3 hover:bg-gray-50 text-gray-900 active:scale-90 transition-all font-sans" aria-label="Zoom out"><Minus className="w-5 h-5 stroke-[2.75]" /></button>
                </div>

                <button
                  onClick={() => {
                    const nextSimState = !isSimMode;
                    setIsSimMode(nextSimState);

                    if (nextSimState) {
                      toast.warning('Simulation Mode Active');
                      if (!useDeliveryStore.getState().riderLocation && activeOrder) {
                        const target = activeOrder.restaurantLocation || activeOrder.customerLocation;
                        if (target) {
                          const lat = parseFloat(target.lat || target.latitude);
                          const lng = parseFloat(target.lng || target.longitude);
                          useDeliveryStore.getState().setRiderLocation({
                            lat: lat + 0.001,
                            lng: lng + 0.001,
                            heading: 0
                          });
                        }
                      }
                    }
                  }}
                  className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center border border-gray-200 transition-all active:scale-90 ${isSimMode ? 'bg-orange-500 text-white' : 'bg-white text-green-500'}`}
                >
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isSimMode ? 'border-white' : 'border-green-500'}`}>
                    <Play className={`w-4 h-4 fill-current ml-0.5 ${isSimMode ? 'animate-pulse' : ''}`} />
                  </div>
                </button>

                <button
                  onClick={() => mapRef.current?.setOptions({ gestureHandling: 'greedy' })}
                  className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-blue-600 border border-gray-200 active:scale-90 transition-all"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-blue-600 flex items-center justify-center"><Navigation2 className="w-4 h-4" /></div>
                </button>

                <button
                  onClick={handleCenterMap}
                  className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-gray-900 border border-gray-100 group active:scale-90 transition-all"
                >
                  <Target className="w-7 h-7" />
                </button>
              </div>
            )}
          </div>
        ) : currentTab === 'pocket' ? (
          <PocketV2 />
        ) : currentTab === 'history' ? (
          <HistoryV2 />
        ) : (
          <ProfileV2 />
        )}
      </div>

      {(currentTab === 'feed' || activeOrder) && (
        <AnimatePresence>
          {!isModalMinimized && (
            <motion.div key="modal-container" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-x-0 top-0 bottom-[92px] z-[300] pointer-events-none flex items-end">
              <div className="w-full pointer-events-auto relative">
                {incomingOrder && (
                  <NewOrderModal order={incomingOrder} onAccept={(o) => { acceptOrder(o); setIncomingOrder(null); clearNewOrder(); }} onReject={() => { setIncomingOrder(null); clearNewOrder(); }} onMinimize={() => setIsModalMinimized(true)} />
                )}
                {(tripStatus === 'PICKING_UP' || tripStatus === 'REACHED_PICKUP') && (
                  <PickupActionModal order={activeOrder} status={tripStatus} isWithinRange={isWithinRange} distanceToTarget={distanceToTarget} eta={eta} onReachedPickup={reachPickup} onPickedUp={(billImageUrl) => pickUpOrder(billImageUrl)} onMinimize={() => setIsModalMinimized(true)} />
                )}
                {(tripStatus === 'PICKED_UP' || tripStatus === 'REACHED_DROP') && (
                  <div className="absolute bottom-4 inset-x-0 z-[120] px-4">
                    {tripStatus === 'PICKED_UP' ? (
                      <div className="bg-white rounded-[3rem] p-8 shadow-[0_-20px_80px_rgba(0,0,0,0.4)] border border-gray-100 flex flex-col items-center">
                        <div className="w-full flex justify-center pb-4 pt-0 -mt-2"><button onClick={() => setIsModalMinimized(true)} className="p-1 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex flex-col items-center"><ChevronDown className="w-6 h-6 text-gray-400 stroke-[3]" /></button></div>
                        <div className="flex justify-between w-full items-center mb-10 px-2 text-left">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-gray-100 shadow-sm"><img src={activeOrder?.user?.logo || activeOrder?.user?.profileImage || 'https://cdn-icons-png.flaticon.com/512/1275/1275302.png'} className="w-full h-full object-cover" alt="User" /></div>
                            <div><h3 className="text-gray-950 text-2xl font-bold uppercase">Handover Drop</h3><p className={`text-[10px] font-bold uppercase tracking-[0.2em] mt-1.5 ${isWithinRange ? 'text-green-600' : 'text-orange-500'}`}>{isWithinRange ? 'Ready - Swipe to Arrive √' : `${(distanceToTarget / 1000).toFixed(1)} km • ${eta || '--'} min Arrival`}</p></div>
                          </div>
                        </div>
                        {activeOrder?.note && (
                          <div className="w-full bg-orange-50 border border-orange-100 rounded-3xl p-5 mb-8 flex gap-4 items-start shadow-sm mx-2">
                            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-orange-500 shadow-sm shrink-0 border border-orange-50"><Package className="w-5 h-5" /></div>
                            <div className="flex-1"><p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] mb-1.5 opacity-80">Drop Message</p><p className="text-sm font-bold text-gray-950 leading-relaxed capitalize">"{activeOrder.note}"</p></div>
                          </div>
                        )}
                        <ActionSlider label="Slide to Arrive" successLabel="Arrived ✓" disabled={!isWithinRange} onConfirm={reachDrop} color="bg-blue-600" />
                      </div>
                    ) : (
                      <button onClick={() => setShowVerification(true)} className="w-full bg-green-500 hover:bg-green-600 text-white shadow-xl shadow-green-500/30 rounded-2xl py-5 font-bold text-sm tracking-[0.2em] transform transition-all active:scale-95 flex items-center justify-center gap-3"><CheckCircle2 className="w-6 h-6" /> VERIFY & COMPLETE</button>
                    )}
                  </div>
                )}
                {showVerification && tripStatus !== 'COMPLETED' && (
                  <DeliveryVerificationModal order={activeOrder} onComplete={async (otp) => { const res = await completeDelivery(otp); setShowVerification(false); return res; }} onClose={() => setShowVerification(false)} />
                )}
                {tripStatus === 'COMPLETED' && <OrderSummaryModal order={activeOrder} onDone={resetTrip} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <BottomPopup isOpen={showEmergencyPopup} title="Emergency Help" onClose={() => setShowEmergencyPopup(false)}>
        <div className="grid gap-4 py-2">
          {emergencyOptions.map((opt, i) => (
            <button key={i} onClick={() => { const num = opt.phone?.replace(/\D/g, ''); if (num) window.location.href = `tel:${num}`; else toast.error('Number not configured'); }} className="flex items-center gap-5 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 active:scale-95 transition-all text-left">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-xl">{opt.icon}</div>
              <div><h4 className="font-bold text-gray-900">{opt.title}</h4><p className="text-xs text-gray-500 font-medium">{opt.subtitle}</p></div>
            </button>
          ))}
        </div>
      </BottomPopup>

      {isModalMinimized && (activeOrder || incomingOrder || showVerification) && (
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-[100px] inset-x-0 z-[300] px-6">
          <button onClick={() => setIsModalMinimized(false)} className="w-full bg-gray-900/90 text-white rounded-2xl py-4 flex items-center justify-between px-6 shadow-2xl backdrop-blur-md border border-white/10">
            <div className="flex flex-col items-start gap-0.5"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order Action Pending</span><span className="text-xs font-bold uppercase tracking-wider">Tap to open delivery panel</span></div>
            <div className="bg-orange-500 p-2 rounded-xl text-white"><Plus className="w-5 h-5" /></div>
          </button>
        </motion.div>
      )}

      {/* ─── 3. BOTTOM NAV (True Navy Glassmorphism) ─── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm z-[500] px-2 py-1">
        <div className="bg-white/70 backdrop-blur-2xl border-2 border-slate-900/30 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex justify-between items-center px-2 py-1.5 ring-1 ring-slate-900/10">
          {[
            { id: 'feed', label: 'Feed', icon: LayoutGrid, path: '/delivery/feed' },
            { id: 'pocket', label: 'Pocket', icon: Wallet, path: '/delivery/pocket' },
            { id: 'history', label: 'History', icon: History, path: '/delivery/history' },
            { id: 'profile', label: 'Profile', icon: UserIcon, path: '/delivery/profile' }
          ].map((nav) => (
            <button
              key={nav.id}
              onClick={() => navigate(nav.path)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors duration-200 rounded-full will-change-transform ${currentTab === nav.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'
                }`}
            >
              <nav.icon className={`w-5 h-5 ${currentTab === nav.id ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${currentTab === nav.id ? 'opacity-100' : 'opacity-70'}`}>{nav.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
