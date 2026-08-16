import React from 'react';
import { Order, User, AppSettings } from '../types';
import { calculateEarnedPoints } from '../lib/receipt-utils';

export interface PrintableOrderReceiptProps {
  order: Order;
  customer?: User | null;
  storeSettings?: AppSettings;
}

export const PrintableOrderReceipt = React.forwardRef<HTMLDivElement, PrintableOrderReceiptProps>(
  ({ order, customer, storeSettings }, ref) => {
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
    const earnedLoyaltyPoints = calculateEarnedPoints(order);
    const customerAddress = order.address || customer?.address || '';
    const customerPincode = order.pincode || customer?.pincode || '';

    return (
      <div 
        ref={ref} 
        style={{
          backgroundColor: '#ffffff',
          color: '#111827',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          maxWidth: '580px',
          margin: '0 auto',
          padding: '32px',
          boxSizing: 'border-box'
        }}
        className="print:p-4 print:text-black"
      >
        {/* Header */}
        <div style={{ textAlign: 'center', paddingBottom: '16px', borderBottom: '2px solid #111827' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase', color: '#111827', margin: 0 }}>
            LUMARO MART
          </h1>
          <p style={{ fontSize: '12px', color: '#4b5563', fontWeight: 500, marginTop: '4px', marginBottom: 0 }}>
            Grocery & Daily Essentials Store
          </p>
          {storeSettings?.supportNumber && (
            <p style={{ fontSize: '12px', color: '#4b5563', marginTop: '2px', marginBottom: 0 }}>
              Helpline: +91 {storeSettings.supportNumber}
            </p>
          )}
          <div style={{ marginTop: '8px', display: 'inline-block', padding: '4px 12px', backgroundColor: '#f3f4f6', borderRadius: '9999px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#1f2937', border: '1px solid #e5e7eb' }}>
            Order Bill / Receipt
          </div>
        </div>

        {/* Meta & Customer Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px 0', borderBottom: '1px solid #e5e7eb', fontSize: '12px' }}>
          <div>
            <p style={{ color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px', margin: 0 }}>
              Order Details
            </p>
            <p style={{ fontWeight: 700, fontSize: '14px', color: '#111827', marginTop: '2px', marginBottom: 0 }}>
              #{order.id.slice(-8).toUpperCase()}
            </p>
            <p style={{ color: '#4b5563', marginTop: '4px', marginBottom: 0 }}>
              <span style={{ fontWeight: 600, color: '#1f2937' }}>Date:</span> {formattedDate} {formattedTime}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px', margin: 0 }}>
              Customer Details
            </p>
            <p style={{ fontWeight: 700, fontSize: '14px', color: '#111827', marginTop: '2px', marginBottom: 0 }}>
              {order.userName || customer?.displayName || 'Customer'}
            </p>
            <p style={{ color: '#4b5563', marginTop: '4px', marginBottom: 0 }}>
              <span style={{ fontWeight: 600, color: '#1f2937' }}>Phone:</span> {order.userPhone || customer?.phoneNumber || 'N/A'}
            </p>
            {(customerAddress || customerPincode) && (
              <p style={{ color: '#4b5563', marginTop: '2px', marginBottom: 0, wordBreak: 'break-word' }}>
                <span style={{ fontWeight: 600, color: '#1f2937' }}>Address:</span> {customerAddress} {customerPincode ? `(${customerPincode})` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div style={{ padding: '16px 0' }}>
          <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #111827', color: '#1f2937' }}>
                <th style={{ padding: '8px 4px', textAlign: 'center', width: '32px', fontWeight: 700 }}>#</th>
                <th style={{ padding: '8px 8px', fontWeight: 700 }}>Item Description</th>
                <th style={{ padding: '8px 8px', textAlign: 'center', width: '56px', fontWeight: 700 }}>Qty</th>
                <th style={{ padding: '8px 8px', textAlign: 'right', width: '64px', fontWeight: 700 }}>Price</th>
                <th style={{ padding: '8px 8px', textAlign: 'right', width: '80px', fontWeight: 700 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 4px', textAlign: 'center', fontFamily: 'monospace', color: '#6b7280' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 8px', fontWeight: 600, color: '#111827' }}>{item.name}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, color: '#1f2937' }}>{item.quantity}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 500, color: '#374151' }}>₹{item.price}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>₹{item.price * item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bill Calculation */}
        <div style={{ paddingTop: '8px', paddingBottom: '16px', borderTop: '2px solid #111827', fontSize: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151', marginBottom: '6px' }}>
            <span>Items Subtotal ({totalQuantity} {totalQuantity === 1 ? 'item' : 'items'})</span>
            <span style={{ fontWeight: 600, color: '#111827' }}>₹{calculatedSubtotal}</span>
          </div>
          {order.delivery !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151', marginBottom: '6px' }}>
              <span>Delivery Fee</span>
              <span style={{ fontWeight: 600, color: '#111827' }}>{order.delivery === 0 ? 'FREE' : `₹${order.delivery}`}</span>
            </div>
          )}
          {order.pointsRedeemed !== undefined && order.pointsRedeemed > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 600, marginBottom: '6px' }}>
              <span>Discount / Points Redeemed</span>
              <span>-₹{order.pointsRedeemed}</span>
            </div>
          )}
          <div style={{ paddingTop: '10px', borderTop: '1px solid #9ca3af', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '16px', fontWeight: 900, color: '#111827' }}>
            <span>GRAND TOTAL</span>
            <span>₹{order.total}</span>
          </div>
        </div>

        {/* Loyalty Points Earned Highlight Box */}
        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '16px', border: '2px solid #059669', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '0.5px', color: '#064e3b', textTransform: 'uppercase', margin: 0 }}>
            🎉 YOU EARNED {earnedLoyaltyPoints} LOYALTY POINTS ON THIS ORDER!
          </p>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', marginTop: '4px', marginBottom: 0 }}>
            (1 Point = ₹1 • You can redeem these points for discounts on your next order)
          </p>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed #9ca3af', textAlign: 'center', fontSize: '11px', color: '#4b5563' }}>
          <p style={{ fontWeight: 700, color: '#1f2937', margin: 0 }}>Thank you for shopping with Lumaro Mart!</p>
          <p style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', marginBottom: 0 }}>Please check all items at the time of delivery.</p>
        </div>
      </div>
    );
  }
);

PrintableOrderReceipt.displayName = 'PrintableOrderReceipt';
