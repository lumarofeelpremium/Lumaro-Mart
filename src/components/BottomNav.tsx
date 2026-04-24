import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Grid, Heart, User, ShoppingCart } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export const BottomNav = ({ cartCount }: { cartCount: number }) => {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Grid, label: 'Categories', path: '/categories' },
    { icon: ShoppingCart, label: 'Cart', path: '/cart', isCart: true },
    { icon: Heart, label: 'Wishlist', path: '/wishlist' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 flex justify-around items-end z-50 pb-safe h-20">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className="flex-1"
        >
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.9 }}
              className={cn(
                'flex flex-col items-center gap-1 transition-all duration-300 flex-1 pb-2',
                isActive && !item.isCart ? 'text-[#66D2A4] scale-110 font-bold' : 'text-gray-400'
              )}
            >
              <div className={cn(
                "relative transition-all duration-500",
                item.isCart ? "bg-[#66D2A4] text-white p-4 rounded-full shadow-lg shadow-[#66D2A4]/40 border-4 border-white -translate-y-4 scale-110" : "",
                isActive && item.isCart ? "scale-125 shadow-[#66D2A4]/60" : ""
              )}>
                <item.icon 
                  size={item.isCart ? 26 : 22} 
                  strokeWidth={isActive ? 2.5 : 2} 
                  className={cn(isActive && !item.isCart ? "animate-pulse" : "")}
                />
                {item.isCart && cartCount > 0 && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-white text-[#66D2A4] text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#66D2A4] shadow-sm"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </div>
              <span className={cn(
                "text-[9px] font-semibold tracking-tight transition-colors",
                item.isCart ? "mt-[-12px]" : "",
                isActive ? "text-[#66D2A4]" : "text-gray-400"
              )}>
                {item.label}
              </span>
              {isActive && !item.isCart && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-1 w-1 h-1 bg-[#66D2A4] rounded-full"
                />
              )}
            </motion.div>
          )}
        </NavLink>
      ))}
    </div>
  );
};
