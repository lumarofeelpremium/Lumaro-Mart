import React from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Base';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

export const OrderConfirmation = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center">
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
      >
        <h1 className="text-3xl font-bold text-[#1A1A1A] mb-4">Order Confirmed!</h1>
        <p className="text-gray-400 mb-12">
          Your order has been placed successfully. We'll notify you once it's out for delivery.
        </p>
        
        <Button 
          className="w-full py-4 flex items-center justify-center gap-2"
          onClick={() => navigate('/')}
        >
          Continue Shopping <ArrowRight size={20} />
        </Button>
      </motion.div>
    </div>
  );
};
