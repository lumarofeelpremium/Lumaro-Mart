import React from 'react';
import { Sparkles, Zap, Layers, TrendingDown } from 'lucide-react';
import { Product } from '../types';
import { getMultiQuantitySavings } from '../lib/savings-utils';
import { cn } from '../lib/utils';

interface MultiSavingsBadgeProps {
  product: Product;
  quantity?: number;
  variant?: 'pill' | 'chip' | 'compact' | 'callout';
  className?: string;
}

export const MultiSavingsBadge: React.FC<MultiSavingsBadgeProps> = ({
  product,
  quantity,
  variant = 'pill',
  className
}) => {
  const savings = getMultiQuantitySavings(product, quantity);

  if (!savings || !savings.hasSavings) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <span 
        className={cn(
          "inline-flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-1.5 py-0.5 rounded-md leading-none shadow-2xs",
          className
        )}
        title={`Save ₹${savings.savingsAmount} when you buy ${savings.quantity} units`}
      >
        <Zap size={9} className="text-emerald-600 fill-emerald-600 shrink-0" />
        <span>Save ₹{savings.savingsAmount} on {savings.quantity}</span>
      </span>
    );
  }

  if (variant === 'chip') {
    return (
      <div 
        className={cn(
          "inline-flex items-center gap-1 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-2xs tracking-tight",
          className
        )}
      >
        <Sparkles size={11} className="text-emerald-600 shrink-0" />
        <span>Buy {savings.quantity}+ • Save ₹{savings.savingsAmount}</span>
      </div>
    );
  }

  if (variant === 'callout') {
    return (
      <div 
        className={cn(
          "p-2.5 rounded-2xl bg-gradient-to-r from-emerald-50/90 to-teal-50/90 border border-emerald-200/80 text-emerald-900 flex items-center justify-between gap-2 shadow-2xs",
          className
        )}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
            <TrendingDown size={14} />
          </div>
          <div>
            <p className="text-xs font-extrabold flex items-center gap-1.5">
              <span>Buy {savings.quantity} to Save ₹{savings.savingsAmount}!</span>
              <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                {savings.percentSaved}% OFF
              </span>
            </p>
            <p className="text-[10px] text-emerald-700/90 font-medium">
              Pay ₹{savings.costForQty} instead of ₹{savings.mrpForQty}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Default: 'pill' variant for product cards
  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1 bg-emerald-50/95 hover:bg-emerald-100/90 border border-emerald-200/90 text-emerald-700 px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-tight transition-all duration-200 shadow-2xs",
        className
      )}
      title={`Add ${savings.quantity} items to cart and save ₹${savings.savingsAmount} compared to MRP`}
    >
      <Zap size={10} className="text-emerald-600 fill-emerald-500 shrink-0 animate-pulse" />
      <span className="truncate">Save ₹{savings.savingsAmount} on {savings.quantity}</span>
    </div>
  );
};
