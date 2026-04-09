import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { CheckCircle, MapPin, CreditCard, ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import AnimatedPage from "@food/components/user/AnimatedPage"
import ScrollReveal from "@food/components/user/ScrollReveal"
import { Card, CardHeader, CardTitle, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Badge } from "@food/components/ui/badge"
import { useCart } from "@food/context/CartContext"
import { useProfile } from "@food/context/ProfileContext"
import { useOrders } from "@food/context/OrdersContext"
import { orderAPI } from "@food/api"

export default function Checkout() {
  const navigate = useNavigate()
  const { cart, clearCart } = useCart()
  const { getDefaultAddress, getDefaultPaymentMethod, setDefaultAddress, addresses, paymentMethods, orderType } = useProfile()
  const { createOrder } = useOrders()
  const getAddressId = (address) => address?.id || address?._id || ""
  const [selectedAddressId, setSelectedAddressId] = useState(getAddressId(getDefaultAddress()))
  const [selectedPayment, setSelectedPayment] = useState(getDefaultPaymentMethod()?.id || "")
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [isCodEnabled, setIsCodEnabled] = useState(true)
  const [restaurantData, setRestaurantData] = useState(null)

  useEffect(() => {
    // Fetch Takeaway COD status if needed
    if (orderType === "takeaway") {
      orderAPI.getTakeawayCodStatus()
        .then(res => {
          setIsCodEnabled(res.data?.data?.takeaway_cod_enabled !== false)
        })
        .catch(() => setIsCodEnabled(false))
    }
  }, [orderType])

  const selectedAddress = addresses.find(addr => getAddressId(addr) === selectedAddressId) || getDefaultAddress()
  const defaultPayment = paymentMethods.find(pm => pm.id === selectedPayment) || getDefaultPaymentMethod()

  useEffect(() => {
    const defaultId = getAddressId(getDefaultAddress())
    const selectedStillExists = addresses.some(addr => getAddressId(addr) === selectedAddressId)

    if (!selectedAddressId || !selectedStillExists) {
      setSelectedAddressId(defaultId || "")
    }
  }, [addresses, selectedAddressId, getDefaultAddress])

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity * 83, 0)
  const deliveryFee = orderType === "takeaway" ? 0 : 2.99 * 83
  const tax = subtotal * 0.08
  const total = subtotal + deliveryFee + tax

  const handlePlaceOrder = async () => {
    if (orderType !== "takeaway" && (!selectedAddress || !selectedPayment)) {
      alert("Please select a delivery address and payment method")
      return
    }

    if (orderType === "takeaway" && !selectedPayment) {
      alert("Please select a payment method")
      return
    }

    if (cart.length === 0) {
      alert("Your cart is empty")
      return
    }

    setIsPlacingOrder(true)

    // Simulate API call
    setTimeout(() => {
      const orderId = createOrder({
        orderType: orderType || "delivery",
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        })),
        address: orderType === "takeaway" ? null : selectedAddress,
        paymentMethod: selectedPayment === "cod" ? { type: "cod", id: "cod" } : (paymentMethods.find(pm => pm.id === selectedPayment) || { type: selectedPayment, id: selectedPayment }),
        subtotal,
        deliveryFee,
        tax,
        total,
        restaurantId: cart[0]?.restaurantId || "rest-1",
        restaurant: cart[0]?.restaurant || cart[0]?.name || "Multiple Restaurants"
      })

      clearCart()
      setIsPlacingOrder(false)
      navigate(`/user/orders/${orderId}?confirmed=true`)
    }, 1500)
  }

  if (cart.length === 0) {
    return (
      <AnimatedPage className="min-h-screen bg-linear-to-b from-orange-50/30 via-white to-orange-50/20 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg md:text-xl">Checkout</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg mb-4">Your cart is empty</p>
                <Link to="/user/cart">
                  <Button>Go to Cart</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-linear-to-b from-orange-50/30 via-white to-orange-50/20 dark:from-[#0a0a0a] dark:via-[#1a1a1a] dark:to-[#0a0a0a] p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        <ScrollReveal>
          <div className="flex items-center gap-4 mb-6 md:mb-8">
            <Link to="/user/cart">
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 md:h-10 md:w-10">
                <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
            </Link>
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold dark:text-white">Checkout</h1>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address / Pickup Info */}
            <ScrollReveal delay={0.1}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-[#EB590E]" />
                    {orderType === "takeaway" ? "Pickup Information" : "Delivery Address"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {orderType === "takeaway" ? (
                    <div className="border-2 border-[#EB590E] bg-orange-50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <Badge className="mb-2 bg-[#EB590E] text-white">Restaurant Pickup</Badge>
                          <p className="text-sm font-bold">{cart[0]?.restaurant || "Main Restaurant Branch"}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Pickup your order from the restaurant counter.
                            <br />
                            Please show your order ID to the staff.
                          </p>
                        </div>
                        <CheckCircle className="h-5 w-5 text-[#EB590E]" />
                      </div>
                    </div>
                  ) : addresses.length > 0 ? (
                    <div className="space-y-3">
                      {addresses.map((address) => {
                        const addressId = getAddressId(address)
                        const isSelected = selectedAddressId === addressId
                        const addressString = [
                          address.street,
                          address.additionalDetails,
                          `${address.city}, ${address.state} ${address.zipCode}`
                        ].filter(Boolean).join(", ")

                        return (
                          <div
                            key={addressId || `${address.label}-${address.street}-${address.city}`}
                            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${isSelected
                                ? "border-[#EB590E] bg-orange-50"
                                : "border-gray-200 hover:border-orange-300"
                              }`}
                            onClick={() => {
                              setSelectedAddressId(addressId)
                              if (addressId) setDefaultAddress(addressId)
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                {address.isDefault && (
                                  <Badge className="mb-2 bg-[#EB590E] text-white">Default</Badge>
                                )}
                                <p className="text-sm font-medium">{addressString}</p>
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-5 w-5 text-[#EB590E]" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No addresses saved</p>
                      <Button
                        onClick={() =>
                          navigate("/user/cart/select-address", { state: { from: "/user/cart/checkout" } })
                        }
                      >
                        Add Address
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* Payment Method */}
            <ScrollReveal delay={0.2}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-[#EB590E]" />
                    Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {/* Cash on Delivery Option */}
                    {(orderType !== "takeaway" || isCodEnabled) && (
                      <div
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${selectedPayment === "cod"
                            ? "border-[#EB590E] bg-orange-50"
                            : "border-gray-200 hover:border-orange-300"
                          }`}
                        onClick={() => setSelectedPayment("cod")}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-green-600 font-bold text-xs">COD</span>
                            </div>
                            <div>
                              <p className="font-semibold">Cash on Delivery</p>
                              <p className="text-sm text-muted-foreground">Pay when you {orderType === "takeaway" ? "pickup" : "receive"} your order</p>
                            </div>
                          </div>
                          {selectedPayment === "cod" && (
                            <CheckCircle className="h-5 w-5 text-[#EB590E]" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Razorpay Online Payment (Always available) */}
                    <div
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${selectedPayment === "razorpay"
                          ? "border-[#EB590E] bg-orange-50"
                          : "border-gray-200 hover:border-orange-300"
                        }`}
                      onClick={() => setSelectedPayment("razorpay")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-bold text-xs">RZP</span>
                          </div>
                          <div>
                            <p className="font-semibold">Razorpay Secure</p>
                            <p className="text-sm text-muted-foreground">Pay online via UPI, Card, or Netbanking</p>
                          </div>
                        </div>
                        {selectedPayment === "razorpay" && (
                          <CheckCircle className="h-5 w-5 text-[#EB590E]" />
                        )}
                      </div>
                    </div>

                    {/* Saved Cards */}
                    {paymentMethods.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Saved Cards</p>
                        <div className="space-y-3">
                          {paymentMethods.map((payment) => {
                            const isSelected = selectedPayment === payment.id
                            const cardNumber = `**** **** **** ${payment.cardNumber}`

                            return (
                              <div
                                key={payment.id}
                                className={`border-2 rounded-lg p-3 cursor-pointer transition-colors ${isSelected
                                    ? "border-[#EB590E] bg-orange-50"
                                    : "border-gray-200 hover:border-orange-300 shadow-xs"
                                  }`}
                                onClick={() => setSelectedPayment(payment.id)}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="outline" className="capitalize text-[10px] h-4">
                                        {payment.type}
                                      </Badge>
                                      {payment.isDefault && (
                                        <Badge className="bg-[#EB590E] text-white text-[10px] h-4">Default</Badge>
                                      )}
                                    </div>
                                    <p className="text-sm font-semibold">{cardNumber}</p>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle className="h-4 w-4 text-[#EB590E]" />
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <Link to="/user/profile/payments">
                        <Button variant="outline" className="w-full text-xs h-9">
                          Manage Payment Methods
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <ScrollReveal delay={0.3}>
              <Card className="sticky top-4 md:top-6 dark:bg-[#1a1a1a] dark:border-gray-800">
                <CardHeader>
                  <CardTitle className="text-base md:text-lg lg:text-xl dark:text-white">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  <div className="space-y-3 md:space-y-4 max-h-64 md:max-h-80 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 md:gap-4 pb-3 md:pb-4 border-b dark:border-gray-700">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm md:text-base dark:text-gray-200">{item.name}</p>
                          {item.variantName ? (
                            <p className="text-xs md:text-sm text-muted-foreground">{item.variantName}</p>
                          ) : null}
                          <p className="text-xs md:text-sm text-muted-foreground">
                            ₹{(item.price * 83).toFixed(0)} × {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold text-sm md:text-base dark:text-gray-200">
                          ₹{(item.price * 83 * item.quantity).toFixed(0)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 md:space-y-3 pt-4 md:pt-6 border-t dark:border-gray-700">
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="dark:text-gray-200">₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span className="dark:text-gray-200">₹{deliveryFee.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="dark:text-gray-200">₹{tax.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg md:text-xl lg:text-2xl pt-2 md:pt-3 border-t dark:border-gray-700">
                      <span className="dark:text-white">Total</span>
                      <span className="text-[#EB590E] dark:text-orange-400">₹{total.toFixed(0)}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-[#EB590E] hover:bg-[#D94F0C] text-white mt-4 md:mt-6 h-11 md:h-12 text-sm md:text-base border-none"
                    onClick={handlePlaceOrder}
                    disabled={isPlacingOrder || (orderType !== "takeaway" && !selectedAddress) || !selectedPayment}
                  >
                    {isPlacingOrder ? "Placing Order..." : "Place Order"}
                  </Button>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </AnimatedPage>
  )
}
