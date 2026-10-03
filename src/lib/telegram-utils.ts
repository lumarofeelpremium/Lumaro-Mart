import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Order, User, AppSettings } from '../types';
import { cacheUtils } from './cache-utils';

/**
 * Retrieves the global app settings (cached or Firestore).
 */
export const getCachedTelegramSettings = async (): Promise<AppSettings | null> => {
  try {
    const cached = cacheUtils.getItem('app_settings_global');
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      if (parsed?.telegramBotToken) return parsed as AppSettings;
    }

    const sDoc = await getDoc(doc(db, 'settings', 'global'));
    if (sDoc.exists()) {
      const data = sDoc.data() as AppSettings;
      cacheUtils.setItem('app_settings_global', data);
      return data;
    }
  } catch (err) {
    console.warn('Failed to load settings for Telegram:', err);
  }
  return null;
};

/**
 * Raw Telegram Bot API Sender.
 */
export const sendTelegramMessage = async (
  message: string,
  settings?: AppSettings | null
): Promise<boolean> => {
  try {
    const activeSettings = settings || (await getCachedTelegramSettings());
    if (
      !activeSettings ||
      !activeSettings.telegramEnabled ||
      !activeSettings.telegramBotToken ||
      !activeSettings.telegramChatId
    ) {
      return false;
    }

    const cleanToken = activeSettings.telegramBotToken.trim().replace(/^bot/i, '');
    const chatId = activeSettings.telegramChatId.trim();

    const response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cacheUtils.safeStringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      }),
      keepalive: true
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn('Telegram API response error:', errBody);
      return false;
    }

    console.log('Telegram notification delivered successfully');
    return true;
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
    return false;
  }
};

/**
 * Sends a rich notification receipt to Telegram when a NEW ORDER is placed.
 * Includes complete customer delivery address and pincode.
 */
export const sendTelegramNewOrderAlert = async (params: {
  order: Order;
  customer?: User | null;
  storeSettings?: AppSettings | null;
}): Promise<boolean> => {
  const { order, customer, storeSettings } = params;

  const orderId = order.id || 'ORDER';
  const orderCode = orderId.length > 8 ? orderId.slice(-8).toUpperCase() : orderId.toUpperCase();
  const customerName = order.userName || customer?.displayName || 'Customer';
  const customerPhone = order.userPhone || customer?.phoneNumber || 'N/A';
  const address = order.address || customer?.address || 'N/A';
  const pincode = order.pincode || customer?.pincode || 'N/A';

  const itemsList = (order.items || [])
    .map((item, idx) => {
      const itemPrice = item.discountPrice || item.price;
      const weightBadge = item.selectedVariant?.weight ? ` (${item.selectedVariant.weight})` : '';
      return `🔹 ${idx + 1}. <b>${item.name}${weightBadge}</b> × ${item.quantity} = ₹${itemPrice * item.quantity}`;
    })
    .join('\n');

  const paymentText =
    order.paymentMethod === 'upi'
      ? '🟢 Online UPI (Direct 0% Fee)'
      : '💵 Cash on Delivery (COD)';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const message =
    `🛍️ <b>NEW ORDER RECEIVED (#${orderCode})</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 <b>Order ID:</b> <code>#${orderId}</code>\n` +
    `👤 <b>Customer:</b> ${customerName}\n` +
    `📞 <b>Phone:</b> ${customerPhone}\n` +
    `📍 <b>Delivery Address:</b> ${address}\n` +
    `📮 <b>Pincode:</b> ${pincode}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛒 <b>Items Ordered:</b>\n` +
    `${itemsList}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 <b>Subtotal:</b> ₹${order.subtotal || order.total}\n` +
    `🚚 <b>Delivery:</b> ${order.delivery === 0 || !order.delivery ? 'FREE' : `₹${order.delivery}`}\n` +
    (order.pointsRedeemed ? `🎟️ <b>Points Discount:</b> -₹${order.pointsRedeemed}\n` : '') +
    (order.adDiscount ? `✨ <b>Sponsor Discount:</b> -₹${order.adDiscount}\n` : '') +
    `💰 <b>GRAND TOTAL: ₹${order.total}</b>\n` +
    `💳 <b>Payment Mode:</b> ${paymentText}\n` +
    (order.upiTransactionId ? `🧾 <b>UPI Ref / UTR:</b> <code>${order.upiTransactionId}</code>\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `⏰ <b>Order Time:</b> ${dateStr}, ${timeStr}\n` +
    `Check Admin Dashboard to accept and process order.`;

  return sendTelegramMessage(message, storeSettings);
};

/**
 * Sends an urgent notification receipt to Telegram when an order is CANCELED.
 * Includes complete customer delivery address, pincode, canceled items, and reason.
 */
export const sendTelegramOrderCancelAlert = async (params: {
  order: Order;
  customer?: User | null;
  canceledBy?: 'user' | 'admin';
  reason?: string;
  storeSettings?: AppSettings | null;
}): Promise<boolean> => {
  const { order, customer, canceledBy = 'user', reason, storeSettings } = params;

  const orderId = order.id || 'ORDER';
  const orderCode = orderId.length > 8 ? orderId.slice(-8).toUpperCase() : orderId.toUpperCase();
  const customerName = order.userName || customer?.displayName || 'Customer';
  const customerPhone = order.userPhone || customer?.phoneNumber || 'N/A';
  const address = order.address || customer?.address || 'N/A';
  const pincode = order.pincode || customer?.pincode || 'N/A';

  const itemsList = (order.items || [])
    .map((item, idx) => {
      const itemPrice = item.discountPrice || item.price;
      const weightBadge = item.selectedVariant?.weight ? ` (${item.selectedVariant.weight})` : '';
      return `❌ ${idx + 1}. <b>${item.name}${weightBadge}</b> × ${item.quantity} (₹${itemPrice * item.quantity})`;
    })
    .join('\n');

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const paymentText =
    order.paymentMethod === 'upi'
      ? 'Online UPI'
      : 'Cash on Delivery';

  const message =
    `⚠️ <b>ORDER CANCELED (#${orderCode})</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `❌ <b>Status:</b> CANCELED by ${canceledBy === 'user' ? 'Customer (Within 1 min)' : 'Admin'}\n` +
    `📦 <b>Order ID:</b> <code>#${orderId}</code>\n` +
    `👤 <b>Customer:</b> ${customerName}\n` +
    `📞 <b>Phone:</b> ${customerPhone}\n` +
    `📍 <b>Delivery Address:</b> ${address}\n` +
    `📮 <b>Pincode:</b> ${pincode}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛒 <b>Canceled Items:</b>\n` +
    `${itemsList}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <b>Order Value:</b> ₹${order.total}\n` +
    `💳 <b>Payment:</b> ${paymentText}\n` +
    (order.pointsRedeemed ? `🎟️ <b>Refunded Points:</b> +${order.pointsRedeemed} pts restored to user\n` : '') +
    `📦 <b>Stock Status:</b> Items stock has been automatically restored\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `⏰ <b>Cancellation Time:</b> ${dateStr}, ${timeStr}\n` +
    (reason ? `📝 <b>Note:</b> ${reason}\n` : '') +
    `View Admin Dashboard for updated order logs.`;

  return sendTelegramMessage(message, storeSettings);
};
