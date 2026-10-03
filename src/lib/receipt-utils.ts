import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Order, User, AppSettings } from '../types';
import { calculatePointsEarned } from './loyalty-utils';

export const calculateEarnedPoints = (order: Order, storeSettings?: AppSettings): number => {
  if (order.pointsEarned !== undefined && order.pointsEarned > 0) {
    return order.pointsEarned;
  }
  const calculatedSubtotal = order.subtotal || (order.items || []).reduce((sum, it) => sum + (it.price * it.quantity), 0);
  return calculatePointsEarned(calculatedSubtotal || order.total || 0, storeSettings);
};

export const formatWhatsAppBillText = (
  order: Order,
  customer?: User | null,
  storeSettings?: AppSettings
): string => {
  const orderDate = order.createdAt?.toDate 
    ? order.createdAt.toDate() 
    : (order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000) : new Date());
    
  const formattedDate = orderDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const formattedTime = orderDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const totalQuantity = (order.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
  const calculatedSubtotal = order.subtotal || (order.items || []).reduce((sum, it) => sum + (it.price * it.quantity), 0);
  const earnedPoints = calculateEarnedPoints(order);
  const address = order.address || customer?.address || '';
  const pincode = order.pincode || customer?.pincode || '';

  let itemsList = '';
  (order.items || []).forEach((item, index) => {
    itemsList += `${index + 1}. *${item.name}* (Qty: ${item.quantity}) = ₹${item.price * item.quantity}\n`;
  });

  const rawId = order?.id ? String(order.id) : '';
  const orderShortId = rawId ? rawId.slice(-8).toUpperCase() : 'ORDER';
  let message = `🧾 *LUMARO MART - ORDER BILL / RECEIPT*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📋 *Order ID:* #${orderShortId}\n`;
  message += `📅 *Date & Time:* ${formattedDate}, ${formattedTime}\n`;
  message += `👤 *Customer:* ${order.userName || customer?.displayName || 'Customer'}\n`;
  message += `📱 *Phone:* ${order.userPhone || customer?.phoneNumber || 'N/A'}\n`;
  if (address) {
    message += `📍 *Delivery Address:* ${address} ${pincode ? `(${pincode})` : ''}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📦 *ITEMS ORDERED (${totalQuantity}):*\n\n`;
  message += itemsList;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💵 *Items Subtotal:* ₹${calculatedSubtotal}\n`;
  if (order.delivery !== undefined) {
    message += `🚚 *Delivery Fee:* ${order.delivery === 0 ? 'FREE' : `₹${order.delivery}`}\n`;
  }
  if (order.pointsRedeemed !== undefined && order.pointsRedeemed > 0) {
    message += `🎟️ *Points Redeemed (Discount):* -₹${order.pointsRedeemed}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💰 *GRAND TOTAL: ₹${order.total}*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🎉 *YOU EARNED ${earnedPoints} LOYALTY POINTS ON THIS ORDER!*\n`;
  message += `_(1 Point = ₹1 • You can redeem these points for discounts on your next order)_\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  if (storeSettings?.supportNumber) {
    message += `📞 *Store Helpline:* +91 ${storeSettings.supportNumber}\n`;
  }
  message += `✨ _Thank you for shopping with Lumaro Mart!_`;

  return message;
};

export const formatOrderStatusWhatsAppText = (
  order: Order,
  status: Order['status'],
  customer?: User | null,
  _storeSettings?: AppSettings
): string => {
  const customerName = order?.userName || customer?.displayName || 'Customer';
  const rawId = order?.id ? String(order.id) : '';
  const orderShortId = rawId ? rawId.slice(-6).toUpperCase() : 'ORDER';

  switch (status) {
    case 'confirmed':
      return `✅ *ORDER CONFIRMED!*\n\nNamaste *${customerName}* ji! Aapka order *#${orderShortId}* confirm ho chuka hai aur tayyar kiya ja raha hai. 🙏`;

    case 'packed':
      return `📦 *ORDER PACKED & READY!*\n\nNamaste *${customerName}* ji! Aapka order *#${orderShortId}* packed ho chuka hai aur dispatch ke liye tayyar hai. 📦`;

    case 'out_for_delivery':
      return `🚚 *OUT FOR DELIVERY!*\n\nNamaste *${customerName}* ji! Aapka order *#${orderShortId}* delivery ke liye nikal chuka hai! Hamara delivery partner jald hi aapke pate par deliver karega. Kripya phone reach me rakhein. 🚚`;

    case 'delivered': {
      const earned = calculateEarnedPoints(order, _storeSettings);
      const pointsMsg = earned > 0 ? ` Is order par aapko *${earned} Loyalty Points* mile hain!` : '';
      return `🎉 *ORDER DELIVERED!*\n\nNamaste *${customerName}* ji! Aapka order *#${orderShortId}* safalta-purvak deliver ho gaya hai.${pointsMsg}\n\n_Lumaro Mart se shopping karne ke liye dhanyawad!_ 🙏✨`;
    }

    case 'canceled':
      return `⚠️ *ORDER CANCELED!*\n\nNamaste *${customerName}* ji! Aapka order *#${orderShortId}* cancel kar diya gaya hai.`;

    default:
      return `📋 *ORDER UPDATE*\n\nNamaste *${customerName}* ji! Aapke order *#${orderShortId}* ka status ab *${String(status || '').toUpperCase()}* hai.`;
  }
};

export const sendOrderStatusWhatsAppAlert = (
  order: Order,
  status: Order['status'],
  customer?: User | null,
  storeSettings?: AppSettings
): void => {
  const text = formatOrderStatusWhatsAppText(order, status, customer, storeSettings);
  let rawPhone = String(order.userPhone || customer?.phoneNumber || '').replace(/\D/g, '');
  
  if (rawPhone.length === 10) {
    rawPhone = `91${rawPhone}`;
  }

  const encoded = encodeURIComponent(text);
  const url = rawPhone 
    ? `https://wa.me/${rawPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  window.open(url, '_blank', 'noopener,noreferrer');
};

export const sendWhatsAppBill = (
  order: Order,
  customer?: User | null,
  storeSettings?: AppSettings
): void => {
  const text = formatWhatsAppBillText(order, customer, storeSettings);
  let rawPhone = String(order.userPhone || customer?.phoneNumber || '').replace(/\D/g, '');
  
  if (rawPhone.length === 10) {
    rawPhone = `91${rawPhone}`;
  }

  const encoded = encodeURIComponent(text);
  const url = rawPhone 
    ? `https://wa.me/${rawPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  window.open(url, '_blank', 'noopener,noreferrer');
};

export const generateReceiptPdfBlob = async (
  element: HTMLElement,
  fileName: string = 'Order-Receipt.pdf'
): Promise<{ blob: Blob; file: File } | null> => {
  try {
    const toRgbColor = (colorStr: string): string => {
      if (!colorStr || (!colorStr.includes('oklch') && !colorStr.includes('color(') && !colorStr.includes('lab('))) {
        return colorStr;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '#000000';
        ctx.fillStyle = colorStr;
        return ctx.fillStyle || '#000000';
      } catch {
        return '#000000';
      }
    };

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc, clonedElem) => {
        clonedElem.style.display = 'block';
        clonedElem.style.visibility = 'visible';
        clonedElem.style.opacity = '1';
        clonedElem.style.position = 'relative';
        clonedElem.style.left = '0';
        clonedElem.style.top = '0';

        const colorProps = [
          'color',
          'backgroundColor',
          'borderColor',
          'borderTopColor',
          'borderBottomColor',
          'borderLeftColor',
          'borderRightColor',
          'outlineColor',
          'textDecorationColor'
        ];

        const sanitizeNode = (node: HTMLElement) => {
          const style = window.getComputedStyle(node);
          for (const prop of colorProps) {
            const val = (style as any)[prop];
            if (val && typeof val === 'string' && (val.includes('oklch') || val.includes('color(') || val.includes('lab('))) {
              (node.style as any)[prop] = toRgbColor(val);
            }
          }
        };

        sanitizeNode(clonedElem);
        const allChildren = clonedElem.querySelectorAll('*');
        allChildren.forEach((child) => {
          if (child instanceof HTMLElement) {
            sanitizeNode(child);
          }
        });
      }
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 190;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const pdfBlob = pdf.output('blob');
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
    return { blob: pdfBlob, file };
  } catch (err) {
    console.error('Error generating PDF blob:', err);
    return null;
  }
};

