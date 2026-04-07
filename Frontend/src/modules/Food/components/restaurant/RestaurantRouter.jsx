import { Suspense, lazy } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import ProtectedRoute from "@food/components/ProtectedRoute"
import AuthRedirect from "@food/components/AuthRedirect"
import Loader from "@food/components/Loader"
import RestaurantLayout from "./RestaurantLayout"

// Lazy Loading Components
const RestaurantOrdersPage = lazy(() => import("@food/pages/restaurant/OrdersPage"))
const AllOrdersPage = lazy(() => import("@food/pages/restaurant/AllOrdersPage"))
const RestaurantDetailsPage = lazy(() => import("@food/pages/restaurant/RestaurantDetailsPage"))
const EditRestaurantPage = lazy(() => import("@food/pages/restaurant/EditRestaurantPage"))
const FoodDetailsPage = lazy(() => import("@food/pages/restaurant/FoodDetailsPage"))
const EditFoodPage = lazy(() => import("@food/pages/restaurant/EditFoodPage"))
const AllFoodPage = lazy(() => import("@food/pages/restaurant/AllFoodPage"))
const WalletPage = lazy(() => import("@food/pages/restaurant/WalletPage"))
const RestaurantNotifications = lazy(() => import("@food/pages/restaurant/Notifications"))
const OrderDetails = lazy(() => import("@food/pages/restaurant/OrderDetails"))
const OrdersMain = lazy(() => import("@food/pages/restaurant/OrdersMain"))
const RestaurantOnboarding = lazy(() => import("@food/pages/restaurant/Onboarding"))
const AdvertisementsPage = lazy(() => import("@food/pages/restaurant/AdvertisementsPage"))
const AdDetailsPage = lazy(() => import("@food/pages/restaurant/AdDetailsPage"))
const NewAdvertisementPage = lazy(() => import("@food/pages/restaurant/NewAdvertisementPage"))
const EditAdvertisementPage = lazy(() => import("@food/pages/restaurant/EditAdvertisementPage"))
const CouponListPage = lazy(() => import("@food/pages/restaurant/CouponListPage"))
const AddCouponPage = lazy(() => import("@food/pages/restaurant/AddCouponPage"))
const EditCouponPage = lazy(() => import("@food/pages/restaurant/EditCouponPage"))
const ReviewsPage = lazy(() => import("@food/pages/restaurant/ReviewsPage"))
const UpdateReplyPage = lazy(() => import("@food/pages/restaurant/UpdateReplyPage"))
const SettingsPage = lazy(() => import("@food/pages/restaurant/SettingsPage"))
const PrivacyPolicyPage = lazy(() => import("@food/pages/restaurant/PrivacyPolicyPage"))
const TermsAndConditionsPage = lazy(() => import("@food/pages/restaurant/TermsAndConditionsPage"))
const RestaurantConfigPage = lazy(() => import("@food/pages/restaurant/RestaurantConfigPage"))
const RestaurantCategoriesPage = lazy(() => import("@food/pages/restaurant/RestaurantCategoriesPage"))
const MenuCategoriesPage = lazy(() => import("@food/pages/restaurant/MenuCategoriesPage"))
const BusinessPlanPage = lazy(() => import("@food/pages/restaurant/BusinessPlanPage"))
const ConversationListPage = lazy(() => import("@food/pages/restaurant/ConversationListPage"))
const ChatDetailPage = lazy(() => import("@food/pages/restaurant/ChatDetailPage"))
const RestaurantStatus = lazy(() => import("@food/pages/restaurant/RestaurantStatus"))
const ExploreMore = lazy(() => import("@food/pages/restaurant/ExploreMore"))
const DeliverySettings = lazy(() => import("@food/pages/restaurant/DeliverySettings"))
const RushHour = lazy(() => import("@food/pages/restaurant/RushHour"))
const OutletTimings = lazy(() => import("@food/pages/restaurant/OutletTimings"))
const DaySlots = lazy(() => import("@food/pages/restaurant/DaySlots"))
const OutletInfo = lazy(() => import("@food/pages/restaurant/OutletInfo"))
const RatingsReviews = lazy(() => import("@food/pages/restaurant/RatingsReviews"))
const EditOwner = lazy(() => import("@food/pages/restaurant/EditOwner"))
const EditCuisines = lazy(() => import("@food/pages/restaurant/EditCuisines"))
const EditRestaurantAddress = lazy(() => import("@food/pages/restaurant/EditRestaurantAddress"))
const Inventory = lazy(() => import("@food/pages/restaurant/Inventory"))
const Feedback = lazy(() => import("@food/pages/restaurant/Feedback"))
const ShareFeedback = lazy(() => import("@food/pages/restaurant/ShareFeedback"))
const DishRatings = lazy(() => import("@food/pages/restaurant/DishRatings"))
const RestaurantSupport = lazy(() => import("@food/pages/restaurant/RestaurantSupport"))
const FssaiDetails = lazy(() => import("@food/pages/restaurant/FssaiDetails"))
const FssaiUpdate = lazy(() => import("@food/pages/restaurant/FssaiUpdate"))
const Hyperpure = lazy(() => import("@food/pages/restaurant/Hyperpure"))
const ItemDetailsPage = lazy(() => import("@food/pages/restaurant/ItemDetailsPage"))
const HubFinance = lazy(() => import("@food/pages/restaurant/HubFinance"))
const FinanceDetailsPage = lazy(() => import("@food/pages/restaurant/FinanceDetailsPage"))
const WithdrawalHistoryPage = lazy(() => import("@food/pages/restaurant/WithdrawalHistoryPage"))
const PhoneNumbersPage = lazy(() => import("@food/pages/restaurant/PhoneNumbersPage"))
const DownloadReport = lazy(() => import("@food/pages/restaurant/DownloadReport"))

