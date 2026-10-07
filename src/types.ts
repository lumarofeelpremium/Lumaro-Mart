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
  type: 'new_product' | 'offer' | 'order_update';
  createdAt: any;
  productId?: string;
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
