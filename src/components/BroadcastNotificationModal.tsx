import React, { useState } from 'react';
import { X, Send, Sparkles, Zap, Tag, Megaphone, CheckCircle2, AlertCircle, ShoppingBag, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Product, Notification } from '../types';

interface BroadcastNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSuccess?: () => void;
}

const PRESET_TEMPLATES = [
  {
    title: '🔥 Flash Sale! Aaj Flat 20% Chhoot',
    message: 'Aaj sabhi grocery aur fresh items par payein flat 20% extra discount. Limited stock!',
    type: 'flash_sale' as const
  },
  {
    title: '🏷️ Weekend Special Offer Live',
    message: '₹499 se upar ke order par payein vishesh chhoot aur fast delivery. Abhi cart me add karein!',
    type: 'offer' as const
  },
  {
    title: '🎁 Naya Discount Coupon Available',
    message: 'Aapke account me discount point aur offers active hain. Abhi bachat ke sath order karein!',
    type: 'discount' as const
  },
  {
    title: '📢 Store Update: Naya Stock Aa Gaya',
    message: 'Fresh stock aur nayi categories ab store par available hain. Sabse pehle order karein!',
    type: 'announcement' as const
  }
];

export const BroadcastNotificationModal: React.FC<BroadcastNotificationModalProps> = ({
  isOpen,
  onClose,
  products,
  onSuccess
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<Notification['type']>('offer');
  const [productId, setProductId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setTitle(preset.title);
    setMessage(preset.message);
    setType(preset.type);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError('Title aur Message dono bharna zaroori hai.');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const payload: any = {
        title: title.trim(),
        message: message.trim(),
        type,
        createdAt: serverTimestamp()
      };

      if (productId) {
        payload.productId = productId;
      }

      await addDoc(collection(db, 'notifications'), payload);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setTitle('');
        setMessage('');
        setProductId('');
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error sending broadcast notification:', err);
      setError(err?.message || 'Notification broadcast nahi ho saka. Kripya dobara try karein.');
    } finally {
      setIsSending(false);
    }
  };

  const selectedProduct = products.find(p => p.id === productId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Megaphone size={20} className="text-white animate-bounce" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Broadcast Offer Notification</h3>
              <p className="text-xs text-white/80">Sabhi customers ko ek click me offer bhejein</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Quick Presets */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
              ⚡ Quick 1-Click Offer Templates
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_TEMPLATES.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="text-left p-2.5 rounded-xl border border-gray-100 bg-gray-50/70 hover:bg-amber-50/80 hover:border-amber-200 transition-all text-xs group"
                >
                  <p className="font-bold text-gray-800 line-clamp-1 group-hover:text-amber-700">{preset.title}</p>
                  <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{preset.message}</p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            {/* Notification Type */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                Notification Type
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'offer', label: 'Special Offer', icon: Tag, color: 'text-rose-600 bg-rose-50 border-rose-200' },
                  { id: 'flash_sale', label: 'Flash Sale', icon: Zap, color: 'text-amber-600 bg-amber-50 border-amber-200' },
                  { id: 'discount', label: 'Discount', icon: Sparkles, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                  { id: 'announcement', label: 'Notice', icon: Megaphone, color: 'text-purple-600 bg-purple-50 border-purple-200' }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = type === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id as any)}
                      className={`py-2 px-1 rounded-xl text-center border text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        isSelected
                          ? `${item.color} shadow-xs font-black ring-1 ring-offset-1`
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={14} />
                      <span className="leading-none">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Offer Title */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Offer Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 🔥 Weekend Dhamaka: Flat 20% OFF"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold focus:outline-none focus:border-amber-500 transition-colors bg-gray-50/50"
              />
            </div>

            {/* Offer Message */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Offer Message / Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Aaj sabhi grocery items par vishesh chhoot. ₹499 se upar free delivery payein!"
                required
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-amber-500 transition-colors bg-gray-50/50 leading-relaxed resize-none"
              />
            </div>

            {/* Attach Product (Optional) */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Attach Specific Product (Optional)
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-amber-500 bg-gray-50/50"
              >
                <option value="">General Store Offer (No product attached)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    📦 {p.name} (₹{p.price}) - {p.category}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">
                Product attach karne par customer notification par click karke direct usi item par pahunch jayega.
              </p>
            </div>

            {/* Live Phone Preview */}
            <div className="bg-slate-900 rounded-2xl p-3.5 text-white space-y-2 shadow-inner">
              <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-1.5">
                <span className="flex items-center gap-1 font-bold">
                  <Bell size={10} className="text-amber-400" /> Customer Phone Screen Preview
                </span>
                <span>Just now</span>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shrink-0 shadow-sm text-white">
                  {type === 'flash_sale' ? <Zap size={15} /> :
                   type === 'announcement' ? <Megaphone size={15} /> :
                   <Tag size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-amber-300">Lumaro Mart</span>
                    <span className="text-[9px] bg-slate-800 text-slate-300 px-1 py-0.2 rounded font-mono">
                      {type.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-white mt-0.5 truncate">
                    {title || '🔥 Offer Title Yahan Aayega...'}
                  </p>
                  <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                    {message || 'Offer message customer ke notification bar me aayega...'}
                  </p>
                  {selectedProduct && (
                    <div className="mt-1.5 inline-flex items-center gap-1 bg-slate-800/90 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      <ShoppingBag size={10} />
                      <span className="truncate max-w-[200px]">{selectedProduct.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs flex items-center gap-2 font-bold animate-pulse">
                <CheckCircle2 size={16} className="shrink-0 text-green-600" />
                <span>Offer Notification Sabhi Customers Ko Broadcast Ho Gaya! 🎉</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending || success}
                className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 disabled:opacity-60 transition-all cursor-pointer"
              >
                {isSending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={15} />
                    <span>Broadcast To All Customers</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
