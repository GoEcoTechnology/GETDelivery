'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Info, X, Compass, ArrowRight } from 'lucide-react';

export interface PageGuideContent {
  title: string;
  subtitle: string;
  roleBadge: string;
  overview: string;
  steps: string[];
}

export const PAGE_GUIDES: Record<string, PageGuideContent> = {
  // ================= ADMIN / BUSINESS OWNER =================
  'admin-dashboard': {
    title: 'Dashboard Overview',
    subtitle: 'Business performance, live revenue metrics & delivery calendar',
    roleBadge: 'Business Admin',
    overview: 'Central command center providing real-time visibility into your business revenue, order volume, upcoming deliveries calendar, and stock status alerts.',
    steps: [
      'Use the date range selector at the top (Today, Week, Month, Year) to update revenue statistics and trends.',
      'Check the Delivery Calendar on the left to track scheduled pickups and drop-offs by date.',
      'Review the high-level KPI cards to monitor total revenue, active orders, and completed shipments.',
      'Inspect recent customer orders in the live tables below to take immediate action on pending shipments.'
    ],
  },
  'admin-inventory': {
    title: 'Inventory & Catalog Management',
    subtitle: 'Manage products, stock levels, variants, and quota cargo weights',
    roleBadge: 'Business Admin',
    overview: 'Manage your full catalog of items, current stock quantities, low-stock threshold alerts, and configure quota weights used for automatic vehicle selection.',
    steps: [
      'Search items using the search bar or filter by category (Food, Grocery, Hardware, etc.).',
      'Click "+ Add Product" to add a new inventory item with base price and stock threshold.',
      'Click "Manage Variants" on any product to configure sizes, quotas, packaging units, and weight per quota in kg.',
      'Check the stock indicators to monitor items approaching low-stock warning levels.'
    ],
  },
  'admin-inventory-add': {
    title: 'Add New Product',
    subtitle: 'Register a new item into your store catalog',
    roleBadge: 'Business Admin',
    overview: 'Create a new product listing with pricing, initial stock count, category tags, and marketplace visibility.',
    steps: [
      'Enter the product name, select an appropriate category, and add an informative description.',
      'Set the base retail price and current initial stock in your warehouse.',
      'Define a low stock alert threshold so you are notified before items run out.',
      'Toggle "Marketplace" to make the item available for customer purchasing.',
      'Click "Create Product" to save. You can configure variant sizes and weights afterwards.'
    ],
  },
  'admin-inventory-variants': {
    title: 'Variants & Package Size Configuration',
    subtitle: 'Set sizes, quota limits, selling units, and package tier',
    roleBadge: 'Business Admin',
    overview: 'Configure specific product variants, stock counts, and standard packaging tiers used for automated vehicle selection.',
    steps: [
      'Review existing product variants and their current stock levels.',
      'Click "+ Add Variant" to create a new size, grade, or packaging option.',
      'Select the standard Package Size (Small, Med, Large, XL, Oversized, Freight). Weight and dimensions are automatically assigned without manual kg entry!',
      'Add custom "Selling Units" (e.g. Box of 10, Sack of 50) with equivalent quantities and package sizes.'
    ],
  },
  'admin-inventory-history': {
    title: 'Inventory Transaction History',
    subtitle: 'Audit trail of all stock movements and adjustments',
    roleBadge: 'Business Admin',
    overview: 'Complete chronological log of every stock-in, stock-out, and manual adjustment made to your inventory.',
    steps: [
      'Filter transactions by date range or transaction type (Stock-In, Stock-Out, Adjustment).',
      'Search by product name or reference code to find specific movement records.',
      'Inspect quantity deltas, resulting balance, timestamps, and staff member details.'
    ],
  },
  'admin-inventory-stock-in': {
    title: 'Stock-In (Replenishment)',
    subtitle: 'Record supplier deliveries and incoming inventory restocks',
    roleBadge: 'Business Admin',
    overview: 'Log newly received goods from suppliers to instantly update active stock counts and keep inventory records accurate.',
    steps: [
      'Select the product and variant being restocked from the dropdown menu.',
      'Enter the received quantity and optional supplier invoice or purchase order number.',
      'Add receiving notes or batch tracking tags for future auditing.',
      'Click "Submit Stock-In" to immediately update live inventory counts.'
    ],
  },
  'admin-inventory-stock-in-history': {
    title: 'Stock-In Archive',
    subtitle: 'Historical archive of supplier receipts and restocks',
    roleBadge: 'Business Admin',
    overview: 'Review past supplier deliveries, replenishment batches, and received shipment logs.',
    steps: [
      'Browse chronological records of incoming shipments.',
      'Search by supplier name or product title to reconcile delivery receipts.'
    ],
  },
  'admin-inventory-stock-out': {
    title: 'Stock-Out (Deductions)',
    subtitle: 'Record inventory deductions for orders, transfers, or write-offs',
    roleBadge: 'Business Admin',
    overview: 'Deduct stock for customer orders, warehouse transfers, damaged items, or expired merchandise.',
    steps: [
      'Select the product and variant being deducted.',
      'Specify the deduction quantity and choose the reason (Sale, Damaged, Expired, Transfer).',
      'Add reference notes or order tracking numbers.',
      'Click "Submit Stock-Out" to record the deduction and adjust stock.'
    ],
  },
  'admin-inventory-stock-out-history': {
    title: 'Stock-Out Archive',
    subtitle: 'Audit log of stock deductions and write-offs',
    roleBadge: 'Business Admin',
    overview: 'Review historical inventory reductions, reason classifications, and authorized staff members.',
    steps: [
      'Search deductions by product name or filter by reason code.',
      'Inspect the author and date of each inventory deduction.'
    ],
  },
  'admin-inventory-stock-out-analytics': {
    title: 'Stock-Out Analytics',
    subtitle: 'Depletion velocity, fast-moving products & demand trends',
    roleBadge: 'Business Admin',
    overview: 'Visual analytics illustrating product depletion speed, consumption patterns, and turnover cycles.',
    steps: [
      'Review top-depleting products to forecast future supplier orders.',
      'Analyze seasonal consumption spikes to avoid stockout periods.'
    ],
  },
  'admin-orders': {
    title: 'Customer Orders & Dispatch',
    subtitle: 'Review orders, verify cargo weight, and dispatch shipments',
    roleBadge: 'Business Admin',
    overview: 'Manage incoming customer orders, inspect calculated cargo weights, assign deliveries, and dispatch to logistics partners.',
    steps: [
      'Filter orders by status: Pending, Waiting for Partner, In Transit, Delivered, or Cancelled.',
      'Click on an order to view customer details, items, total cargo weight, and delivery fee.',
      'Click "Accept" to confirm incoming orders and prepare them for fulfillment.',
      'Click "Dispatch" to broadcast orders to available delivery partners or assign to batches.'
    ],
  },
  'admin-batches': {
    title: 'Batch Dispatch Management',
    subtitle: 'Consolidate multiple orders into route-optimized vehicle batches',
    roleBadge: 'Business Admin',
    overview: 'Combine multiple customer orders heading in the same route direction into a single vehicle dispatch batch to reduce delivery expenses.',
    steps: [
      'View existing delivery batches and their total combined cargo weight.',
      'Verify that the batch cargo weight does not exceed the vehicle usable payload capacity.',
      'Add compatible pending orders into the batch.',
      'Click "Dispatch Batch" to broadcast the consolidated shipment to delivery partners.'
    ],
  },
  'admin-deliveries': {
    title: 'Active Delivery Tracking',
    subtitle: 'Monitor live in-transit shipments and driver status',
    roleBadge: 'Business Admin',
    overview: 'Track active delivery dispatches, assigned partner fleets, driver contacts, and delivery proof checkpoints.',
    steps: [
      'Review in-progress shipments with live status badges (Accepted, In Transit, Delivered).',
      'Inspect route details, estimated arrival times, and assigned driver details.',
      'View photo proof of delivery and digital signatures once completed.'
    ],
  },
  'admin-deliveries-create': {
    title: 'Create Manual Delivery',
    subtitle: 'Create a custom delivery order with automated vehicle selection',
    roleBadge: 'Business Admin',
    overview: 'Manually dispatch goods to a customer, specify pickup/dropoff locations, and let the system calculate distance, total weight, and vehicle rates.',
    steps: [
      'Enter pickup address and customer destination on the map.',
      'Add products and quantities; the system sums the cargo weight automatically.',
      'Review the automatically matched vehicle based on total order weight in kg.',
      'Review the tiered delivery fee calculation and confirm dispatch.'
    ],
  },
  'admin-deliveries-history': {
    title: 'Delivery History',
    subtitle: 'Archive of completed shipments and delivery receipts',
    roleBadge: 'Business Admin',
    overview: 'Historical records of all fulfilled deliveries, transit times, and delivery confirmation receipts.',
    steps: [
      'Search completed trips by tracking ID, partner, or date range.',
      'Inspect proof-of-delivery photos and recipient confirmations.'
    ],
  },
  'admin-customers': {
    title: 'Customer Directory',
    subtitle: 'Customer contacts, order histories, and saved addresses',
    roleBadge: 'Business Admin',
    overview: 'Central directory of your customer base with contact numbers, total order spend, and saved drop-off locations.',
    steps: [
      'Search customers by name, phone number, or email.',
      'Click on any customer to view lifetime orders and delivery history.',
      'Add new customer profiles or update contact records.'
    ],
  },
  'admin-employees': {
    title: 'Employee & Staff Management',
    subtitle: 'Manage team access, permissions, and roles',
    roleBadge: 'Business Admin',
    overview: 'Manage internal company staff accounts, assign system access permissions, and manage active status.',
    steps: [
      'View current employee listings, contact details, and assigned roles.',
      'Click "+ Add Employee" to invite a new staff member with their designated role.',
      'Toggle employee account status (Active or Suspended) as needed.'
    ],
  },
  'admin-drivers': {
    title: 'In-House Drivers',
    subtitle: 'Manage company drivers, licenses, and assigned vehicles',
    roleBadge: 'Business Admin',
    overview: 'Manage your internal company delivery driver roster, assign fleet vehicles, and issue driver app access tokens.',
    steps: [
      'Review registered company drivers, contact numbers, and vehicle assignments.',
      'Click "+ Add Driver" to register a new driver with their driver license details.',
      'Generate driver app login tokens for instant mobile web access.'
    ],
  },
  'admin-vehicles': {
    title: 'Fleet & Vehicle Registry',
    subtitle: 'Register vehicles, plate numbers, and payload capacity in kg',
    roleBadge: 'Business Admin',
    overview: 'Register and manage your fleet vehicles. Setting the exact usable payload capacity in kilograms (kg) is essential for automated cargo weight assignment.',
    steps: [
      'View registered vehicles: Model, Plate Number, Status, and Usable Payload Capacity (kg).',
      'Click "+ Add Vehicle" to register a new fleet vehicle.',
      'Input the legal Usable Payload Capacity in kg (e.g. Motorcycle: 50 kg, Pick up: 1,000 kg, Truck: 15,000 kg).',
      'Keep OR/CR numbers and registration expiry dates up to date.'
    ],
  },
  'admin-profile': {
    title: 'Store Profile & Settings',
    subtitle: 'Store location, operating hours, branding, and account security',
    roleBadge: 'Business Admin',
    overview: 'Configure your company details, warehouse dispatch coordinates, branding preferences, and update personal account credentials.',
    steps: [
      'Update your business name and primary contact telephone number.',
      'Pin your store or warehouse location on the interactive map — delivery distance fees are calculated from this exact point.',
      'Update account password in the Security tab.',
      'Click "Save Changes" to apply updates.'
    ],
  },

  // ================= CUSTOMER PORTAL =================
  'customer-dashboard': {
    title: 'Customer Portal',
    subtitle: 'Browse marketplace, track active orders, and view past purchases',
    roleBadge: 'Customer',
    overview: 'Your personalized shopping dashboard to browse products from local merchants, track ongoing deliveries, and manage your account.',
    steps: [
      'View the Active Orders card for instant updates on current deliveries.',
      'Click "Go to Marketplace" to discover products and special offers.',
      'Use quick shortcuts to review your Shopping Cart or manage saved delivery locations.'
    ],
  },
  'customer-marketplace': {
    title: 'Product Marketplace',
    subtitle: 'Discover and purchase products with automated delivery quotes',
    roleBadge: 'Customer',
    overview: 'Browse items across food, grocery, hardware, and construction supplies. Select packaging units and order with transparent delivery fees.',
    steps: [
      'Search for products using the search bar or click category tags to filter items.',
      'Click any product card to select size/variant, selling unit, and quantity.',
      'Adjust quantities using the "+" and "-" controls.',
      'Click "Add to Cart" to keep shopping, or "Buy Now" to checkout immediately.'
    ],
  },
  'customer-cart': {
    title: 'Shopping Cart',
    subtitle: 'Review selected items, adjust quantities, and proceed to checkout',
    roleBadge: 'Customer',
    overview: 'Review items added to your basket, modify quantities, inspect subtotals, and prepare for delivery booking.',
    steps: [
      'Verify the items and quantities in your cart.',
      'Adjust item quantities with "+" and "-" or remove items using the trash button.',
      'Review the products subtotal.',
      'Click "Proceed to Checkout" to select your delivery location.'
    ],
  },
  'customer-checkout': {
    title: 'Checkout & Delivery Booking',
    subtitle: 'Set drop-off location, view vehicle matching, and place order',
    roleBadge: 'Customer',
    overview: 'Complete your purchase. The system automatically calculates total cargo weight, matches the smallest capable vehicle, and computes accurate tiered shipping.',
    steps: [
      'Fill in recipient contact details and delivery notes.',
      'Search for your address or pin your exact location on the interactive map.',
      'Select delivery priority: Normal Delivery or Urgent Delivery.',
      'Inspect the assigned vehicle (e.g. Motorcycle, Pick up, Truck) and shipping fee breakdown.',
      'Click "Place Order" to submit your booking.'
    ],
  },
  'customer-orders': {
    title: 'My Orders & Real-Time Tracking',
    subtitle: 'Track active deliveries, inspect fee breakdowns, and view partner details',
    roleBadge: 'Customer',
    overview: 'Monitor your orders from confirmation to doorstep delivery. Inspect item totals, shipping fee, and assigned partner drivers.',
    steps: [
      'Filter orders by status: All, Pending, In Transit, or Completed.',
      'View the transparent pricing breakdown: Products Subtotal, Shipping Fee, and Total Amount Payable.',
      'Click "View Details" to see assigned delivery partner and driver fleet info.',
      'Click "Cancel" if you need to void an order that has not yet been dispatched.'
    ],
  },
  'customer-profile': {
    title: 'Customer Profile & Addresses',
    subtitle: 'Manage saved delivery addresses, phone number, and security',
    roleBadge: 'Customer',
    overview: 'Manage your personal contact details, saved drop-off landmarks on the map for faster checkout, and update your password.',
    steps: [
      'Update your name and primary phone number so delivery drivers can reach you.',
      'Save your default delivery address and pin it accurately on the map.',
      'Change your password in the Security section.',
      'Click "Save Changes" to save your profile.'
    ],
  },

  // ================= DELIVERY PARTNER =================
  'partner-dashboard': {
    title: 'Partner Dashboard',
    subtitle: 'Fleet dispatch metrics, active jobs, and delivery earnings',
    roleBadge: 'Delivery Partner',
    overview: 'Operations dashboard for logistics partners to monitor available delivery requests, active driver jobs, completed deliveries, and earnings.',
    steps: [
      'Review key performance metrics: Available Orders, Active Jobs, and Total Earnings.',
      'Check the delivery queue and upcoming scheduled dispatches.',
      'Click "Available Orders" to inspect and accept customer delivery broadcasts.'
    ],
  },
  'partner-orders': {
    title: 'Available Delivery Orders',
    subtitle: 'Browse and accept customer delivery broadcasts matching your fleet',
    roleBadge: 'Delivery Partner',
    overview: 'Marketplace of available delivery jobs broadcasted by merchants. Verify cargo weight, route distance, and payout fees before accepting.',
    steps: [
      'Browse incoming delivery requests with pickup/dropoff locations and payout fees.',
      'Verify that your fleet has an available vehicle meeting the total cargo weight requirement.',
      'Click on an order to inspect the full manifest, route coordinates, and assigned vehicle type.',
      'Click "Accept Order" to assign the job to your fleet and driver.'
    ],
  },
  'partner-order-details': {
    title: 'Order Details & Driver Assignment',
    subtitle: 'Manifest review, route mapping, and driver dispatch',
    roleBadge: 'Delivery Partner',
    overview: 'Detailed view of an individual delivery job showing cargo items, total weight in kg, interactive route map, and driver fleet assignment.',
    steps: [
      'Review the complete list of goods and verified total cargo weight.',
      'Check pickup and drop-off points and calculated route distance on the map.',
      'Select an available company driver and vehicle from your registered fleet.',
      'Click "Accept Delivery" to finalize the assignment.'
    ],
  },
  'partner-deliveries': {
    title: 'Active Fleet Deliveries',
    subtitle: 'Track in-progress deliveries, update milestones, and upload proof',
    roleBadge: 'Delivery Partner',
    overview: 'Manage in-flight delivery jobs. Update delivery milestone statuses, communicate with drivers, and capture proof of delivery upon handover.',
    steps: [
      'Monitor active shipments assigned to your drivers.',
      'Update progress milestones: Picked Up, In Transit, and Arrived.',
      'Upload delivery proof photos and recipient confirmation upon handover.',
      'Mark the job as Completed to finalize payout.'
    ],
  },
  'partner-completed': {
    title: 'Completed Deliveries',
    subtitle: 'Fulfilled shipment archive and finalized partner payouts',
    roleBadge: 'Delivery Partner',
    overview: 'Historical archive of all completed deliveries, earned delivery fees, and recipient delivery receipts.',
    steps: [
      'Review past completed delivery jobs, earnings, and timestamps.',
      'Filter completed deliveries by date range or driver.'
    ],
  },
  'partner-profile': {
    title: 'Partner Fleet & Profile',
    subtitle: 'Manage company profile, registered drivers, and fleet vehicles',
    roleBadge: 'Delivery Partner',
    overview: 'Configure your logistics company profile, register fleet vehicles with verified payload capacities (kg), and manage driver rosters.',
    steps: [
      'Update company details, dispatch contact numbers, and office address.',
      'Register fleet vehicles with their verified legal payload capacities in kilograms (kg).',
      'Add company drivers and generate driver app mobile login tokens.'
    ],
  },
  'partner-notifications': {
    title: 'Partner Notifications',
    subtitle: 'Real-time alerts for broadcasts, job assignments, and earnings',
    roleBadge: 'Delivery Partner',
    overview: 'Centralized alert inbox for order broadcast notifications, dispatch confirmations, and schedule updates.',
    steps: [
      'Review notifications for newly broadcasted delivery orders.',
      'Click any notification to navigate directly to the relevant order.'
    ],
  },

  // ================= PLATFORM ADMIN =================
  'platform-admin-dashboard': {
    title: 'Platform Administration',
    subtitle: 'Global multi-tenant metrics, platform volume, and system health',
    roleBadge: 'Platform Owner',
    overview: 'Master administrative dashboard providing platform-wide visibility across all business tenants, delivery partners, and total order volume.',
    steps: [
      'Review overall platform transaction volume, active tenants, and partner fleets.',
      'Monitor gross merchandise value and platform revenue trends.',
      'Check the Pending Approvals badge to review newly registered businesses.'
    ],
  },
  'platform-admin-approvals': {
    title: 'Tenant & Partner Approvals',
    subtitle: 'Review and verify new business and delivery partner registrations',
    roleBadge: 'Platform Owner',
    overview: 'Verification queue for onboarding new merchants and delivery partner fleets. Inspect documents and approve or reject applications.',
    steps: [
      'Review pending applicant documents, business permits, and contact details.',
      'Verify business legitimacy and fleet credentials.',
      'Click "Approve" to activate their tenant account or "Reject" with feedback notes.'
    ],
  },
  'platform-admin-tenants': {
    title: 'Tenants Directory',
    subtitle: 'Manage all approved business merchants and store accounts',
    roleBadge: 'Platform Owner',
    overview: 'Comprehensive directory of all business tenants operating on the platform with volume analytics and account status controls.',
    steps: [
      'Search tenants by business name, category, or owner email.',
      'View tenant order volumes, catalog sizes, and operating locations.',
      'Suspend or reactivate tenant accounts when necessary.'
    ],
  },
  'platform-admin-partners': {
    title: 'Delivery Partners Directory',
    subtitle: 'Manage registered third-party logistics companies and fleets',
    roleBadge: 'Platform Owner',
    overview: 'Manage delivery partner logistics providers, review active fleet vehicle counts, and monitor service delivery performance.',
    steps: [
      'Review partner logistics companies, driver rosters, and fleet capacities.',
      'Monitor partner fulfillment metrics and customer satisfaction ratings.',
      'Manage partner operational status and platform commission terms.'
    ],
  },
  'platform-admin-delivery-pricing': {
    title: 'Global Delivery Pricing Configuration',
    subtitle: 'Configure vehicle pricing tiers, base fares, per-km rates, and surcharges',
    roleBadge: 'Platform Owner',
    overview: 'Master control panel for delivery fee formulas. Configure base booking fares, per-kilometer distance charges, default payload capacities (kg), and urgent delivery surcharges.',
    steps: [
      'Set the Base Fee and Price Per KM for each vehicle category (Motorcycle, Pick up, Travis, Truck).',
      'Set the default Payload Capacity (kg) for each vehicle class.',
      'Configure the Urgent Delivery flat surcharge rate.',
      'Click "Save Changes" to apply updated pricing globally across customer checkout and merchant dispatches.'
    ],
  },
  'platform-admin-profile': {
    title: 'Platform Owner Profile',
    subtitle: 'Master administrator credentials and security settings',
    roleBadge: 'Platform Owner',
    overview: 'Manage platform owner account details, administrator email, and master authentication credentials.',
    steps: [
      'Update administrator contact details.',
      'Update master account password under security settings.'
    ],
  },

  // ================= DRIVER APP =================
  'driver-app': {
    title: 'Driver Delivery Portal',
    subtitle: 'Mobile delivery task assistant, route navigation, and proof of delivery',
    roleBadge: 'Driver',
    overview: 'Mobile-friendly driver assistant for viewing assigned pickup and drop-off stops, launching GPS navigation, and recording proof of delivery upon handover.',
    steps: [
      'Review assigned pickup address, customer destination, and recipient phone number.',
      'Tap "Navigate" to open turn-by-turn directions in Google Maps or Waze.',
      'Tap "Start Delivery" when departing the pickup location.',
      'Tap "Complete Delivery", capture a proof photo or signature, and confirm handover.'
    ],
  }
};

