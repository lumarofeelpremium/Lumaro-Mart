export interface ProductVariant {
  id: string;
  weight: string;
  price: number;
  discountPrice?: number;
  stock?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  discountPrice?: number;
  offerLabel?: string;
  bulkDiscountQty?: number;
  bulkDiscountPrice?: number;
  bulkDiscountLabel?: string;
  image: string;
  category: string;
  stock: number;
  isPopular?: boolean;
  popularUpdatedAt?: any;
  description?: string;
  rating?: number;
  salesCount?: number;
  createdAt?: any;
  availabilityType?: 'all' | 'states' | 'districts' | 'pincodes';
  availableStates?: string[];
  availableDistricts?: string[];
  availablePincodes?: string[];
  hasVariants?: boolean;
  variants?: ProductVariant[];
  defaultVariantId?: string;
  unit?: string;
  weight?: string;
}

export interface DeliveryLocation {
  pincode?: string;
  state?: string;
  district?: string;
  city?: string;
  label?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  order?: number;
  isActive?: boolean;
  createdAt?: any;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  phoneNumber?: string;
  photoURL?: string;
  address?: string;
  pincode?: string;
  loyaltyPoints?: number;
  referralCode?: string;
  referredBy?: string;
  createdAt?: any;
  password?: string;
  fcmToken?: string;
  fcmTokens?: string[];
  // VIP Subscription Details
  isSubscribed?: boolean;
  subscriptionPlanName?: string;
  subscriptionStartDate?: any;
  subscriptionExpiresAt?: any; // timestamp in ms or ISO
  subscriptionOrdersRemaining?: number; // e.g. 10 or -1 for unlimited
  subscriptionOrdersTotal?: number; // initial quota (e.g. 10 or -1)
  subscriptionOrdersUsed?: number; // count of orders placed
  subscriptionFeePaid?: number;
  subscriptionPendingVerification?: boolean;
  subscriptionPendingUtr?: string;
  subscriptionPendingPlanName?: string;
  subscriptionPendingFee?: number;
  subscriptionStatus?: 'active' | 'expired' | 'canceled' | 'pending_verification';
  subscriptionCanceledAt?: number;
}

export interface CartItem extends Product {
  quantity: number;
  selectedVariant?: ProductVariant;
  cartItemId?: string;
  productId?: string;
}

export interface Order {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  address?: string;
  pincode?: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'packed' | 'out_for_delivery' | 'delivered' | 'canceled';
  createdAt: any;
  canceledAt?: any;
  viewed?: boolean;
  subtotal?: number;
  delivery?: number;
  pointsRedeemed?: number;
  pointsEarned?: number;
  paymentMethod?: 'cod' | 'upi';
  paymentStatus?: 'pending' | 'completed';
  upiTransactionId?: string;
  adDiscount?: number;
  canceledBy?: 'user' | 'admin';
  cancelReason?: string;
  isSubscriberOrder?: boolean;
  subscriberDeliveryFee?: number;
  deliverySavings?: number;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'new_product' | 'offer' | 'order_update' | 'flash_sale' | 'discount' | 'announcement';
  createdAt: any;
  productId?: string;
  orderId?: string;
  userId?: string;
  read?: boolean;
}

export interface AppSettings {
  whatsappNumber: string;
  whatsappEnabled: boolean;
  autoCustomerWhatsAppAlerts?: boolean;
  telegramEnabled?: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  stockThreshold?: number;
  supportNumber?: string;
  supportEnabled?: boolean;
  orderTimingEnabled?: boolean;
  orderTimingStart?: string; // "HH:MM" e.g. "06:00"
  orderTimingEnd?: string; // "HH:MM" e.g. "22:00"
  orderTimingClosedMessage?: string; // Custom message when ordering is closed
  admobEnabled?: boolean;
  admobTesting?: boolean;
  admobAppId?: string;
  admobBannerId?: string;
  admobInterstitialId?: string;
  admobRewardedId?: string;
  upiEnabled?: boolean;
  upiId?: string;
  upiPayeeName?: string;
  loyaltyProgramEnabled?: boolean;
  loyaltySpendBase?: number; // e.g. every ₹100, ₹50, ₹200 spent
  loyaltyPointsEarned?: number; // e.g. gives 5 points, 1 point, 10 points
  loyaltyPointsPerHundred?: number; // backwards compatibility
  loyaltyPointValue?: number; // e.g. 1 point = ₹1 discount
  fcmEnabled?: boolean;
  fcmVapidKey?: string;
  // Delivery Charge Settings
  standardDeliveryFee?: number; // Standard delivery charge (e.g. ₹20 or ₹40)
  freeDeliveryMinAmount?: number; // Free delivery for orders >= this amount (e.g. ₹499 or ₹100)
  dayWiseDeliveryEnabled?: boolean; // Enable day-of-week custom delivery charges & threshold
  dayWiseDeliveryRules?: Record<string, DayDeliveryRule>; // Map of day '0'..'6' (0=Sunday..6=Saturday)
  // VIP Subscription Plan Settings
  subscriptionEnabled?: boolean; // Enable/disable subscription plan
  subscriptionPlanName?: string; // e.g. "Lumaro VIP Club"
  subscriptionFee?: number; // Subscription price set by admin e.g. ₹99 or ₹149
  subscriptionDurationDays?: number; // Validity duration in days e.g. 30
  subscriberDeliveryFee?: number; // Delivery fee per order for subscribers e.g. ₹0 (free) or custom
  subscriptionMaxOrders?: number; // Orders covered under plan e.g. 10, 20 or 0 for Unlimited
  subscriberMinOrderAmount?: number; // Minimum cart value for subscriber rate (e.g. ₹0)
  subscriptionDescription?: string; // Marketing description for subscription
  // Social Media & Community Links (Profile Page)
  whatsappCommunityEnabled?: boolean;
  whatsappCommunityLink?: string; // e.g. "https://chat.whatsapp.com/..." or group/channel link
  telegramCommunityEnabled?: boolean;
  telegramCommunityLink?: string; // e.g. "https://t.me/..."
  instagramEnabled?: boolean;
  instagramLink?: string; // e.g. "https://instagram.com/..."
  // App Download & Referral Share Links
  appDownloadLink?: string; // APK / Drive / Play Store download link used in WhatsApp invite messages
}

export interface DayDeliveryRule {
  dayIndex: number; // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  dayName: string; // e.g. "Sunday", "Monday"
  dayNameHindi: string; // e.g. "रविवार", "सोमवार"
  enabled?: boolean; // whether custom rule is active for this day
  standardFee: number; // delivery fee for this day
  freeDeliveryMinAmount: number; // free delivery threshold for this day
}

export interface UserSubscription {
  id?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  planName: string;
  fee: number;
  durationDays: number;
  subscriberDeliveryFee: number;
  maxOrders: number; // 0 or -1 for unlimited
  ordersRemaining: number;
  ordersUsed: number;
  startDate: any;
  expiresAt: any;
  status: 'active' | 'expired' | 'canceled' | 'pending_verification' | 'rejected';
  paymentMethod?: string;
  upiTransactionId?: string;
  submittedAt?: any;
  verifiedAt?: any;
  verifiedBy?: string;
  canceledAt?: any;
  canceledBy?: string;
  rejectionReason?: string;
  createdAt?: any;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  buttonText: string;
  backgroundColor: string;
  image?: string;
  active: boolean;
  createdAt?: any;
}
