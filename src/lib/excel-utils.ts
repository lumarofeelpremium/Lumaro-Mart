import * as XLSX from 'xlsx';
import { Order } from '../types';

export interface ExcelExportOptions {
  orders: Order[];
  fileName?: string;
  timeframeLabel?: string;
}

/**
 * Formats orders so that Customer Name, Order ID, Date, Delivery Charge,
 * Loyalty Points Discount, Grand Total, and Status appear ONLY ONCE per order (on the first line).
 * Additional products of the same order appear on separate clean rows below it without repeating
 * customer and order summary details.
 */
export const formatOrdersForGroupedExcel = (orders: Order[]) => {
  const rows: Record<string, string | number>[] = [];

  let grandTotalSum = 0;
  let totalItemsCount = 0;
  let totalDeliverySum = 0;
  let totalPointsDiscountSum = 0;

  orders.forEach((order) => {
    const orderDate = order.createdAt?.toDate 
      ? order.createdAt.toDate() 
      : (order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000) : null);
      
    const formattedDate = orderDate 
      ? `${String(orderDate.getDate()).padStart(2, '0')}/${String(orderDate.getMonth() + 1).padStart(2, '0')}/${orderDate.getFullYear()}`
      : 'N/A';

    const orderIdDisplay = `#${order.id ? order.id.slice(-8).toUpperCase() : 'ORDER'}`;
    const customerName = order.userName || 'N/A';
    const customerPhone = order.userPhone || 'N/A';
    const address = [order.address, order.pincode].filter(Boolean).join(', ') || 'N/A';
    const items = order.items && order.items.length > 0 ? order.items : [{ name: 'Standard Order', quantity: 1, price: order.total }];

    grandTotalSum += Number(order.total || 0);
    totalDeliverySum += Number(order.delivery || 0);
    totalPointsDiscountSum += Number(order.pointsRedeemed || 0);

    items.forEach((item, itemIdx) => {
      totalItemsCount += Number(item.quantity || 1);
      const isFirstItem = itemIdx === 0;

      rows.push({
        'Date': isFirstItem ? formattedDate : '',
        'Order ID': isFirstItem ? orderIdDisplay : '',
        'Customer Name': isFirstItem ? customerName : '',
        'Customer Mobile': isFirstItem ? customerPhone : '',
        'Delivery Address': isFirstItem ? address : '',
        'Product Name': item.name,
        'Qty': item.quantity,
        'Unit Price (₹)': item.price,
        'Item Total (₹)': item.price * item.quantity,
        'Delivery Fee (₹)': isFirstItem ? (order.delivery || 0) : '',
        'Discount Points (₹)': isFirstItem ? (order.pointsRedeemed || 0) : '',
        'Grand Total (₹)': isFirstItem ? order.total : '',
        'Order Status': isFirstItem ? (order.status || '').toUpperCase() : '',
      });
    });

    // Add a blank separator row between different orders for clean readability
    rows.push({
      'Date': '',
      'Order ID': '',
      'Customer Name': '',
      'Customer Mobile': '',
      'Delivery Address': '',
      'Product Name': '',
      'Qty': '',
      'Unit Price (₹)': '',
      'Item Total (₹)': '',
      'Delivery Fee (₹)': '',
      'Discount Points (₹)': '',
      'Grand Total (₹)': '',
      'Order Status': '',
    });
  });

  // Add Grand Summary row at the bottom
  rows.push({
    'Date': 'TOTAL SUMMARY',
    'Order ID': `${orders.length} Orders`,
    'Customer Name': '',
    'Customer Mobile': '',
    'Delivery Address': '',
    'Product Name': `${totalItemsCount} Total Items`,
    'Qty': totalItemsCount,
    'Unit Price (₹)': '',
    'Item Total (₹)': '',
    'Delivery Fee (₹)': totalDeliverySum,
    'Discount Points (₹)': totalPointsDiscountSum,
    'Grand Total (₹)': grandTotalSum,
    'Order Status': 'COMPLETED',
  });

  return rows;
};

/**
 * Generates an Excel Blob from orders with grouped formatting and proper column widths.
 */
export const generateOrdersExcelBlob = (
  orders: Order[],
  sheetTitle: string = 'Sales Report'
): { blob: Blob; fileName: string } => {
  const rows = formatOrdersForGroupedExcel(orders);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set professional column widths
  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 16 }, // Order ID
    { wch: 22 }, // Customer Name
    { wch: 16 }, // Customer Mobile
    { wch: 32 }, // Delivery Address
    { wch: 32 }, // Product Name
    { wch: 10 }, // Qty
    { wch: 14 }, // Unit Price (₹)
    { wch: 16 }, // Item Total (₹)
    { wch: 16 }, // Delivery Fee (₹)
    { wch: 18 }, // Discount Points (₹)
    { wch: 18 }, // Grand Total (₹)
    { wch: 16 }, // Order Status
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
  });

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const fileName = `LumaroMart_Sales_Report_${dateStr}.xlsx`;

  return { blob, fileName };
};

/**
 * Universal Mobile & Desktop Excel Downloader.
 * Solves the issue where XLSX.writeFile fails silently inside Android Chrome / WebView / Safari mobile.
 */
export const downloadSalesExcel = async (
  orders: Order[],
  timeframeLabel: string = 'Report'
): Promise<boolean> => {
  try {
    const { blob, fileName } = generateOrdersExcelBlob(orders, `Sales_${timeframeLabel}`);

    // Create object URL for robust direct download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 2500);

    return true;
  } catch (error) {
    console.error('Error downloading Excel on mobile/desktop:', error);
    return false;
  }
};

/**
 * Mobile-friendly Web Share for Excel:
 * Lets the store owner share the .xlsx file directly to WhatsApp, Google Sheets, or Save to Files on mobile.
 */
export const shareSalesExcel = async (
  orders: Order[],
  timeframeLabel: string = 'Report'
): Promise<boolean> => {
  try {
    const { blob, fileName } = generateOrdersExcelBlob(orders, `Sales_${timeframeLabel}`);
    const file = new File([blob], fileName, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Lumaro Mart - Sales Report (${timeframeLabel})`,
        text: `Sales Report containing ${orders.length} orders.`,
      });
      return true;
    } else {
      // Fallback to direct download
      return downloadSalesExcel(orders, timeframeLabel);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return true; // user closed share sheet
    console.warn('Share not supported, falling back to download:', err);
    return downloadSalesExcel(orders, timeframeLabel);
  }
};