/**
 * Resolves the appropriate guide key given any pathname across the application.
 */
export function getGuideKeyForPath(pathname: string): string {
  const clean = pathname.split('?')[0].replace(/\/+$/, '');
  
  // Platform Admin
  if (clean === '/platform-admin' || clean === '/platform-admin/dashboard') return 'platform-admin-dashboard';
  if (clean.startsWith('/platform-admin/approvals')) return 'platform-admin-approvals';
  if (clean.startsWith('/platform-admin/tenants')) return 'platform-admin-tenants';
  if (clean.startsWith('/platform-admin/partners')) return 'platform-admin-partners';
  if (clean.startsWith('/platform-admin/delivery-pricing')) return 'platform-admin-delivery-pricing';
  if (clean.startsWith('/platform-admin/profile')) return 'platform-admin-profile';

  // Partner
  if (clean === '/partner' || clean === '/partner/dashboard') return 'partner-dashboard';
  if (clean.match(/^\/partner\/orders\/[^\/]+$/)) return 'partner-order-details';
  if (clean.startsWith('/partner/orders')) return 'partner-orders';
  if (clean.match(/^\/partner\/deliveries\/[^\/]+$/)) return 'partner-deliveries';
  if (clean.startsWith('/partner/deliveries')) return 'partner-deliveries';
  if (clean.startsWith('/partner/completed')) return 'partner-completed';
  if (clean.startsWith('/partner/profile')) return 'partner-profile';
  if (clean.startsWith('/partner/notifications')) return 'partner-notifications';

  // Customer
  if (clean === '/customer') return 'customer-dashboard';
  if (clean.startsWith('/customer/marketplace')) return 'customer-marketplace';
  if (clean.startsWith('/customer/cart')) return 'customer-cart';
  if (clean.startsWith('/customer/checkout')) return 'customer-checkout';
  if (clean.startsWith('/customer/orders')) return 'customer-orders';
  if (clean.startsWith('/customer/profile')) return 'customer-profile';

  // Driver
  if (clean.startsWith('/driver')) return 'driver-app';

  // Admin
  if (clean === '/admin' || clean === '/admin/dashboard') return 'admin-dashboard';
  if (clean.startsWith('/admin/inventory/add')) return 'admin-inventory-add';
  if (clean.match(/\/admin\/inventory\/[^\/]+\/variants/)) return 'admin-inventory-variants';
  if (clean.startsWith('/admin/inventory/stock-in/history')) return 'admin-inventory-stock-in-history';
  if (clean.startsWith('/admin/inventory/stock-in')) return 'admin-inventory-stock-in';
  if (clean.startsWith('/admin/inventory/stock-out/analytics')) return 'admin-inventory-stock-out-analytics';
  if (clean.startsWith('/admin/inventory/stock-out/history')) return 'admin-inventory-stock-out-history';
  if (clean.startsWith('/admin/inventory/stock-out')) return 'admin-inventory-stock-out';
  if (clean.startsWith('/admin/inventory/history')) return 'admin-inventory-history';
  if (clean.startsWith('/admin/inventory')) return 'admin-inventory';
  if (clean.startsWith('/admin/orders')) return 'admin-orders';
  if (clean.startsWith('/admin/batches')) return 'admin-batches';
  if (clean.startsWith('/admin/deliveries/create')) return 'admin-deliveries-create';
  if (clean.startsWith('/admin/deliveries/history')) return 'admin-deliveries-history';
  if (clean.startsWith('/admin/deliveries')) return 'admin-deliveries';
  if (clean.startsWith('/admin/customers')) return 'admin-customers';
  if (clean.startsWith('/admin/employees')) return 'admin-employees';
  if (clean.startsWith('/admin/drivers')) return 'admin-drivers';
  if (clean.startsWith('/admin/vehicles')) return 'admin-vehicles';
  if (clean.startsWith('/admin/profile')) return 'admin-profile';

  return 'admin-dashboard';
}

