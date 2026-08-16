import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Order, User, AppSettings } from '../types';

export const calculateEarnedPoints = (order: Order): number => {
  if (order.pointsEarned !== undefined && order.pointsEarned > 0) {
    return order.pointsEarned;
  }
  const calculatedSubtotal = order.subtotal || (order.items || []).reduce((sum, it) => sum + (it.price * it.quantity), 0);
  return Math.floor((calculatedSubtotal || order.total || 0) / 100) * 5;
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

  let message = `🧾 *LUMARO MART - ORDER BILL / RECEIPT*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📋 *Order ID:* #${order.id.slice(-8).toUpperCase()}\n`;
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

export const sendWhatsAppBill = (
  order: Order,
  customer?: User | null,
  storeSettings?: AppSettings
): void => {
  const text = formatWhatsAppBillText(order, customer, storeSettings);
  let rawPhone = (order.userPhone || customer?.phoneNumber || '').replace(/\D/g, '');
  
  if (rawPhone.length === 10) {
    rawPhone = `91${rawPhone}`;
  }

  const encoded = encodeURIComponent(text);
  const url = rawPhone 
    ? `https://wa.me/${rawPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  window.open(url, '_blank', 'noopener,noreferrer');
};

export const downloadReceiptPdf = async (
  element: HTMLElement,
  fileName: string = 'Order-Receipt.pdf'
): Promise<boolean> => {
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
        // Ensure element in clone is visible and measurable
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

    pdf.save(fileName);
    return true;
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return false;
  }
};
