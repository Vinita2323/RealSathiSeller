import React, { lazy, Suspense } from 'react';
import { useAdmin } from '../context/useAdmin';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminHeader } from '../components/AdminHeader';
import PageSkeleton from '../../../components/PageSkeleton';

// Lazy-loaded Admin Subpages and Features
const AdminDashboard = lazy(() => import('../pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

const UserManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.UserManagement })));
const SellerManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.SellerManagement })));
const SellersOverview = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.SellersOverview })));
const CaptainManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.CaptainManagement })));
const CategoryManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.CategoryManagement })));
const BrandManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.BrandManagement })));
const ProductManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.ProductManagement })));
const AddProductPage = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.AddProductPage })));
const SkuAuditManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.SkuAuditManagement })));
const OrderManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.OrderManagement })));
const DeliveryManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.DeliveryManagement })));
const CouponManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.CouponManagement })));
const ReportManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.ReportManagement })));
const FaqManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.FaqManagement })));
const RoleManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.RoleManagement })));
const SettingManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.SettingManagement })));
const TaxManagement = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.TaxManagement })));
const AdminProfile = lazy(() => import('../pages/AdminSubPages').then(m => ({ default: m.AdminProfile })));

// Membership Pages
const SellerMembershipPlans = lazy(() => import('../pages/MembershipPages').then(m => ({ default: m.SellerMembershipPlans })));
const SellerMembershipSubscriptions = lazy(() => import('../pages/MembershipPages').then(m => ({ default: m.SellerMembershipSubscriptions })));
const CaptainMembershipPlans = lazy(() => import('../pages/MembershipPages').then(m => ({ default: m.CaptainMembershipPlans })));
const CaptainMembershipSubscriptions = lazy(() => import('../pages/MembershipPages').then(m => ({ default: m.CaptainMembershipSubscriptions })));

// Promotion Pages
const PromotionDashboard = lazy(() => import('../pages/PromotionPages').then(m => ({ default: m.PromotionDashboard })));
const PromoHomeSection = lazy(() => import('../pages/PromotionPages').then(m => ({ default: m.PromoHomeSection })));
const PromoCategoryProducts = lazy(() => import('../pages/PromotionPages').then(m => ({ default: m.PromoCategoryProducts })));
const PromoBestseller = lazy(() => import('../pages/PromotionPages').then(m => ({ default: m.PromoBestseller })));
const PromoStrip = lazy(() => import('../pages/PromotionPages').then(m => ({ default: m.PromoStrip })));
const PromoLowestPrices = lazy(() => import('../pages/PromotionPages').then(m => ({ default: m.PromoLowestPrices })));
const PromoShopByStore = lazy(() => import('../pages/PromotionPages').then(m => ({ default: m.PromoShopByStore })));
const PromoHomeBanners = lazy(() => import('../pages/PromotionPages').then(m => ({ default: m.PromoHomeBanners })));
const PromoFlashSale = lazy(() => import('../pages/PromotionPages').then(m => ({ default: m.PromoFlashSale })));

// Dedicated Feature Pages
const AdminLocationDashboard = lazy(() => import('../pages/AdminLocationDashboard').then(m => ({ default: m.AdminLocationDashboard || m.default })));
const PolicyManagement = lazy(() => import('../pages/PolicyManagement').then(m => ({ default: m.PolicyManagement || m.default })));
const ProfileEditRequests = lazy(() => import('../pages/ProfileEditRequests').then(m => ({ default: m.ProfileEditRequests || m.default })));
const CaptainRegistrationFeeAdmin = lazy(() => import('../pages/CaptainRegistrationFeeAdmin').then(m => ({ default: m.CaptainRegistrationFeeAdmin || m.default })));
const SellerRegistrationFeeAdmin = lazy(() => import('../pages/SellerRegistrationFeeAdmin').then(m => ({ default: m.SellerRegistrationFeeAdmin || m.default })));
const CommissionManagement = lazy(() => import('../pages/CommissionManagement').then(m => ({ default: m.CommissionManagement || m.default })));
const ReferralManagement = lazy(() => import('../pages/ReferralManagement').then(m => ({ default: m.ReferralManagement || m.default })));
const ReferralDashboard = lazy(() => import('../pages/ReferralManagement').then(m => ({ default: m.ReferralDashboard })));
const ReferralSettings = lazy(() => import('../pages/ReferralManagement').then(m => ({ default: m.ReferralSettings })));
const ReferralList = lazy(() => import('../pages/ReferralManagement').then(m => ({ default: m.ReferralList })));
const ReturnManagement = lazy(() => import('../pages/ReturnManagement').then(m => ({ default: m.ReturnManagement || m.default })));
const PricingChargesManagement = lazy(() => import('../pages/PricingChargesManagement').then(m => ({ default: m.PricingChargesManagement || m.default })));
// Payout Request module
const AdminSellerPayout = lazy(() => import('../pages/AdminPayoutManagement').then(m => ({ default: m.AdminSellerPayout })));
const AdminCaptainPayout = lazy(() => import('../pages/AdminPayoutManagement').then(m => ({ default: m.AdminCaptainPayout })));
const AdminRefundReturn = lazy(() => import('../pages/AdminPayoutManagement').then(m => ({ default: m.AdminRefundReturn })));
const AdminFinancialDashboard = lazy(() => import('../pages/AdminFinancialDashboard').then(m => ({ default: m.AdminFinancialDashboard })));
const AdminCashSettlements = lazy(() => import('../pages/AdminCashSettlements').then(m => ({ default: m.AdminCashSettlements || m.default })));

