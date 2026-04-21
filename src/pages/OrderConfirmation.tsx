import React, { useEffect } from 'react';
import { CheckCircle, ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '../components/ui/Base';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';

export const OrderConfirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const orderData = location.state;

  useEffect(() => {
    // If we have whatsapp data, we could try to redirect automatically, 
    // but a button is safer for mobile browsers to avoid pop-up blocking.
    // We'll just ensure the state is handled.
    window.scrollTo(0, 0);
  }, []);

  const handleWhatsAppRedirect = () => {
    if (!orderData || !orderData.whatsappData) return;

    const { items, orderId, total, subtotal, delivery, pointsRedeemed, userName, userPhone, userEmail, address, pincode, whatsappData } = orderData;
    
    const orderList = items.map((item: any) => `✅ *${item.name}*\n   Qty: ${item.quantity} | Price: ₹${item.price * item.quantity}`).join('\n\n');
    
    const message = `🚀 *NEW ORDER RECEIVED - LUMARO MART* 🚀\n` +
      `------------------------------------------\n` +
      `📦 *Order ID:* #${orderId.slice(-6)}\n` +
      `📅 *Date:* ${new Date().toLocaleString()}\n\n` +
      `👤 *CUSTOMER DETAILS*\n` +
      `• *Name:* ${userName}\n` +
      `• *Phone:* ${userPhone || 'N/A'}\n` +
      `• *Email:* ${userEmail}\n\n` +
      `📍 *DELIVERY ADDRESS*\n` +
      `${address || 'N/A'}\n` +
      `*Pincode:* ${pincode || 'N/A'}\n\n` +
      `🛒 *ORDER ITEMS*\n` +
      `${orderList}\n\n` +
      `💰 *ORDER SUMMARY*\n` +
      `• *Subtotal:* ₹${subtotal}\n` +
      `• *Delivery:* ${delivery === 0 ? 'FREE' : `₹${delivery}`}\n` +
      `• *Discount:* -₹${pointsRedeemed || 0}\n` +
      `------------------------------------------\n` +
      `✅ *TOTAL AMOUNT:* ₹${total}\n` +
      `------------------------------------------\n\n` +
      `📢 *Admin:* Please process this order as soon as possible.`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${whatsappData.number}?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center pb-20">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 200 }}
        className="w-24 h-24 bg-[#F0F7F4] rounded-full flex items-center justify-center mb-8"
      >
        <CheckCircle size={48} className="text-[#66D2A4]" />
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-sm"
      >
        <h1 className="text-3xl font-bold text-[#1A1A1A] mb-4">Order Confirmed!</h1>
        <p className="text-gray-400 mb-12 px-4">
          Your order has been placed successfully. We'll notify you once it's out for delivery.
        </p>

        <div className="space-y-4">
          {orderData?.whatsappData?.enabled && (
            <Button 
              className="w-full py-4 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] border-none shadow-lg shadow-[#25D366]/20"
              onClick={handleWhatsAppRedirect}
            >
              <MessageCircle size={20} /> Send to WhatsApp
            </Button>
          )}

          <Button 
            variant="secondary"
            className="w-full py-4 flex items-center justify-center gap-2"
            onClick={() => navigate('/')}
          >
            Continue Shopping <ArrowRight size={20} />
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