const ManageOutlets = lazy(() => import("@food/pages/restaurant/ManageOutlets"))
const UpdateBankDetails = lazy(() => import("@food/pages/restaurant/UpdateBankDetails"))
const ZoneSetup = lazy(() => import("@food/pages/restaurant/ZoneSetup"))
const DiningReservations = lazy(() => import("@food/pages/restaurant/DiningReservations"))
const Welcome = lazy(() => import("@food/pages/restaurant/auth/Welcome"))
const Login = lazy(() => import("@food/pages/restaurant/auth/Login"))
const OTP = lazy(() => import("@food/pages/restaurant/auth/OTP"))
const Signup = lazy(() => import("@food/pages/restaurant/auth/Signup"))
const ForgotPassword = lazy(() => import("@food/pages/restaurant/auth/ForgotPassword"))
const VerificationPending = lazy(() => import("@food/pages/restaurant/auth/VerificationPending"))

export default function RestaurantRouter() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Auth Routes - Protected from logged in users */}
        <Route
          path="welcome"
          element={
            <AuthRedirect module="restaurant">
              <Welcome />
            </AuthRedirect>
          }
        />
        <Route
          path="login"
          element={
            <AuthRedirect module="restaurant">
              <Login />
            </AuthRedirect>
          }
        />
        <Route
          path="otp"
          element={
            <AuthRedirect module="restaurant">
              <OTP />
            </AuthRedirect>
          }
        />
        <Route
          path="signup"
          element={
            <AuthRedirect module="restaurant">
              <Signup />
            </AuthRedirect>
          }
        />
        <Route
          path="forgot-password"
          element={
            <AuthRedirect module="restaurant">
              <ForgotPassword />
            </AuthRedirect>
          }
        />
        <Route path="pending-verification" element={<VerificationPending />} />
        <Route path="privacy" element={<PrivacyPolicyPage />} />
        <Route path="terms" element={<TermsAndConditionsPage />} />

        {/* Global Protected Routes */}
        <Route
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <RestaurantLayout />
            </ProtectedRoute>
          }
        >
          <Route path="" element={<OrdersMain />} />
          <Route path="notifications" element={<RestaurantNotifications />} />
          <Route path="orders" element={<RestaurantOrdersPage />} />
          <Route path="orders/all" element={<AllOrdersPage />} />
          <Route path="orders/:orderId" element={<OrderDetails />} />
          <Route path="details" element={<RestaurantDetailsPage />} />
          <Route path="edit" element={<EditRestaurantPage />} />
          <Route path="food/all" element={<AllFoodPage />} />
          <Route path="food/:id" element={<FoodDetailsPage />} />
          <Route path="food/:id/edit" element={<EditFoodPage />} />
          <Route path="food/new" element={<EditFoodPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="advertisements" element={<AdvertisementsPage />} />
          <Route path="advertisements/new" element={<NewAdvertisementPage />} />
          <Route path="advertisements/:id" element={<AdDetailsPage />} />
          <Route path="advertisements/:id/edit" element={<EditAdvertisementPage />} />
          <Route path="coupon" element={<CouponListPage />} />
          <Route path="coupon/new" element={<AddCouponPage />} />
          <Route path="coupon/:id/edit" element={<EditCouponPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="reviews/:id/reply" element={<UpdateReplyPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="delivery-settings" element={<DeliverySettings />} />
          <Route path="rush-hour" element={<RushHour />} />
          <Route path="config" element={<RestaurantConfigPage />} />
          <Route path="categories" element={<RestaurantCategoriesPage />} />
          <Route path="menu-categories" element={<MenuCategoriesPage />} />
          <Route path="business-plan" element={<BusinessPlanPage />} />
          <Route path="conversation" element={<ConversationListPage />} />
          <Route path="conversation/:conversationId" element={<ChatDetailPage />} />
          <Route path="status" element={<RestaurantStatus />} />
          <Route path="explore" element={<ExploreMore />} />
          <Route path="outlet-timings" element={<OutletTimings />} />
          <Route path="outlet-timings/:day" element={<DaySlots />} />
          <Route path="outlet-info" element={<OutletInfo />} />
          <Route path="ratings-reviews" element={<RatingsReviews />} />
          <Route path="edit-owner" element={<EditOwner />} />
          <Route path="edit-cuisines" element={<EditCuisines />} />
          <Route path="edit-address" element={<EditRestaurantAddress />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="share-feedback" element={<ShareFeedback />} />
          <Route path="dish-ratings" element={<DishRatings />} />
          <Route path="help-centre/support" element={<RestaurantSupport />} />
          <Route path="fssai" element={<FssaiDetails />} />
          <Route path="fssai/update" element={<FssaiUpdate />} />
          <Route path="hyperpure" element={<Hyperpure />} />
          <Route path="hub-menu/item/:id" element={<ItemDetailsPage />} />
          <Route path="hub-finance" element={<HubFinance />} />
          <Route path="withdrawal-history" element={<WithdrawalHistoryPage />} />
          <Route path="finance-details" element={<FinanceDetailsPage />} />
          <Route path="phone" element={<PhoneNumbersPage />} />
          <Route path="download-report" element={<DownloadReport />} />
          <Route path="manage-outlets" element={<ManageOutlets />} />
          <Route path="update-bank-details" element={<UpdateBankDetails />} />
          <Route path="reservations" element={<DiningReservations />} />
          <Route path="zone-setup" element={<ZoneSetup />} />
        </Route>

        {/* Standalone Onboarding Route - Accessible based on internal login/pendingPhone state */}
        <Route path="onboarding" element={<RestaurantOnboarding />} />

        {/* Fallback for restaurant module */}
        <Route path="*" element={<Navigate to="/restaurant" replace />} />
      </Routes>
    </Suspense>
  )
}
