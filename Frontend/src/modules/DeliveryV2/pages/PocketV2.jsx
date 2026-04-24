import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, IndianRupee, ArrowRight,
  ShieldCheck, AlertTriangle, HelpCircle,
  Receipt, FileText, LayoutGrid, X, ChevronRight,
  Sparkles, Loader2, RefreshCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { formatCurrency } from '@food/utils/currency';
import { initRazorpayPayment } from "@food/utils/razorpay";
import { getCompanyNameAsync } from "@food/utils/businessSettings";
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';

/**
 * PocketV2 - Professional Financial Dashboard.
 * Optimized with Global Cache & Session-First Synchronizing Loader.
 */
export const PocketV2 = () => {
  const navigate = useNavigate();
  
  // Get flags from store
  const { 
    pocketData, 
    lastPocketSync, 
    sessionRefreshed, 
    setPocketData, 
    setSessionRefreshed 
  } = useDeliveryStore();
  
  const [loading, setLoading] = useState(!pocketData || !sessionRefreshed);

  // Initialize state from cache (Instant Load)
  const [walletState, setWalletState] = useState({
    totalBalance: pocketData?.wallet?.totalBalance || 0,
    cashInHand: pocketData?.wallet?.cashInHand || 0,
    availableCashLimit: pocketData?.wallet?.availableCashLimit || 0,
    totalCashLimit: pocketData?.wallet?.totalCashLimit || 0,
    weeklyEarnings: pocketData?.wallet?.weeklyEarnings || 0,
    weeklyOrders: pocketData?.wallet?.weeklyOrders || 0,
    payoutAmount: pocketData?.wallet?.payoutAmount || 0,
    payoutPeriod: pocketData?.wallet?.payoutPeriod || 'Current Week',
    bankDetailsFilled: pocketData?.wallet?.bankDetailsFilled || false
  });

  const [activeOffer, setActiveOffer] = useState({
    targetAmount: pocketData?.offer?.targetAmount || 0,
    targetOrders: pocketData?.offer?.targetOrders || 0,
    currentOrders: pocketData?.offer?.currentOrders || 0,
    currentEarnings: pocketData?.offer?.currentEarnings || 0,
    validTill: pocketData?.offer?.validTill || '',
    isLive: pocketData?.offer?.isLive || false
  });

  const [showDepositPopup, setShowDepositPopup] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  // Helper to fetch fresh data
  const syncData = async (isManual = false) => {
    try {
      // Force full loader if it's the first time in this app session OR if manually clicked
      if (isManual || !sessionRefreshed) {
        setLoading(true);
      }

      const [profileRes, earningsRes, walletRes] = await Promise.all([
        deliveryAPI.getProfile().catch(() => null),
        deliveryAPI.getEarnings({ period: 'week' }).catch(() => null),
        deliveryAPI.getWallet().catch(() => null)
      ]);

      if (!walletRes && !pocketData) {
          toast.error('Connection failed. Please try again.');
          return;
      }

      const profile = profileRes?.data?.data?.profile || {};
      const summary = earningsRes?.data?.data?.summary || {};
      const wallet = walletRes?.data?.data?.wallet || {};
      const activeAddonsRes = await deliveryAPI.getActiveEarningAddons().catch(() => null);
      const activeOfferPayload =
        activeAddonsRes?.data?.data?.activeOffer ||
        activeAddonsRes?.data?.activeOffer ||
        null;
      
      const bankDetails = profile?.documents?.bankDetails;
      const isFilled = !!(bankDetails?.accountNumber);

      const newWalletState = {
        totalBalance: Number(wallet.pocketBalance || 0),
        cashInHand: Number(wallet.cashInHand || 0),
        availableCashLimit: Number(wallet.availableCashLimit || 0),
        totalCashLimit: Number(wallet.totalCashLimit || 0),
        weeklyEarnings: Number(summary.totalEarnings || 0),
        weeklyOrders: Number(summary.totalOrders || 0),
        payoutAmount: Number(wallet.lastPayout?.amount || wallet.totalWithdrawn || 0),
        payoutPeriod: wallet.lastPayout ? new Date(wallet.lastPayout.date).toLocaleDateString() : 'No recent payout',
        bankDetailsFilled: isFilled
      };

      const newOfferState = {
         targetAmount: Number(activeOfferPayload?.targetAmount || 0),
         targetOrders: Number(activeOfferPayload?.targetOrders || 0),
         currentOrders: Number(activeOfferPayload?.currentOrders || 0),
         currentEarnings: Number(activeOfferPayload?.currentEarnings || 0),
         validTill: activeOfferPayload?.validTill || '',
         isLive: Boolean(activeOfferPayload)
      };

      setWalletState(newWalletState);
      setActiveOffer(newOfferState);
      
      if (typeof setPocketData === 'function') {
        setPocketData({
          wallet: newWalletState,
          offer: newOfferState
        });
        // Mark session as refreshed so future visits are instant
        setSessionRefreshed(true);
      }

    } catch (err) {
      console.error("Pocket Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If this is the FIRST time the app is opened (new session), force full refresh
    // Otherwise, use 5-minute stale check for silent background updates
    const isFirstTime = !sessionRefreshed;
    const isStale = !pocketData || (Date.now() - lastPocketSync > 300000); 

    if (isFirstTime) {
      syncData(false); // Will trigger loading: true because sessionRefreshed is false
    } else if (isStale) {
      syncData(false); // Silent sync
    }
  }, []);

  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amt) || amt < 1) {
      toast.error("Enter a valid amount");
      return;
    }
    
    if (amt > walletState.cashInHand) {
       toast.error(`Deposit exceeds cash in hand (₹${walletState.cashInHand})`);
       return;
    }

    try {
      setDepositing(true);
      const orderRes = await deliveryAPI.createDepositOrder(amt);
      const data = orderRes?.data?.data;
      const rp = data?.razorpay;
      
      if (!rp?.orderId) {
        toast.error("Payment failed to start");
        setDepositing(false);
        return;
      }

      const profileRes = await deliveryAPI.getProfile();
      const profile = profileRes?.data?.data?.profile || {};
      const companyName = await getCompanyNameAsync();

      await initRazorpayPayment({
        key: rp.key,
        amount: rp.amount,
        currency: rp.currency || "INR",
        order_id: rp.orderId,
        name: companyName,
        description: `Cash deposit - ₹${amt}`,
        prefill: { name: profile.name, email: profile.email, contact: profile.phone },
        handler: async (res) => {
          try {
            const verifyRes = await deliveryAPI.verifyDepositPayment({
              razorpay_order_id: res.razorpay_order_id,
              razorpay_payment_id: res.razorpay_payment_id,
              razorpay_signature: res.razorpay_signature,
              amount: amt
            });
            if (verifyRes?.data?.success) {
              toast.success("Deposit successful");
              setShowDepositPopup(false);
              setDepositAmount("");
              if (typeof setPocketData === 'function') setPocketData(null);
              syncData(true);
            }
          } catch (err) {
            toast.error("Verification failed");
          } finally {
            setDepositing(false);
          }
        },
        onError: () => setDepositing(false),
        onClose: () => setDepositing(false)
      });
    } catch (err) {
      setDepositing(false);
      toast.error("Deposit failed");
    }
  };

  const ordersProgress = activeOffer.targetOrders > 0 ? Math.min(activeOffer.currentOrders / activeOffer.targetOrders, 1) : 0;
  const earningsProgress = activeOffer.targetAmount > 0 ? Math.min(activeOffer.currentEarnings / activeOffer.targetAmount, 1) : 0;
  const hasActiveOffer = activeOffer.isLive && (activeOffer.targetAmount > 0 || activeOffer.targetOrders > 0);

  const getCurrentWeekRange = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const formatDate = (d) => `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  if (loading) return (
    <div className="fixed inset-0 z-[1000] bg-[#f6e9dc] flex flex-col items-center justify-center font-poppins touch-none">
       <div className="relative">
          <div className="w-16 h-16 border-4 border-gray-100 border-t-orange-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-8 h-8 bg-white rounded-full shadow-sm flex items-center justify-center">
                <Wallet className="w-4 h-4 text-orange-500" />
             </div>
          </div>
       </div>
       <p className="mt-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] animate-pulse">Synchronizing Pocket...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f6e9dc] pb-32 font-poppins relative">
       
       {!walletState.bankDetailsFilled && (
         <div className="bg-yellow-400 px-4 py-3 flex items-center gap-3 border-b border-yellow-500/20">
            <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg">
               <FileText className="w-7 h-7" />
            </div>
            <div className="flex-1">
               <h3 className="text-sm font-bold text-black mb-0.5">Submit bank details</h3>
               <p className="text-xs text-black/80 font-medium">PAN & bank details required</p>
            </div>
            <button 
              onClick={() => navigate('/delivery/profile/details', { state: { backTo: '/delivery/pocket' } })}
              className="bg-yellow-300 text-black px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm"
            >
               Submit
            </button>
         </div>
       )}

       <div className="px-4 py-6 bg-gray-100">
          <div className="flex items-center justify-between mb-5 px-1">
             <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest leading-none">Earnings: {getCurrentWeekRange()}</p>
             <button onClick={() => syncData(true)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
                <RefreshCcw className="w-5 h-5 text-gray-400" />
             </button>
          </div>

          <div 
            onClick={() => navigate('/delivery/earnings')}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center mb-6 transition-all active:scale-[0.98]"
          >
             <h2 className="text-4xl font-black text-black tracking-tighter">
                ₹{walletState.weeklyEarnings.toFixed(0)}
             </h2>
          </div>

          {hasActiveOffer && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-6">
             <div className="bg-black p-4 flex items-center justify-between">
                <div>
                   <h3 className="text-lg font-black text-white leading-none mb-1">Earnings Guarantee</h3>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Target Met: {activeOffer.currentOrders}/{activeOffer.targetOrders}</span>
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/5">
                   <p className="text-lg font-black text-white leading-none mb-0.5">₹{activeOffer.targetAmount}</p>
                   <p className="text-[9px] font-bold text-gray-400 uppercase">Goal</p>
                </div>
             </div>

             <div className="p-8 pb-10 flex items-center justify-around gap-8">
                <div className="flex flex-col items-center">
                   <div className="relative w-28 h-28">
                      <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                         <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                         <motion.circle 
                            cx="50" cy="50" r="45" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round"
                            initial={{ pathLength: 0 }} animate={{ pathLength: ordersProgress }} transition={{ duration: 1.5, ease: "easeOut" }}
                         />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <span className="text-xl font-black text-black leading-none">{activeOffer.currentOrders}</span>
                         <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Orders</span>
                      </div>
                   </div>
                </div>

                <div className="flex flex-col items-center">
                   <div className="relative w-28 h-28">
                      <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                         <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                         <motion.circle 
                            cx="50" cy="50" r="45" fill="none" stroke="#ff8100" strokeWidth="8" strokeLinecap="round"
                            initial={{ pathLength: 0 }} animate={{ pathLength: earningsProgress }} transition={{ duration: 1.5, ease: "easeOut" }}
                         />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                         <span className="text-base font-black text-black leading-none">₹{activeOffer.currentEarnings}</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
             <button onClick={() => navigate('/delivery/pocket/balance')} className="w-full p-5 border-b border-gray-50 flex items-center justify-between active:bg-gray-50">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-black border border-gray-100"><Wallet className="w-6 h-6" /></div>
                   <div><span className="text-sm font-bold text-gray-800 block">Pocket balance</span><p className="text-[10px] text-gray-400 font-bold uppercase">Withdrawal Hub</p></div>
                </div>
                <div className="flex items-center gap-2"><span className="text-base font-black text-black">₹{walletState.totalBalance.toFixed(2)}</span><ChevronRight className="w-4 h-4 text-gray-300" /></div>
             </button>

             <button onClick={() => navigate('/delivery/pocket/cash-limit')} className="w-full p-5 border-b border-gray-50 flex items-center justify-between active:bg-gray-50">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-black border border-gray-100"><ShieldCheck className="w-6 h-6" /></div>
                   <div><span className="text-sm font-bold text-gray-800 block">Available cash limit</span><p className="text-[10px] text-gray-400 font-bold uppercase">Spend Control</p></div>
                </div>
                <div className="flex items-center gap-2"><span className="text-base font-black text-black">₹{walletState.availableCashLimit.toFixed(2)}</span><ChevronRight className="w-4 h-4 text-gray-300" /></div>
             </button>

             <div className="p-5">
                <button onClick={() => setShowDepositPopup(true)} className="w-full py-4 bg-[#ff8100] text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all">Deposit Cash</button>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div onClick={() => navigate('/delivery/pocket/payout')} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 active:bg-gray-50">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 border border-blue-100"><IndianRupee className="w-5 h-5" /></div>
                <p className="text-xl font-black text-black mb-1">₹{walletState.payoutAmount}</p>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">Last Payout</p>
             </div>

             <div onClick={() => navigate('/delivery/pocket/limit-settlement')} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 active:bg-gray-50 flex flex-col justify-between">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#ff8100] mb-4 border border-orange-100"><Receipt className="w-5 h-5" /></div>
                <p className="text-sm font-bold text-gray-800">Limit Settlement</p>
             </div>
          </div>
       </div>

       <AnimatePresence>
          {showDepositPopup && (
             <div className="fixed inset-0 z-[1000] flex items-end">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDepositPopup(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative w-full bg-white rounded-t-[2.5rem] p-8 pb-12 shadow-2xl">
                   <div className="w-16 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
                   <h3 className="text-2xl font-black text-black text-center mb-8">Deposit Cash</h3>
                   <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
                      <div className="flex justify-between items-center mb-4"><span className="text-xs font-bold text-gray-400 uppercase">Cash in hand</span><span className="text-base font-black text-black">₹{walletState.cashInHand}</span></div>
                      <div className="relative">
                         <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                         <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0.00" className="w-full bg-white border border-gray-200 rounded-xl py-4 pl-12 pr-4 text-xl font-bold focus:border-[#ff8100] outline-none" />
                      </div>
                   </div>
                   <button onClick={handleDeposit} disabled={depositing} className="w-full py-5 bg-[#ff8100] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 disabled:bg-gray-300">
                      {depositing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                      {depositing ? 'Processing...' : 'Proceed to Pay'}
                   </button>
                </motion.div>
             </div>
          )}
       </AnimatePresence>
    </div>
  );
};

export default PocketV2;
