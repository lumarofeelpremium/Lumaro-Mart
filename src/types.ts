export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  stock: number;
  description?: string;
  rating?: number;
  salesCount?: number;
  createdAt?: any;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
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
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'canceled';
  createdAt: any;
  viewed?: boolean;
  subtotal?: number;
  delivery?: number;
  pointsRedeemed?: number;
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
  telegramEnabled?: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
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