export const downloadReceiptPdf = async (
  element: HTMLElement,
  fileName: string = 'Order-Receipt.pdf'
): Promise<boolean> => {
  try {
    const res = await generateReceiptPdfBlob(element, fileName);
    if (!res) return false;

    // Handle Android & Mobile browser saving
    try {
      const blobUrl = URL.createObjectURL(res.blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = fileName;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      setTimeout(() => {
        if (document.body.contains(downloadLink)) {
          document.body.removeChild(downloadLink);
        }
        URL.revokeObjectURL(blobUrl);
      }, 2500);
    } catch {
      // Fallback
      const url = URL.createObjectURL(res.blob);
      window.open(url, '_blank');
    }

    return true;
  } catch (error) {
    console.error('Failed to download PDF:', error);
    return false;
  }
};

/**
 * Mobile-friendly Bluetooth Printer & Share helper.
 * Lets the user share the PDF bill directly to Android Bluetooth printer apps
 * (like RawBT Print, Bluetooth Print, Quick Printer) or WhatsApp!
 */
export const shareReceiptPdf = async (
  element: HTMLElement,
  fileName: string = 'Order-Receipt.pdf',
  orderShortTitle: string = 'Order Bill'
): Promise<boolean> => {
  try {
    const res = await generateReceiptPdfBlob(element, fileName);
    if (!res) return false;

    if (navigator.canShare && navigator.canShare({ files: [res.file] })) {
      await navigator.share({
        files: [res.file],
        title: orderShortTitle,
        text: `Bill for ${orderShortTitle} from Lumaro Mart`,
      });
      return true;
    } else {
      // Fallback to downloading
      return downloadReceiptPdf(element, fileName);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return true; // user canceled share dialog
    console.warn('Share not supported, downloading PDF:', err);
    return downloadReceiptPdf(element, fileName);
  }
};

/**
 * Universal Mobile & Desktop Printer.
 * Isolates the bill or report on the screen so that Android's Print Spooler
 * or Desktop Print Dialog prints ONLY the document (compatible with Bluetooth printers,
 * WiFi printers, and thermal 58mm/80mm rolls).
 */
export const printIsolatedElement = (
  element: HTMLElement | null,
  documentTitle: string = 'Lumaro Mart Document'
): void => {
  if (!element) {
    console.warn('No element to print');
    return;
  }

  const prevTitle = document.title;
  document.title = documentTitle;

  // Remove any lingering container
  const oldContainer = document.getElementById('thermal-print-isolated-root');
  if (oldContainer) {
    oldContainer.remove();
  }

  // Create dedicated top-level container directly attached to document.body
  // This bypasses any ancestor modal overlays with overflow:hidden / fixed position / clipping
  const printContainer = document.createElement('div');
  printContainer.id = 'thermal-print-isolated-root';
  printContainer.className = 'thermal-receipt-printable';

  // Clone element content
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.maxWidth = '100%';
  clone.style.width = '100%';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  printContainer.appendChild(clone);

  document.body.appendChild(printContainer);
  document.body.classList.add('print-mode-active');
  element.classList.add('print-active-zone');

  const cleanup = () => {
    document.body.classList.remove('print-mode-active');
    element.classList.remove('print-active-zone');
    if (printContainer && printContainer.parentNode) {
      printContainer.parentNode.removeChild(printContainer);
    }
    document.title = prevTitle;
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  // Trigger Android Print Spooler / System Print Dialog
  try {
    window.print();
  } catch (e) {
    console.warn('Native window.print() failed:', e);
    // Fallback: Share PDF directly for Bluetooth printer apps
    shareReceiptPdf(element, `${documentTitle}.pdf`, documentTitle).catch(console.error);
  }

  // Safety timer if afterprint event is not triggered in mobile WebView
  setTimeout(cleanup, 3000);
};