export const AdminLayout = () => {
  const { activeTab, setActiveTab, sidebarOpen, setSidebarOpen, isCompact } = useAdmin();

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'referral_dashboard':
      case 'referral-dashboard':
        return <ReferralDashboard onNavigateTab={(tab) => setActiveTab(tab)} />;
      case 'referral_settings':
      case 'referral-settings':
        return <ReferralSettings />;
      case 'referral_list':
      case 'referral-list':
      case 'referrals':
        return <ReferralList />;
      case 'referral_management':
      case 'referral-management':
      case 'referral':
        return <ReferralManagement />;
      case 'commission_management':
      case 'commission-management':
      case 'commissions':
      case 'commission':
        return <CommissionManagement />;
      case 'pricing_charges':
      case 'pricing-charges':
      case 'pricing':
      case 'charges':
      case 'pricing_delivery':
      case 'pricing-delivery':
      case 'delivery_pricing':
      case 'delivery_charges':
        return <PricingChargesManagement initialTab="delivery" />;
      case 'captain-registration-fee':
      case 'captain_registration_fee':
      case 'captain_fee':
        return <CaptainRegistrationFeeAdmin />;
      case 'seller-registration-fee':
      case 'seller_registration_fee':
      case 'registration_fee':
      case 'seller-fee':
        return <SellerRegistrationFeeAdmin />;
      case 'location':
        return <AdminLocationDashboard />;
      case 'dashboard':
        return <AdminDashboard onNavigate={(tab) => setActiveTab(tab)} />;
      case 'profile':
        return <AdminProfile />;
      case 'profile_edit_requests':
      case 'profile_requests':
        return <ProfileEditRequests />;
      case 'users':
      case 'customers':
        return <UserManagement />;
      case 'sellers':
      case 'seller':
        return <SellersOverview />;
      case 'manage_sellers':
      case 'manage-sellers':
      case 'seller_list':
        return <SellerManagement />;
      case 'captains':
      case 'captain':
      case 'delivery_boy':
      case 'delivery-boy':
        return <CaptainManagement />;
      case 'categories':
        return <CategoryManagement initialSubcategoriesOnly={false} />;
      case 'subcategories':
        return <CategoryManagement initialSubcategoriesOnly={true} />;
      case 'brands':
        return <BrandManagement />;
      case 'products':
        return <ProductManagement />;
      case 'add_product':
        return <AddProductPage />;
      case 'sku_audit':
        return <SkuAuditManagement />;
      case 'taxes':
        return <TaxManagement />;
      case 'orders':
      case 'orders_all':
      case 'orders_pending':
      case 'orders_received':
      case 'orders_processed':
      case 'orders_shipped':
      case 'orders_out_for_delivery':
      case 'orders_delivered':
      case 'orders_cancelled':
        return <OrderManagement />;
      case 'orders_return':
      case 'returns':
      case 'return_management':
        return <ReturnManagement />;
      case 'deliveries':
        return <DeliveryManagement />;
      case 'wallet':
      case 'fund_transfer':
      case 'seller_transaction':
        return <AdminFinancialDashboard onNavigate={(tab) => setActiveTab(tab)} />;
      case 'withdrawals':
      case 'payouts':
        return <AdminSellerPayout />;
      case 'coupons':
        return <CouponManagement />;
      case 'promo_dashboard':
        return <PromotionDashboard />;
      case 'promo_home_section':
        return <PromoHomeSection />;
      case 'promo_category_products':
        return <PromoCategoryProducts />;
      case 'promo_bestseller':
        return <PromoBestseller />;
      case 'promo_strip':
        return <PromoStrip />;
      case 'promo_lowest_prices':
        return <PromoLowestPrices />;
      case 'promo_shop_by_store':
        return <PromoShopByStore />;
      case 'promo_home_banners':
        return <PromoHomeBanners />;
      case 'promo_flash_sale':
        return <PromoFlashSale />;
      case 'reports':
        return <ReportManagement />;
      case 'faqs':
        return <FaqManagement />;
      case 'roles':
      case 'staff':
      case 'staff_roles':
        return <RoleManagement />;
      case 'settings':
      case 'payment_list':
      case 'sms_gateway':
      case 'billing_charges':
        return <SettingManagement />;
      case 'policies':
      case 'policy_management':
      case 'customer_app_policy':
      case 'delivery_app_policy':
      case 'seller_app_policy':
        return <PolicyManagement />;
      case 'system_user':
        return <UserManagement />;
      case 'seller_membership_plans':
        return <SellerMembershipPlans />;
      case 'seller_memberships':
        return <SellerMembershipSubscriptions />;
      case 'captain_membership_plans':
        return <CaptainMembershipPlans />;
      case 'captain_memberships':
        return <CaptainMembershipSubscriptions />;
      // ── Payout Request Module ──
      case 'financial_dashboard':
      case 'financial-dashboard':
        return <AdminFinancialDashboard onNavigate={(tab) => setActiveTab(tab)} />;
      case 'payout_seller':
      case 'payout-seller':
        return <AdminSellerPayout />;
      case 'payout_captain':
      case 'payout-captain':
        return <AdminCaptainPayout />;
      case 'payout_captain_settlement':
      case 'payout-captain-settlement':
      case 'captain_settlements':
      case 'captain_settlement':
      case 'cash_settlement':
      case 'cash_settlements':
      case 'cash_collection':
        return <AdminCashSettlements />;
      case 'payout_refund_return':
      case 'payout-refund-return':
      case 'payout_refund':
        return <AdminRefundReturn />;
      default:
        return <AdminDashboard onNavigate={(tab) => setActiveTab(tab)} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans text-slate-800 overflow-hidden select-none">
      {isCompact && sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 border-none cursor-pointer"
        />
      )}
      <AdminSidebar />

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative min-w-0">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <Suspense fallback={<PageSkeleton />}>
            {renderActiveTabContent()}
          </Suspense>
        </main>
      </div>
    </div>
  );
};
