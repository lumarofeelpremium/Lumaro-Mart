import React from 'react';
import { motion } from 'motion/react';
import { Clock, CheckCircle2, PackageCheck, Truck, Check, XCircle } from 'lucide-react';
import { Order } from '../types';
import { cn } from '../lib/utils';

export interface OrderStatusTrackerProps {
  status: Order['status'];
  className?: string;
  compact?: boolean;
}

export interface StatusStep {
  id: 'pending' | 'confirmed' | 'packed' | 'out_for_delivery' | 'delivered';
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const ORDER_STATUS_STEPS: StatusStep[] = [
  {
    id: 'pending',
    label: 'Order Placed',
    shortLabel: 'Pending',
    description: 'We have received your order and are verifying details',
    icon: Clock
  },
  {
    id: 'confirmed',
    label: 'Confirmed',
    shortLabel: 'Confirmed',
    description: 'Order confirmed by store and scheduled for preparation',
    icon: CheckCircle2
  },
  {
    id: 'packed',
    label: 'Order Packed',
    shortLabel: 'Packed',
    description: 'Items packed carefully and sealed for dispatch',
    icon: PackageCheck
  },
  {
    id: 'out_for_delivery',
    label: 'Out for Delivery',
    shortLabel: 'Out for Delivery',
    description: 'Delivery partner is on the way to your location',
    icon: Truck
  },
  {
    id: 'delivered',
    label: 'Delivered',
    shortLabel: 'Delivered',
    description: 'Order delivered successfully. Enjoy your items!',
    icon: Check
  }
];

export const getStatusStepIndex = (status: Order['status']): number => {
  switch (status) {
    case 'pending': return 0;
    case 'confirmed': return 1;
    case 'packed': return 2;
    case 'out_for_delivery': return 3;
    case 'delivered': return 4;
    case 'canceled': return -1;
    default: return 0;
  }
};

export const OrderStatusTracker: React.FC<OrderStatusTrackerProps> = ({
  status,
  className,
  compact = false
}) => {
  const currentIndex = getStatusStepIndex(status);
  const isCanceled = status === 'canceled';

  if (isCanceled) {
    return (
      <div className={cn("p-4 bg-red-50 border border-red-200/70 rounded-2xl flex items-center gap-3", className)}>
        <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-red-500/20">
          <XCircle size={20} />
        </div>
        <div>
          <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider">Order Canceled</h4>
          <p className="text-[11px] text-red-600/80 font-medium">This order was canceled and is no longer being processed.</p>
        </div>
      </div>
    );
  }

  // Compact Mini Progress Bar for Order List Cards
  if (compact) {
    const activeStep = ORDER_STATUS_STEPS[Math.max(0, currentIndex)];
    const Icon = activeStep.icon;

    return (
      <div className={cn("w-full space-y-2 pt-1", className)}>
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-gray-500 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              {currentIndex < 4 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#66D2A4] opacity-75"></span>
              )}
              <span className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                currentIndex === 4 ? "bg-emerald-500" : "bg-[#66D2A4]"
              )}></span>
            </span>
            <span className="text-[#1A1A1A] font-bold">{activeStep.label}</span>
          </span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Step {currentIndex + 1} of 5
          </span>
        </div>

        {/* 5-Step Segmented Bar */}
        <div className="grid grid-cols-5 gap-1.5">
          {ORDER_STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;

            return (
              <div
                key={step.id}
                className="relative h-1.5 rounded-full overflow-hidden bg-gray-100"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isCompleted ? "bg-[#66D2A4] w-full" :
                    isCurrent ? "bg-[#66D2A4] w-full animate-pulse" :
                    "bg-transparent w-0"
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Detailed Interactive Timeline for Order Details Modal
  return (
    <div className={cn("bg-white border border-gray-100 rounded-3xl p-5 shadow-xs space-y-5", className)}>
      <div className="flex items-center justify-between border-b border-gray-100/80 pb-3">
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Live Tracking</h4>
          <p className="text-sm font-black text-[#1A1A1A] mt-0.5">
            {currentIndex === 4 ? "Order Delivered 🎉" : `Status: ${ORDER_STATUS_STEPS[currentIndex]?.label}`}
          </p>
        </div>
        <div className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Real-time Sync
        </div>
      </div>

      {/* Horizontal Steps with Connector Lines */}
      <div className="relative">
        <div className="flex items-start justify-between relative z-10">
          {ORDER_STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const isPending = idx > currentIndex;
            const StepIcon = step.icon;

            return (
              <div key={step.id} className="flex flex-col items-center text-center flex-1">
                {/* Step Circle */}
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.15 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xs relative",
                    isCompleted ? "bg-[#66D2A4] text-white" :
                    isCurrent ? "bg-[#1A1A1A] text-white ring-4 ring-[#66D2A4]/25 shadow-md shadow-[#1A1A1A]/10" :
                    "bg-gray-100 text-gray-400"
                  )}
                >
                  <StepIcon size={18} />
                  {isCompleted && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-emerald-600 border border-emerald-200 flex items-center justify-center text-[9px] font-black shadow-xs">
                      ✓
                    </span>
                  )}
                </motion.div>

                {/* Step Label */}
                <span className={cn(
                  "mt-2 text-[10px] sm:text-[11px] font-bold leading-tight max-w-[65px] sm:max-w-[75px] transition-colors",
                  isCurrent ? "text-[#1A1A1A]" :
                  isCompleted ? "text-gray-700" :
                  "text-gray-400 font-medium"
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Connecting Track Bar Behind Circles */}
        <div className="absolute top-4 sm:top-5 left-5 right-5 h-[3px] bg-gray-100 z-0">
          <div 
            className="h-full bg-[#66D2A4] transition-all duration-700 ease-out"
            style={{
              width: `${(currentIndex / (ORDER_STATUS_STEPS.length - 1)) * 100}%`
            }}
          />
        </div>
      </div>

      {/* Current Active Step Banner */}
      <div className="p-3.5 bg-gray-50/80 border border-gray-100 rounded-2xl flex items-start gap-3">
        <div className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
          currentIndex === 4 ? "bg-emerald-500 text-white" : "bg-[#66D2A4]/20 text-emerald-700"
        )}>
          {React.createElement(ORDER_STATUS_STEPS[currentIndex].icon, { size: 16 })}
        </div>
        <div className="flex-grow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1A1A1A]">
              {ORDER_STATUS_STEPS[currentIndex].label}
            </span>
            <span className="text-[10px] font-bold text-gray-400 uppercase">
              Step {currentIndex + 1} of 5
            </span>
          </div>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">
            {ORDER_STATUS_STEPS[currentIndex].description}
          </p>
        </div>
      </div>
    </div>
  );
};
