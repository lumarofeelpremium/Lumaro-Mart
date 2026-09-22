import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, Copy, Check, ArrowRight, ShieldCheck, Smartphone, QrCode, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Input } from './ui/Base';

interface UpiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  upiId: string;
  payeeName: string;
  onConfirmPayment: (upiRefNumber: string) => Promise<void>;
  isProcessing: boolean;
}

export const UpiPaymentModal: React.FC<UpiPaymentModalProps> = ({
  isOpen,
  onClose,
  amount,
  upiId,
  payeeName,
  onConfirmPayment,
  isProcessing
}) => {
  const [utrNumber, setUtrNumber] = useState('');
  const [copied, setCopied] = useState(false);
  const [showManualUtr, setShowManualUtr] = useState(false);
  const [step, setStep] = useState<'pay' | 'verify'>('pay');

  if (!isOpen) return null;

  // Clean UPI ID and Payee Name
  const cleanUpiId = upiId.trim();
  const cleanPayee = payeeName.trim() || 'Lumaro Mart';
  const cleanAmount = amount.toFixed(2);
  const transactionNote = 'Lumaro Mart Order';

  // Standard NPCI UPI URI Scheme
  const upiUrl = `upi://pay?pa=${cleanUpiId}&pn=${encodeURIComponent(cleanPayee)}&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(cleanUpiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenUpiApp = () => {
    // Open UPI Intent scheme directly
    window.location.href = upiUrl;
    // Switch to verification step after clicking intent
    setTimeout(() => {
      setStep('verify');
    }, 1200);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await onConfirmPayment(utrNumber.trim());
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
                <Smartphone className="text-white" size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold leading-tight">Pay via UPI</h3>
                <p className="text-[11px] text-emerald-100 flex items-center gap-1 mt-0.5">
                  <ShieldCheck size={13} />
                  <span>Direct & 100% Free • 0% Extra Charge</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            {/* Amount Banner */}
            <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-emerald-800 font-semibold uppercase tracking-wider">Amount to Pay</p>
                <p className="text-2xl font-extrabold text-emerald-950">₹{cleanAmount}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 font-medium">Paying to</p>
                <p className="text-xs font-bold text-gray-800 max-w-[150px] truncate">{cleanPayee}</p>
              </div>
            </div>

            {step === 'pay' ? (
              <>
                {/* Mobile Direct UPI Intent Button */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleOpenUpiApp}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Smartphone size={18} />
                    <span>Pay with Installed UPI App</span>
                    <ArrowRight size={16} className="ml-1" />
                  </button>
                  <p className="text-[10px] text-center text-gray-400">
                    Supports Google Pay, PhonePe, Paytm, BHIM, Cred & any bank app
                  </p>
                </div>

                <div className="flex items-center gap-3 my-2">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">OR SCAN QR CODE</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Dynamic QR Code Card */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/70 flex flex-col items-center text-center">
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <QRCodeSVG
                      value={upiUrl}
                      size={180}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-xs font-bold text-gray-700 mt-3">
                    Scan with any UPI Scanner
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Amount & UPI ID are pre-filled automatically
                  </p>

                  {/* UPI ID copy pill */}
                  <div className="mt-3 flex items-center gap-1.5 bg-white border border-gray-200/80 px-3 py-1.5 rounded-full text-xs font-mono text-gray-700">
                    <span className="max-w-[200px] truncate">{cleanUpiId}</span>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="text-emerald-600 hover:text-emerald-700 ml-1 font-sans font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Next Step trigger */}
                <button
                  type="button"
                  onClick={() => setStep('verify')}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle size={15} className="text-emerald-600" />
                  <span>I have made the payment (Confirm Order)</span>
                </button>
              </>
            ) : (
              /* Verification Step */
              <div className="space-y-4">
                <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Did you complete the payment?</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Once confirmed, your order will be placed. You can enter your 12-digit UPI UTR / Ref Number for faster delivery processing.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 block">
                    12-Digit UPI Ref / UTR No. <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <Input
                    type="text"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                    placeholder="e.g. 423456789012"
                    maxLength={16}
                    className="font-mono text-sm tracking-wider"
                  />
                  <p className="text-[10px] text-gray-400">
                    Found in your Google Pay / PhonePe / Paytm payment receipt details.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('pay')}
                    disabled={isProcessing}
                    className="w-1/3 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Back to QR
                  </button>
                  <Button
                    onClick={() => handleSubmit()}
                    disabled={isProcessing}
                    className="w-2/3 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Placing Order...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        <span>Confirm & Place Order</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
