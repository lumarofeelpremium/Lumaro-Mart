import React, { useRef, useState } from 'react';
import { X, Printer, Download, Send, Loader2 } from 'lucide-react';
import { Order, User, AppSettings } from '../types';
import { PrintableOrderReceipt } from './PrintableOrderReceipt';
import { downloadReceiptPdf, sendWhatsAppBill } from '../lib/receipt-utils';
import { motion, AnimatePresence } from 'motion/react';

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

  if (!order) return null;

  const handlePrint = () => {
    // Try native window.print() first
    try {
      if (typeof window !== 'undefined' && window.print) {
        window.print();
      } else {
        handleDownloadPdf();
      }
    } catch {
      // If print fails (e.g. inside restrictive mobile WebView), trigger instant PDF download
      handleDownloadPdf();
    }
  };

  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return;
    setIsDownloading(true);
    try {
      await downloadReceiptPdf(receiptRef.current, `Bill-${order.id.slice(-8).toUpperCase()}.pdf`);
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
              <p className="text-[11px] font-bold text-gray-400">Order #{order.id.slice(-6).toUpperCase()}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-200/70 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors active:scale-95"
            >
              <X size={18} />
            </button>
          </div>

          {/* Action Bar (Android Friendly: Big touchable buttons) */}
          <div className="p-3 bg-white border-b border-gray-100 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Printer size={15} />
              <span>Print Bill</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isDownloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span>Save PDF</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
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

          {/* Footer note */}
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-500 font-medium">
              Mobile Tip: Agar printer connected na ho, to <strong className="text-blue-600">Save PDF</strong> dabakar download kar lein ya WhatsApp par share karein.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
