import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';

/**
 * useOrderManager - Professional hook for real-world trip lifecycle actions.
 * Connects directly to the backend API services.
 */
export const useOrderManager = () => {
  const { 
    activeOrder, tripStatus, updateTripStatus, clearActiveOrder, setActiveOrder, riderLocation 
  } = useDeliveryStore();

  const acceptOrder = async (order) => {
    const orderId = order?.orderId || order?._id || order?.id;
    if (!orderId) {
      toast.error('Invalid order data');
      return;
    }

    try {
      const response = await deliveryAPI.acceptOrder(orderId);
      
      if (response?.data?.success) {
        const fullOrder = response.data.data?.order || order;
        
        // Robustly determine locations from multiple possible formats (Populated API vs Socket)
        const getLoc = (ref, keysLat, keysLng) => {
          if (!ref) return null;
          // Handle nested populated objects
          if (ref.location) {
            // Handle GeoJSON format: location: { type: 'Point', coordinates: [lng, lat] }
            if (Array.isArray(ref.location.coordinates) && ref.location.coordinates.length >= 2) {
              return {
                lat: ref.location.coordinates[1], // Latitude is second in GeoJSON [lng, lat]
                lng: ref.location.coordinates[0]  // Longitude is first
              };
            }
            // Handle standard object format: location: { latitude: 12.3, longitude: 45.6 }
            return {
              lat: ref.location.latitude || ref.location.lat,
              lng: ref.location.longitude || ref.location.lng
            };
          }
          // Handle flat objects or direct lat/lng keys
          for (const k of keysLat) { if (ref[k] != null) return { lat: ref[k], lng: ref[keysLng[keysLat.indexOf(k)]] }; }
          return null;
        };

        console.log('[OrderManager] Raw Full Order Data:', fullOrder);

        const resLoc = getLoc(fullOrder.restaurantId, ['latitude', 'lat'], ['longitude', 'lng']) || 
                       getLoc(fullOrder, ['restaurant_lat', 'restaurantLat', 'latitude'], ['restaurant_lng', 'restaurantLng', 'longitude']);
                       
        const cusLoc = getLoc(fullOrder.deliveryAddress, ['latitude', 'lat'], ['longitude', 'lng']) || 
                       getLoc(fullOrder, ['customer_lat', 'customerLat', 'latitude'], ['customer_lng', 'customerLng', 'longitude']);

        console.log('[OrderManager] Locations Mapped Result:', { resLoc, cusLoc });

        setActiveOrder({
          ...fullOrder,
          orderId: orderId,
          restaurantLocation: resLoc,
          customerLocation: cusLoc
        });

        updateTripStatus('PICKING_UP');
        // toast.success('Order Accepted! Opening Map...');
      } else {
        toast.error(response?.data?.message || 'Order already taken or unavailable');
        throw new Error('Accept failed');
      }
    } catch (error) {
      console.error('Accept Order Error:', error);
      toast.error('Network error. Please try again.');
      throw error;
    }
  };

  /**
   * Mark "Reached Pickup" (Arrival at restaurant)
   */
  const reachPickup = async () => {
    const orderId = activeOrder?.orderId;
    try {
      const response = await deliveryAPI.confirmReachedPickup(orderId);
      if (response?.data?.success) {
        updateTripStatus('REACHED_PICKUP');
        // toast.info('Arrived at Restaurant');
      } else {
        throw new Error('Confirm pickup failed');
      }
    } catch (error) {
      toast.error('Failed to update status');
      throw error;
    }
  };

  /**
   * Mark "Picked Up" (Confirm order ID & start delivery)
   */
  const pickUpOrder = async (billImageUrl) => {
    const orderId = activeOrder?.orderId;
    try {
      // confirmOrderId(orderId, confirmedOrderId, location, data)
      const response = await deliveryAPI.confirmOrderId(
        orderId, 
        activeOrder.displayOrderId || orderId, 
        riderLocation || {},
        { billImageUrl }
      );
      
      if (response?.data?.success) {
        updateTripStatus('PICKED_UP');
        // toast.success('Order Collected! Heading to Drop-off');
      } else {
        throw new Error('Confirm order ID failed');
      }
    } catch (error) {
      toast.error('Error confirming pickup');
      throw error;
    }
  };

  /**
   * Mark "Reached Drop" (Arrival at customer)
   */
  const reachDrop = async () => {
    const orderId = activeOrder?.orderId;
    try {
      const response = await deliveryAPI.confirmReachedDrop(orderId);
      if (response?.data?.success) {
        updateTripStatus('REACHED_DROP');
        // toast.info('Arrived at Customer Location');
      } else {
        throw new Error('Confirm drop failed');
      }
    } catch (error) {
      toast.error('Failed to notify arrival');
      throw error;
    }
  };

  /**
   * Finalize Delivery with OTP Check
   */
  const completeDelivery = async (otp, paymentMode = 'online') => {
    const orderId = activeOrder?.orderId;
    try {
      const alreadyVerified = !!activeOrder?.deliveryVerification?.dropOtp?.verified;
      
      // 1. Verify OTP ONLY if not already verified (handles refreshes/back-navigation)
      if (!alreadyVerified) {
        if (!otp) {
          toast.error('Handover code is required');
          return;
        }
        const verifyRes = await deliveryAPI.verifyDropOtp(orderId, otp);
        if (!verifyRes?.data?.success) {
          toast.error('Invalid OTP. Please check with customer.');
          throw new Error('Invalid OTP');
        }
      }
      
      // 2. Mark as complete
      const completeRes = await deliveryAPI.completeDelivery(orderId, { otp, rating: 5, paymentMode });
      if (completeRes.data?.success && completeRes.data?.data?.order) {
        setActiveOrder(completeRes.data.data.order);
      }
      
      updateTripStatus('COMPLETED');
    } catch (error) {
      console.error('Completion Error:', error);
      const isOtpError = error?.response?.status === 400 || error?.message === 'Invalid OTP';
      toast.error(error?.response?.data?.message || (isOtpError ? 'Verification failed' : 'Failed to complete delivery'));
      throw error;
    }
  };

  const resetTrip = () => {
    clearActiveOrder();
  };

  return {
    acceptOrder,
    reachPickup,
    pickUpOrder,
    reachDrop,
    completeDelivery,
    resetTrip,
  };
};