interface PageGuideButtonProps {
  guideKey?: string;
  variant?: 'header' | 'title' | 'mobile' | 'driver' | 'subtle';
  style?: React.CSSProperties;
  className?: string;
  tooltip?: string;
}

/**
 * Reusable "i" button that displays how to use the current page.
 */
export default function PageGuideButton({
  guideKey,
  variant = 'title',
  style,
  className,
  tooltip = 'How to use this page'
}: PageGuideButtonProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const resolvedKey = guideKey || getGuideKeyForPath(pathname || '');
  const guide = PAGE_GUIDES[resolvedKey] || PAGE_GUIDES['admin-dashboard'];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle escape key and lock body scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Different variant styles
  const baseButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    ...style
  };

  let buttonContent = <Info size={15} strokeWidth={2.4} />;
  let buttonStyle: React.CSSProperties = { ...baseButtonStyle };

  if (variant === 'title') {
    buttonStyle = {
      ...baseButtonStyle,
      width: '26px',
      height: '26px',
      borderRadius: '50%',
      backgroundColor: '#eef2ff',
      color: '#4f46e5',
      border: '1.5px solid #c7d2fe',
      boxShadow: '0 1px 3px rgba(79, 70, 229, 0.15)',
      flexShrink: 0
    };
  } else if (variant === 'header') {
    buttonStyle = {
      ...baseButtonStyle,
      width: '34px',
      height: '34px',
      borderRadius: '50%',
      backgroundColor: '#f1f5f9',
      color: '#475569',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      flexShrink: 0
    };
  } else if (variant === 'mobile') {
    buttonStyle = {
      ...baseButtonStyle,
      width: '30px',
      height: '30px',
      borderRadius: '50%',
      backgroundColor: '#eef2ff',
      color: '#4f46e5',
      border: '1px solid #c7d2fe',
      flexShrink: 0
    };
  } else if (variant === 'driver') {
    buttonStyle = {
      ...baseButtonStyle,
      width: '26px',
      height: '26px',
      borderRadius: '50%',
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      color: 'white',
      border: '1.5px solid rgba(255, 255, 255, 0.6)',
      marginLeft: '6px',
      flexShrink: 0
    };
  }

  const modalElement = isOpen && mounted && typeof document !== 'undefined' ? createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '20px 16px',
        boxSizing: 'border-box',
        animation: 'pgBackdropFadeIn 0.2s ease-out'
      }}
      onClick={() => setIsOpen(false)}
    >
      <style>{`
        @keyframes pgBackdropFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pgModalScaleIn {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .pg-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .pg-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .pg-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 999px;
        }
        .pg-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
      `}</style>

      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '620px',
          maxHeight: 'min(86vh, 720px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          overflow: 'hidden',
          position: 'relative',
          animation: 'pgModalScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '22px 26px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              <Compass size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af'
                  }}
                >
                  {guide.roleBadge}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Page Guide</span>
              </div>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                How to use: {guide.title}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                {guide.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          className="pg-scrollbar"
          style={{
            padding: '22px 26px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            flex: 1
          }}
        >
          {/* Overview */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '16px 20px'
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Purpose
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.6' }}>
              {guide.overview}
            </p>
          </div>

          {/* Step-by-Step Instructions */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4f46e5' }} />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Step-by-Step Instructions
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {guide.steps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #eef2f6',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#eef2ff',
                      color: '#4f46e5',
                      fontSize: '12px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '1px'
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 26px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#4338ca';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#4f46e5';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Got it, thanks! <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={buttonStyle}
        className={className}
        title={tooltip}
        aria-label={tooltip}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          if (variant === 'title' || variant === 'mobile') {
            e.currentTarget.style.backgroundColor = '#e0e7ff';
            e.currentTarget.style.color = '#4338ca';
            e.currentTarget.style.boxShadow = '0 3px 8px rgba(79, 70, 229, 0.25)';
          } else if (variant === 'header') {
            e.currentTarget.style.backgroundColor = '#e2e8f0';
            e.currentTarget.style.color = '#1e293b';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          if (variant === 'title' || variant === 'mobile') {
            e.currentTarget.style.backgroundColor = '#eef2ff';
            e.currentTarget.style.color = '#4f46e5';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(79, 70, 229, 0.15)';
          } else if (variant === 'header') {
            e.currentTarget.style.backgroundColor = '#f1f5f9';
            e.currentTarget.style.color = '#475569';
          }
        }}
      >
        {buttonContent}
      </button>

      {modalElement}
    </>
  );
}
