import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, CheckCircle2, XCircle, Clock, Search, AlertCircle, Copy, Check, Users, Sparkles, ShieldCheck, ArrowRight, RefreshCw, Filter, DollarSign, Calendar, Truck } from 'lucide-react';
import { User, AppSettings, UserSubscription } from '../types';
import { auth, db } from '../firebase';
import { doc, updateDoc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { verifyAndActivateSubscription, cancelUserSubscription, rejectSubscriptionRequest } from '../lib/subscription-utils';
import { Button, Input } from './ui/Base';
import { cn } from '../lib/utils';

interface SubscriptionsTabProps {
  subscriptions: UserSubscription[];
  users: User[];
  settings: AppSettings | null;
  onOpenSettings?: () => void;
}

export const SubscriptionsTab: React.FC<SubscriptionsTabProps> = ({
  subscriptions,
  users,
  settings,
  onOpenSettings
}) => {
  const [activeSubView, setActiveSubView] = useState<'pending' | 'active' | 'all' | 'grant'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);
  const [rejectionModal, setRejectionModal] = useState<{ sub: UserSubscription; reason: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Manual Grant State
  const [grantSearch, setGrantSearch] = useState('');
  const [selectedUserForGrant, setSelectedUserForGrant] = useState<User | null>(null);
  const [grantDurationDays, setGrantDurationDays] = useState<number>(30);
  const [grantMaxOrders, setGrantMaxOrders] = useState<number>(-1); // -1 = Unlimited

  // Separate lists
  const pendingRequests = useMemo(() => {
    return subscriptions.filter(s => s.status === 'pending_verification');
  }, [subscriptions]);

  const activeSubscribers = useMemo(() => {
    // Both from user_subscriptions with status=active and users with isSubscribed=true
    return users.filter(u => u.isSubscribed);
  }, [users]);

  const allRecords = useMemo(() => {
    return subscriptions;
  }, [subscriptions]);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUtr(text);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  // 1. Admin Approves and Activates
  const handleApprove = async (sub: UserSubscription) => {
    if (!sub.id) return;
    setIsProcessing(sub.id);
    try {
      await verifyAndActivateSubscription({
        subscription: sub,
        adminId: auth.currentUser?.uid || 'admin'
      });
      showNotification(`✅ Payment verified! ${sub.userName || 'User'} ka VIP Subscription activate kar diya gaya.`);
    } catch (e: any) {
      console.error('Approve failed:', e);
      showNotification('Verification failed: ' + (e?.message || 'Error'), 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  // 2. Admin Rejects
  const handleRejectConfirm = async () => {
    if (!rejectionModal?.sub?.id) return;
    const sub = rejectionModal.sub;
    const reason = rejectionModal.reason || 'Payment not received or invalid UTR';
    setIsProcessing(sub.id);
    try {
      await rejectSubscriptionRequest({
        subscriptionId: sub.id,
        userId: sub.userId,
        reason
      });
      showNotification(`❌ Request reject kar di gayi (${reason})`);
      setRejectionModal(null);
    } catch (e: any) {
      console.error('Reject failed:', e);
      showNotification('Rejection failed: ' + (e?.message || 'Error'), 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  // 3. Admin Cancels User's Active Subscription
  const handleCancelSubscription = async (userToCancel: User) => {
    const confirmCancel = window.confirm(
      `⚠️ Kya aap sach me "${userToCancel.displayName || 'Customer'}" ka VIP Subscription Cancel karna chahte hain?\n\nInke VIP perks aur delivery discounts turant band ho jayenge.`
    );
    if (!confirmCancel) return;

    setIsProcessing(userToCancel.uid);
    try {
      // Find matching active sub record if exists
      const matchingSub = subscriptions.find(s => s.userId === userToCancel.uid && s.status === 'active');
      await cancelUserSubscription({
        userId: userToCancel.uid,
        subscriptionId: matchingSub?.id,
        adminId: auth.currentUser?.uid || 'admin',
        reason: 'Cancelled by Admin'
      });
      showNotification(`🛑 "${userToCancel.displayName || 'User'}" ka VIP Subscription safaltapoorvak Cancel kar diya gaya.`);
    } catch (e: any) {
      console.error('Cancel failed:', e);
      showNotification('Cancel failed: ' + (e?.message || 'Error'), 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  // 4. Admin Manual Grant
  const handleManualGrant = async () => {
    if (!selectedUserForGrant) return;
    setIsProcessing('grant');
    try {
      const nowMs = Date.now();
      const expiresMs = nowMs + grantDurationDays * 24 * 60 * 60 * 1000;
      const planName = settings?.subscriptionPlanName || 'Lumaro VIP Club';
      const fee = Number(settings?.subscriptionFee) || 99;

      // Update user doc
      await updateDoc(doc(db, 'users', selectedUserForGrant.uid), {
        isSubscribed: true,
        subscriptionPlanName: planName,
        subscriptionStartDate: nowMs,
        subscriptionExpiresAt: expiresMs,
        subscriptionOrdersRemaining: grantMaxOrders,
        subscriptionOrdersTotal: grantMaxOrders,
        subscriptionOrdersUsed: 0,
        subscriptionFeePaid: fee,
        subscriptionPendingVerification: false,
        subscriptionStatus: 'active'
      });

      // Also record in user_subscriptions
      const subRecordRef = doc(collection(db, 'user_subscriptions'));
      await setDoc(subRecordRef, {
        id: subRecordRef.id,
        userId: selectedUserForGrant.uid,
        userName: selectedUserForGrant.displayName,
        userEmail: selectedUserForGrant.email,
        userPhone: selectedUserForGrant.phoneNumber,
        planName,
        fee,
        durationDays: grantDurationDays,
        subscriberDeliveryFee: Number(settings?.subscriberDeliveryFee) || 0,
        maxOrders: grantMaxOrders,
        ordersRemaining: grantMaxOrders,
        ordersUsed: 0,
        startDate: nowMs,
        expiresAt: expiresMs,
        status: 'active',
        paymentMethod: 'manual_admin',
        upiTransactionId: 'ADMIN_GRANT',
        verifiedAt: serverTimestamp(),
        verifiedBy: auth.currentUser?.uid || 'admin',
        createdAt: serverTimestamp()
      });

      showNotification(`🎉 ${selectedUserForGrant.displayName || 'User'} ko ${grantDurationDays} dino ke liye VIP Membership grant kar di gayi!`);
      setSelectedUserForGrant(null);
      setGrantSearch('');
      setActiveSubView('active');
    } catch (e: any) {
      console.error('Manual grant failed:', e);
      showNotification('Grant failed: ' + (e?.message || 'Error'), 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  // Revenue calculation
  const totalRevenue = useMemo(() => {
    return subscriptions
      .filter(s => s.status === 'active')
      .reduce((acc, s) => acc + (Number(s.fee) || 0), 0);
  }, [subscriptions]);

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className={cn(
              "p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg border",
              statusMessage.type === 'success'
                ? "bg-emerald-900 text-white border-emerald-700"
                : "bg-red-900 text-white border-red-700"
            )}
          >
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="ml-2 text-white/70 hover:text-white">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 rounded-3xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shrink-0">
              <Crown size={28} className="text-yellow-200 fill-yellow-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black">VIP Subscriptions Management</h2>
                <span className="bg-yellow-300 text-amber-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                  Admin Control
                </span>
              </div>
              <p className="text-xs text-yellow-100 mt-0.5">
                UPI पेमेंट वेरिफ़िकेशन, नए सदस्य एक्टिवेशन, और सब्स्क्रिप्शन कैंसिलेशन
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-bold rounded-xl border border-white/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>⚙️ Plan Settings (₹{settings?.subscriptionFee ?? 99})</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mt-5 pt-4 border-t border-white/20 relative z-10 text-center">
          <div className="bg-black/15 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
            <p className="text-[10px] text-yellow-200 font-bold uppercase tracking-wider">Pending Approval</p>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-black">{pendingRequests.length}</span>
              {pendingRequests.length > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
              )}
            </div>
          </div>
          <div className="bg-black/15 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
            <p className="text-[10px] text-yellow-200 font-bold uppercase tracking-wider">Active VIP Members</p>
            <p className="text-xl sm:text-2xl font-black mt-0.5">{activeSubscribers.length}</p>
          </div>
          <div className="bg-black/15 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
            <p className="text-[10px] text-yellow-200 font-bold uppercase tracking-wider">VIP Plan Price</p>
            <p className="text-xl sm:text-2xl font-black mt-0.5">₹{settings?.subscriptionFee ?? 99}</p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setActiveSubView('pending')}
          className={cn(
            "px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border",
            activeSubView === 'pending'
              ? "bg-amber-600 text-white border-amber-600 shadow-md"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          )}
        >
          <Clock size={15} />
          <span>⏳ Pending Verifications</span>
          {pendingRequests.length > 0 && (
            <span className={cn(
              "text-[9px] font-black px-1.5 py-0.2 rounded-full",
              activeSubView === 'pending' ? "bg-white text-amber-700" : "bg-red-500 text-white"
            )}>
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubView('active')}
          className={cn(
            "px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border",
            activeSubView === 'active'
              ? "bg-amber-600 text-white border-amber-600 shadow-md"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          )}
        >
          <Crown size={15} />
          <span>👑 Active Members ({activeSubscribers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubView('grant')}
          className={cn(
            "px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border",
            activeSubView === 'grant'
              ? "bg-amber-600 text-white border-amber-600 shadow-md"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          )}
        >
          <Users size={15} />
          <span>➕ Grant VIP Manually</span>
        </button>

        <button
          onClick={() => setActiveSubView('all')}
          className={cn(
            "px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border",
            activeSubView === 'all'
              ? "bg-amber-600 text-white border-amber-600 shadow-md"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          )}
        >
          <Filter size={15} />
          <span>📋 All Records ({allRecords.length})</span>
        </button>
      </div>

      {/* VIEW 1: PENDING VERIFICATION QUEUE */}
      {activeSubView === 'pending' && (
        <div className="space-y-3">
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900">
            <span className="font-bold flex items-center gap-1.5">
              <Sparkles size={15} className="text-amber-600" />
              <span>Pending UPI Payment Verifications:</span>
            </span>
            <span className="text-[11px] text-amber-700">
              User ke UPI UTR check karke "Approve" dabayein taaki VIP activate ho sake.
            </span>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-gray-100 space-y-2">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
              <h3 className="text-base font-bold text-gray-800">Koi Pending Request Nahi Hai!</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Sabhi UPI subscription requests verify ho chuki hain. Jab koi naya customer subscription ke liye payment karega, request yahan dikhegi.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {pendingRequests.map(sub => {
                const isItemProcessing = isProcessing === sub.id;
                const submittedDate = sub.submittedAt 
                  ? new Date(sub.submittedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Recent';

                return (
                  <div 
                    key={sub.id} 
                    className="p-4 bg-white rounded-3xl border border-amber-200 shadow-sm space-y-3.5 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm shrink-0 border border-amber-300">
                          {sub.userName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-sm text-gray-900">{sub.userName || 'Customer'}</h4>
                            <span className="bg-amber-100 text-amber-900 text-[9px] font-black px-1.5 py-0.2 rounded border border-amber-300">
                              PENDING
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500">
                            {sub.userPhone || sub.userEmail || 'No contact info'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-amber-950">₹{sub.fee}</span>
                        <p className="text-[10px] text-gray-400">{submittedDate}</p>
                      </div>
                    </div>

                    {/* UTR Box with 1-Click Copy */}
                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                          UPI Ref / UTR Transaction ID:
                        </span>
                        <span className="font-mono text-xs font-bold text-gray-900 truncate block">
                          {sub.upiTransactionId || 'No UTR Provided'}
                        </span>
                      </div>
                      {sub.upiTransactionId && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(sub.upiTransactionId || '')}
                          className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-[10px] font-bold text-gray-700 flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                        >
                          {copiedUtr === sub.upiTransactionId ? (
                            <>
                              <Check size={12} className="text-emerald-600" />
                              <span className="text-emerald-600">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy UTR</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Plan Details Summary */}
                    <div className="text-[11px] text-gray-600 flex items-center justify-between pt-1 border-t border-gray-100">
                      <span>Plan: <b>{sub.planName}</b></span>
                      <span>Duration: <b>{sub.durationDays} Days</b></span>
                      <span>Delivery: <b>₹{sub.subscriberDeliveryFee}</b></span>
                    </div>

                    {/* Actions: Approve & Reject */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleApprove(sub)}
                        disabled={isItemProcessing}
                        className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        <CheckCircle2 size={15} />
                        <span>{isItemProcessing ? 'Activating...' : 'Approve & Activate'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRejectionModal({ sub, reason: 'Payment not received or invalid UTR' })}
                        disabled={isItemProcessing}
                        className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <XCircle size={15} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ACTIVE SUBSCRIBERS WITH CANCEL OPTION */}
      {activeSubView === 'active' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs font-bold text-gray-700">
              Active VIP Members: <span className="text-amber-600">{activeSubscribers.length}</span>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl outline-none focus:border-amber-500 font-medium"
              />
            </div>
          </div>

          {activeSubscribers.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-gray-100 space-y-2">
              <Crown size={40} className="mx-auto text-gray-300" />
              <h3 className="text-base font-bold text-gray-800">Koi Active VIP Subscriber Nahi Hai</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Aap "Grant VIP Manually" tab se kisi bhi customer ko direct VIP member bana sakte hain.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {activeSubscribers
                .filter(u => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    (u.displayName && u.displayName.toLowerCase().includes(q)) ||
                    (u.phoneNumber && u.phoneNumber.includes(q)) ||
                    (u.email && u.email.toLowerCase().includes(q))
                  );
                })
                .map(user => {
                  const isItemProcessing = isProcessing === user.uid;
                  const expiresMs = typeof user.subscriptionExpiresAt === 'number'
                    ? user.subscriptionExpiresAt
                    : user.subscriptionExpiresAt?.toMillis
                      ? user.subscriptionExpiresAt.toMillis()
                      : new Date(user.subscriptionExpiresAt || 0).getTime();

                  const daysRemaining = expiresMs > 0 ? Math.max(0, Math.ceil((expiresMs - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
                  const expiryDateFormatted = expiresMs > 0 
                    ? new Date(expiresMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'N/A';

                  const ordersLeft = user.subscriptionOrdersRemaining === -1 || user.subscriptionOrdersRemaining === undefined
                    ? 'Unlimited'
                    : user.subscriptionOrdersRemaining;

                  return (
                    <div 
                      key={user.uid}
                      className="p-4 bg-white rounded-3xl border border-gray-200 shadow-2xs hover:shadow-sm transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                            <Crown size={20} className="text-yellow-200 fill-yellow-200" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-sm text-gray-900">{user.displayName || 'Customer'}</h4>
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2 rounded border border-emerald-300">
                                ACTIVE
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500">
                              {user.phoneNumber || user.email || 'No contact info'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                            {daysRemaining} Days Left
                          </span>
                        </div>
                      </div>

                      {/* VIP Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center p-2.5 bg-amber-50/50 rounded-2xl border border-amber-100 text-xs">
                        <div>
                          <span className="text-[9px] text-gray-400 font-bold uppercase block">Plan</span>
                          <span className="font-extrabold text-gray-800 truncate block">{user.subscriptionPlanName || 'VIP Club'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-400 font-bold uppercase block">Orders Left</span>
                          <span className="font-extrabold text-emerald-700 block">{ordersLeft}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-400 font-bold uppercase block">Expires On</span>
                          <span className="font-extrabold text-gray-800 block text-[11px] truncate">{expiryDateFormatted}</span>
                        </div>
                      </div>

                      {/* Admin Cancel Button */}
                      <div className="pt-1 flex items-center justify-between gap-2 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400">
                          Used: {user.subscriptionOrdersUsed || 0} orders
                        </p>

                        <button
                          type="button"
                          onClick={() => handleCancelSubscription(user)}
                          disabled={isItemProcessing}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          <span>{isItemProcessing ? 'Cancelling...' : 'Cancel Subscription (रद्द करें)'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: MANUAL VIP GRANT */}
      {activeSubView === 'grant' && (
        <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-4 max-w-xl mx-auto">
          <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center">
              <Crown size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900">Manually Grant VIP Subscription</h3>
              <p className="text-[11px] text-gray-500">Kisi bhi user ko bina payment ke direct VIP membership dein</p>
            </div>
          </div>

          {/* User Search & Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">1. Customer Select Karein:</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={grantSearch}
                onChange={(e) => setGrantSearch(e.target.value)}
                placeholder="Search user by name, phone or email..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-amber-500 font-medium"
              />
            </div>

            {grantSearch.trim().length > 0 && !selectedUserForGrant && (
              <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-1 bg-white shadow-xs">
                {users
                  .filter(u => {
                    const q = grantSearch.toLowerCase();
                    return (
                      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
                      (u.phoneNumber && u.phoneNumber.includes(q)) ||
                      (u.email && u.email.toLowerCase().includes(q))
                    );
                  })
                  .slice(0, 10)
                  .map(u => (
                    <div
                      key={u.uid}
                      onClick={() => {
                        setSelectedUserForGrant(u);
                        setGrantSearch('');
                      }}
                      className="p-2 hover:bg-amber-50 rounded-lg cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-gray-900">{u.displayName || 'No Name'}</p>
                        <p className="text-[10px] text-gray-500">{u.phoneNumber || u.email}</p>
                      </div>
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded",
                        u.isSubscribed ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
                      )}>
                        {u.isSubscribed ? "Already VIP" : "Select"}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {selectedUserForGrant && (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-950">
                    Selected: {selectedUserForGrant.displayName || 'Customer'}
                  </p>
                  <p className="text-[10px] text-amber-800">
                    {selectedUserForGrant.phoneNumber || selectedUserForGrant.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserForGrant(null)}
                  className="text-xs text-red-600 hover:underline font-bold"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Duration Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">2. Validity Duration (Days):</label>
            <div className="grid grid-cols-4 gap-2">
              {[30, 60, 90, 365].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setGrantDurationDays(days)}
                  className={cn(
                    "py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                    grantDurationDays === days
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-white"
                  )}
                >
                  {days === 365 ? '1 Year' : `${days} Days`}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Limit */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">3. Orders Allowance:</label>
            <div className="grid grid-cols-3 gap-2">
              {[-1, 10, 25].map(quota => (
                <button
                  key={quota}
                  type="button"
                  onClick={() => setGrantMaxOrders(quota)}
                  className={cn(
                    "py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                    grantMaxOrders === quota
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-white"
                  )}
                >
                  {quota === -1 ? 'Unlimited' : `${quota} Orders`}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Grant */}
          <Button
            onClick={handleManualGrant}
            disabled={!selectedUserForGrant || isProcessing === 'grant'}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
          >
            <Crown size={16} />
            <span>Grant VIP Membership Now</span>
          </Button>
        </div>
      )}

      {/* VIEW 4: ALL RECORDS / HISTORY */}
      {activeSubView === 'all' && (
        <div className="space-y-3">
          <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-2xs">
            <div className="p-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs font-bold text-gray-700">
              <span>All Subscription Records ({allRecords.length})</span>
            </div>

            {allRecords.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                Koi subscription record nahi mila.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {allRecords.map(rec => (
                  <div key={rec.id} className="p-3.5 flex items-center justify-between gap-2 text-xs hover:bg-gray-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{rec.userName || 'Customer'}</span>
                        <span className={cn(
                          "text-[9px] font-black px-1.5 py-0.2 rounded uppercase",
                          rec.status === 'active' ? "bg-emerald-100 text-emerald-800" :
                          rec.status === 'pending_verification' ? "bg-amber-100 text-amber-800" :
                          rec.status === 'canceled' ? "bg-rose-100 text-rose-800" :
                          "bg-gray-100 text-gray-600"
                        )}>
                          {rec.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {rec.userPhone || rec.userEmail} • Ref: {rec.upiTransactionId || 'N/A'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-gray-900">₹{rec.fee}</span>
                      <p className="text-[10px] text-gray-400">{rec.durationDays} Days</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl border border-gray-100">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <XCircle size={18} />
              <span>Reject Subscription Request</span>
            </div>
            <p className="text-xs text-gray-600">
              User <b>{rejectionModal.sub.userName || 'Customer'}</b> ka ₹{rejectionModal.sub.fee} ka request reject karne ka karan likhein:
            </p>

            <Input
              value={rejectionModal.reason}
              onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value })}
              placeholder="e.g. Payment not credited in bank / Invalid UTR"
              className="text-xs"
            />

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectionModal(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
