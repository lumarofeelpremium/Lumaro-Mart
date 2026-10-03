import React, { useRef, useState } from 'react';
import { X, Printer, Download, Send, Loader2, Share2, Smartphone } from 'lucide-react';
import { Order, User, AppSettings } from '../types';
import { PrintableOrderReceipt } from './PrintableOrderReceipt';
import { downloadReceiptPdf, sendWhatsAppBill, printIsolatedElement, shareReceiptPdf } from '../lib/receipt-utils';
import { motion, AnimatePresence } from 'motion/react';
import { useModalBackHandler } from '../lib/back-button-handler';

interface ReceiptPreviewModalProps {
  order: Order | null;
  customer?: User | null;
  storeSettings?: AppSettings;
  onClose: () => void;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  order,
  customer,
  storeSettings,
  onClose,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Sync with mobile back button
  useModalBackHandler(Boolean(order), onClose, 'receipt_preview');

  if (!order) return null;

  const orderCode = order?.id ? order.id.slice(-8).toUpperCase() : 'ORDER';

  const handlePrint = () => {
    if (!receiptRef.current) return;
    printIsolatedElement(receiptRef.current, `Bill-${orderCode}`);
  };

  const handleShareBluetooth = async () => {
    if (!receiptRef.current) return;
    setIsSharing(true);
    try {
      await shareReceiptPdf(receiptRef.current, `Bill-${orderCode}.pdf`, `Order #${orderCode}`);
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return;
    setIsDownloading(true);
    try {
      await downloadReceiptPdf(receiptRef.current, `Bill-${orderCode}.pdf`);
    } catch (err) {
      console.error('Receipt PDF download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleWhatsApp = () => {
    sendWhatsAppBill(order, customer, storeSettings);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs overflow-y-auto">
        {/* Modal Window */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col my-auto border border-gray-100 max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
            <div>
              <h3 className="font-black text-gray-900 text-base">Receipt / Bill Preview</h3>
              <p className="text-[11px] font-bold text-gray-400">Order #{orderCode}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-200/70 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Action Bar (Android & Mobile Friendly: Big touchable buttons) */}
          <div className="p-3 bg-white border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Print via Connected Bluetooth or System Printer"
            >
              <Printer size={15} />
              <span>Print Bill</span>
            </button>

            <button
              type="button"
              onClick={handleShareBluetooth}
              disabled={isSharing}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              title="Share to Bluetooth Printer app (RawBT / POS) or WhatsApp"
            >
              {isSharing ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
              <span>Bluetooth / Share</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isDownloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span>Save PDF</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Send size={15} />
              <span>WhatsApp</span>
            </button>
          </div>

          {/* Scrollable Receipt Area */}
          <div className="p-4 overflow-y-auto bg-gray-100/70 flex justify-center">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 w-full overflow-hidden">
              <PrintableOrderReceipt
                ref={receiptRef}
                order={order}
                customer={customer}
                storeSettings={storeSettings}
              />
            </div>
          </div>

          {/* Bluetooth & Mobile Tip */}
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
              📱 <strong className="text-gray-900">Bluetooth Printer Tip:</strong> Mobile me direct print ke liye <strong className="text-gray-900">Print Bill</strong> dabayein (Android Print Dialog open hoga), ya <strong className="text-indigo-600">Bluetooth / Share</strong> dabakar apne <strong className="text-indigo-600">RawBT Print / Bluetooth POS App</strong> par 1-tap me bhejein!
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

