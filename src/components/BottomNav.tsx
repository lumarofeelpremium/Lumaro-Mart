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
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around items-center z-50 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.05)] min-h-[72px] h-[calc(72px+env(safe-area-inset-bottom))]">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className="flex-1 h-full py-2"
        >
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.9 }}
              className={cn(
                'flex flex-col items-center justify-center gap-1 transition-all duration-300 h-full relative',
                isActive && !item.isCart ? 'text-[#66D2A4] scale-110 font-bold' : 'text-gray-400'
              )}
            >
              <div className={cn(
                "relative transition-all duration-500 flex items-center justify-center",
                item.isCart ? "bg-[#66D2A4] text-white p-3.5 rounded-full shadow-lg shadow-[#66D2A4]/40 border-4 border-white -translate-y-6 scale-110" : "p-1",
                isActive && item.isCart ? "scale-120 shadow-[#66D2A4]/60" : ""
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
                    className="absolute -top-1 -right-1 bg-white text-[#66D2A4] text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#66D2A4] shadow-sm"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-semibold tracking-tight transition-colors mb-1",
                item.isCart ? "mt-[-18px]" : "",
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
