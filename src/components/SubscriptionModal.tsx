import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Crown, CheckCircle2, Sparkles, Truck, Clock, ShieldCheck, Smartphone, QrCode, ArrowRight, Loader2, Zap, Hourglass, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Input } from './ui/Base';
import { User, AppSettings } from '../types';
import { activateUserSubscription, submitSubscriptionVerificationRequest } from '../lib/subscription-utils';
import { useModalBackHandler } from '../lib/back-button-handler';
import { cn } from '../lib/utils';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  setUser: (u: User | null) => void;
  appSettings: AppSettings | null;
  onSubscribedSuccess?: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  user,
  setUser,
  appSettings,
  onSubscribedSuccess
}) => {
  const [step, setStep] = useState<'details' | 'payment' | 'success' | 'pending_verification'>('details');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'instant' | 'upi'>('upi');
  const [utrNumber, setUtrNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  useModalBackHandler(isOpen, onClose, 'subscription_modal');

  if (!isOpen) return null;

  const planName = appSettings?.subscriptionPlanName || 'Lumaro VIP Club';
  const planFee = Number(appSettings?.subscriptionFee) || 99;
  const durationDays = Number(appSettings?.subscriptionDurationDays) || 30;
  const subscriberDeliveryFee = Number(appSettings?.subscriberDeliveryFee) || 0;
  const maxOrders = appSettings?.subscriptionMaxOrders !== undefined && appSettings?.subscriptionMaxOrders > 0
    ? Number(appSettings?.subscriptionMaxOrders)
    : -1;
  const subscriberMinOrder = Number(appSettings?.subscriberMinOrderAmount) || 0;
  const standardFee = Number(appSettings?.standardDeliveryFee) || 20;

  const isUnlimited = maxOrders === -1 || maxOrders === 0;
  const orderCountText = isUnlimited ? 'Unlimited Orders' : `${maxOrders} Orders`;
  const potentialSavings = isUnlimited ? standardFee * 15 : standardFee * maxOrders;

  const upiId = (appSettings?.upiId || 'shiva1520980@okhdfcbank').trim();
  const upiPayee = (appSettings?.upiPayeeName || 'Lumaro Mart').trim();
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiPayee)}&am=${planFee.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`${planName} Subscription`)}`;

  const handleActivate = async (method: 'upi' | 'instant') => {
    if (!user) {
      setError('Please login first to subscribe.');
      return;
    }

    if (method === 'upi') {
      if (!utrNumber.trim()) {
        setError('Kripya payment karne ke baad UPI Ref / UTR number darj karein taaki Admin turant verify kar sake.');
        return;
      }

      setIsProcessing(true);
      setError(null);
      try {
        await submitSubscriptionVerificationRequest({
          user,
          settings: appSettings || {
            whatsappNumber: '',
            whatsappEnabled: true,
            subscriptionFee: planFee,
            subscriptionDurationDays: durationDays,
            subscriptionPlanName: planName,
            subscriberDeliveryFee,
            subscriptionMaxOrders: maxOrders
          },
          upiTransactionId: utrNumber.trim()
        });

        setUser({
          ...user,
          subscriptionPendingVerification: true,
          subscriptionPendingUtr: utrNumber.trim(),
          subscriptionPendingPlanName: planName,
          subscriptionPendingFee: planFee,
          subscriptionStatus: 'pending_verification'
        });

        setStep('pending_verification');
        if (onSubscribedSuccess) {
          onSubscribedSuccess();
        }
      } catch (e: any) {
        console.error('Subscription verification request submission failed:', e);
        setError(e?.message || 'Failed to submit verification request. Please try again.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Instant / Admin mode
    setIsProcessing(true);
    setError(null);
    try {
      const updatedUser = await activateUserSubscription({
        user,
        settings: appSettings || {
          whatsappNumber: '',
          whatsappEnabled: true,
          subscriptionFee: planFee,
          subscriptionDurationDays: durationDays,
          subscriptionPlanName: planName,
          subscriberDeliveryFee,
          subscriptionMaxOrders: maxOrders
        },
        paymentMethod: method,
        upiTransactionId: utrNumber.trim()
      });

      setUser(updatedUser);
      setStep('success');
      if (onSubscribedSuccess) {
        onSubscribedSuccess();
      }
    } catch (e: any) {
      console.error('Subscription activation failed:', e);
      setError(e?.message || 'Failed to activate subscription. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-amber-100 flex flex-col max-h-[90vh]"
      >
        {/* Header with VIP Badge */}
        <div className="relative bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 p-6 text-white text-center shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-white transition-colors"
          >
            <X size={18} />
          </button>
          
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner border border-white/30">
            <Crown size={30} className="text-yellow-200 fill-yellow-300" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black/20 text-yellow-200 text-[11px] font-extrabold uppercase tracking-widest mb-1.5">
            <Sparkles size={12} />
            <span>Special VIP Access</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">{planName}</h2>
          <p className="text-xs text-yellow-100 mt-1">
            Enjoy special delivery benefits on your daily grocery orders
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-2xl text-xs font-semibold border border-red-200">
              {error}
            </div>
          )}

          {step === 'details' && (
            <>
              {/* Pricing Hero Card */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                    Membership Price
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-3xl font-black text-amber-950">₹{planFee}</span>
                    <span className="text-xs font-semibold text-gray-500">/ {durationDays} Days</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-xs">
                    SAVE ₹{potentialSavings}+
                  </span>
                  <p className="text-[10px] text-gray-500 mt-1">Guaranteed Savings</p>
                </div>
              </div>

              {/* Benefits Checklist */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Plan Benefits:</p>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Truck size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">
                      {subscriberDeliveryFee === 0 ? 'FREE Delivery (₹0)' : `Only ₹${subscriberDeliveryFee} Delivery Charge`}
                    </p>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Regular customers pay ₹{standardFee}. You save ₹{Math.max(0, standardFee - subscriberDeliveryFee)} on every order!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Crown size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">
                      Covers {orderCountText}
                    </p>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      {isUnlimited 
                        ? 'Unlimited orders for the entire 30 days duration.' 
                        : `Get this special delivery rate for ${maxOrders} orders during your membership.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">
                      Valid for {durationDays} Full Days
                    </p>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      {subscriberMinOrder > 0 
                        ? `Valid on all orders above ₹${subscriberMinOrder}` 
                        : 'No minimum order amount required for VIP rate!'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="space-y-2 pt-2">
                <Button 
                  onClick={() => setStep('payment')}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Subscribe • ₹{planFee}</span>
                  <ArrowRight size={18} />
                </Button>
                <p className="text-center text-[10px] text-gray-400">
                  Instant activation • 100% secure payment
                </p>
              </div>
            </>
          )}

          {step === 'payment' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-2xl border border-amber-200">
                <div className="flex items-center gap-2">
                  <Crown size={18} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-950">{planName}</span>
                </div>
                <span className="text-base font-black text-amber-950">₹{planFee}</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Select Payment Method:
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('instant')}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer",
                      paymentMode === 'instant' 
                        ? "border-amber-500 bg-amber-50/60 ring-2 ring-amber-400/20" 
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center mb-1.5">
                      <Zap size={14} />
                    </div>
                    <p className="text-xs font-bold text-gray-900">Instant Activate</p>
                    <p className="text-[10px] text-gray-500">1-Click Test Activation</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('upi')}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all cursor-pointer",
                      paymentMode === 'upi' 
                        ? "border-amber-500 bg-amber-50/60 ring-2 ring-amber-400/20" 
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-1.5">
                      <Smartphone size={14} />
                    </div>
                    <p className="text-xs font-bold text-gray-900">UPI / QR Code</p>
                    <p className="text-[10px] text-gray-500">GPay, PhonePe, Paytm</p>
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-red-600 text-xs">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {paymentMode === 'upi' && (
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-center space-y-3">
                  <div className="bg-white p-2.5 rounded-xl border border-gray-200 inline-block shadow-xs">
                    <QRCodeSVG value={upiUrl} size={130} level="M" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">Scan & Pay ₹{planFee}</p>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">{upiId}</p>
                  </div>
                  
                  <div className="pt-2 text-left">
                    <label className="text-[10px] font-bold text-gray-700 uppercase block mb-1">
                      UPI Ref / UTR Number <span className="text-red-500">* (Payment ke baad darj karein)</span>
                    </label>
                    <Input 
                      placeholder="e.g. 402849102841 (12-digit UTR)"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      className="bg-white text-xs font-mono font-bold"
                    />
                    <p className="text-[9px] text-gray-400 mt-1">
                      Payment karne ke baad Google Pay / PhonePe / Paytm se 12-digit UTR number yahan likhein taaki Admin verify kar sake.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Button 
                  onClick={() => handleActivate(paymentMode)}
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>{paymentMode === 'upi' ? 'Request Bhej Rahe Hain...' : 'Activating VIP Membership...'}</span>
                    </>
                  ) : paymentMode === 'upi' ? (
                    <>
                      <Clock size={18} />
                      <span>Payment Ho Gaya • Admin Verification Ke Liye Bhejein</span>
                    </>
                  ) : (
                    <>
                      <Crown size={18} />
                      <span>Instant Activate VIP Plan</span>
                    </>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="w-full text-center text-xs text-gray-500 hover:text-gray-700 py-1"
                >
                  Back to plan details
                </button>
              </div>
            </div>
          )}

          {step === 'pending_verification' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600 shadow-inner">
                <Hourglass size={36} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">Verification Pending! ⏳</h3>
                <p className="text-xs text-gray-600 mt-1 max-w-xs mx-auto leading-relaxed">
                  Aapka ₹{planFee} ka VIP Plan payment request Admin verification ke liye successfully bhej diya gaya hai.
                </p>
              </div>

              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Plan:</span>
                  <span className="font-bold text-gray-900">{planName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fees:</span>
                  <span className="font-bold text-gray-900">₹{planFee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">UTR / Ref Number:</span>
                  <span className="font-mono font-bold text-amber-900">{utrNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className="bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">
                    Under Verification
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-900 text-left">
                💡 <b>Kripya Dhyan Dein:</b> Admin dwara payment confirm hote hi aapki VIP Membership shuru ho jayegi aur agle orders par special ₹{subscriberDeliveryFee} delivery rate lagne lagega!
              </div>

              <Button
                onClick={onClose}
                className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl"
              >
                Theek Hai, Samjh Gaya (Close)
              </Button>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">Welcome to {planName}! 🎉</h3>
                <p className="text-xs text-gray-600 mt-1 max-w-xs mx-auto leading-relaxed">
                  Aapki VIP Membership successfully activate ho chuki hai. Ab aapko agle orders par special ₹{subscriberDeliveryFee} delivery rate milega!
                </p>
              </div>

              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-left space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Validity:</span>
                  <span className="font-bold text-gray-900">{durationDays} Days</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Orders Benefit:</span>
                  <span className="font-bold text-emerald-700">{orderCountText}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Delivery Charge Per Order:</span>
                  <span className="font-bold text-emerald-700">
                    {subscriberDeliveryFee === 0 ? 'FREE (₹0)' : `₹${subscriberDeliveryFee}`}
                  </span>
                </div>
              </div>

              <Button
                onClick={onClose}
                className="w-full py-3 bg-[#66D2A4] hover:bg-[#52ba8e] text-white font-bold rounded-2xl"
              >
                Start Shopping with VIP Benefits
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
