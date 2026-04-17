import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Grid, Heart, User, ShoppingCart } from 'lucide-react';
import { cn } from '../lib/utils';

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
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 transition-all duration-300 flex-1 pb-2',
              isActive && !item.isCart ? 'text-[#66D2A4] scale-110' : 'text-gray-400'
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn(
                "relative transition-transform duration-300",
                item.isCart ? "bg-[#66D2A4] text-white p-4 rounded-full shadow-lg shadow-[#66D2A4]/40 border-4 border-white -translate-y-4 scale-110" : "",
                isActive && item.isCart ? "scale-125" : ""
              )}>
                <item.icon size={item.isCart ? 26 : 22} strokeWidth={isActive ? 2.5 : 2} />
                {item.isCart && cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-white text-[#66D2A4] text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#66D2A4]">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[9px] font-semibold tracking-tight",
                item.isCart ? "mt-[-12px]" : ""
              )}>
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
};
