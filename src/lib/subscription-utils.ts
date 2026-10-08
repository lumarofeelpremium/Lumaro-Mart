import { User, AppSettings, UserSubscription } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, setDoc, collection, serverTimestamp, increment } from 'firebase/firestore';

/**
 * Checks if a user has an active Lumaro VIP / Plus subscription.
 */
export function isSubscriptionActive(user?: User | null): boolean {
  if (!user || !user.isSubscribed) return false;

  // Check expiration if set
  if (user.subscriptionExpiresAt) {
    const expiryTime = typeof user.subscriptionExpiresAt === 'number'
      ? user.subscriptionExpiresAt
      : user.subscriptionExpiresAt?.toMillis
        ? user.subscriptionExpiresAt.toMillis()
        : new Date(user.subscriptionExpiresAt).getTime();

    if (!isNaN(expiryTime) && expiryTime > 0 && Date.now() > expiryTime) {
      return false; // Expired
    }
  }

  // Check remaining order quota
  // -1 or undefined means Unlimited orders under this plan
  if (user.subscriptionOrdersRemaining !== undefined && user.subscriptionOrdersRemaining !== null) {
    if (user.subscriptionOrdersRemaining === 0) {
      return false; // Quota exhausted
    }
  }

  return true;
}

/**
 * Detailed summary of user's subscription
 */
export function getSubscriptionSummary(user?: User | null) {
  const active = isSubscriptionActive(user);
  if (!user || !user.isSubscribed) {
    return {
      isActive: false,
      statusLabel: 'Not Subscribed',
      daysRemaining: 0,
      ordersRemaining: 0,
      isUnlimitedOrders: false,
      expiryDateFormatted: ''
    };
  }

  let daysRemaining = 0;
  let expiryDateFormatted = '';
  if (user.subscriptionExpiresAt) {
    const expiryTime = typeof user.subscriptionExpiresAt === 'number'
      ? user.subscriptionExpiresAt
      : user.subscriptionExpiresAt?.toMillis
        ? user.subscriptionExpiresAt.toMillis()
        : new Date(user.subscriptionExpiresAt).getTime();

    if (!isNaN(expiryTime) && expiryTime > 0) {
      daysRemaining = Math.max(0, Math.ceil((expiryTime - Date.now()) / (1000 * 60 * 60 * 24)));
      expiryDateFormatted = new Date(expiryTime).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  }

  const isUnlimitedOrders = user.subscriptionOrdersRemaining === -1 || user.subscriptionOrdersRemaining === undefined;
  const ordersRemaining = isUnlimitedOrders ? 9999 : Math.max(0, user.subscriptionOrdersRemaining || 0);

  return {
    isActive: active,
    statusLabel: active ? 'Active' : (daysRemaining === 0 ? 'Expired' : 'Quota Completed'),
    planName: user.subscriptionPlanName || 'Lumaro VIP',
    daysRemaining,
    ordersRemaining,
    isUnlimitedOrders,
    ordersTotal: user.subscriptionOrdersTotal ?? -1,
    ordersUsed: user.subscriptionOrdersUsed ?? 0,
    expiryDateFormatted
  };
}

/**
 * Days of the week metadata with Hindi labels
 */
export const DAYS_OF_WEEK = [
  { index: 0, id: '0', name: 'Sunday', hindi: 'रविवार', shortHindi: 'रवि' },
  { index: 1, id: '1', name: 'Monday', hindi: 'सोमवार', shortHindi: 'सोम' },
  { index: 2, id: '2', name: 'Tuesday', hindi: 'मंगलवार', shortHindi: 'मंगल' },
  { index: 3, id: '3', name: 'Wednesday', hindi: 'बुधवार', shortHindi: 'बुध' },
  { index: 4, id: '4', name: 'Thursday', hindi: 'गुरुवार', shortHindi: 'गुरु' },
  { index: 5, id: '5', name: 'Friday', hindi: 'शुक्रवार', shortHindi: 'शुक्र' },
  { index: 6, id: '6', name: 'Saturday', hindi: 'शनिवार', shortHindi: 'शनि' },
];

/**
 * Gets active delivery rule for TODAY based on day-of-week settings
 */
export function getTodayDeliveryRule(settings?: AppSettings | null) {
  const todayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...
  const dayMeta = DAYS_OF_WEEK[todayIndex];

  const defaultStandardFee = settings?.standardDeliveryFee !== undefined ? Number(settings.standardDeliveryFee) : 20;
  const defaultThreshold = settings?.freeDeliveryMinAmount !== undefined ? Number(settings.freeDeliveryMinAmount) : 100;

  if (settings?.dayWiseDeliveryEnabled && settings.dayWiseDeliveryRules) {
    const customRule = (settings.dayWiseDeliveryRules as any)[todayIndex] || (settings.dayWiseDeliveryRules as any)[String(todayIndex)];
    if (customRule && customRule.enabled !== false) {
      return {
        isDayWiseActive: true,
        dayIndex: todayIndex,
        dayName: dayMeta.name,
        dayHindi: dayMeta.hindi,
        standardFee: Number(customRule.standardFee) !== undefined && !isNaN(Number(customRule.standardFee)) ? Number(customRule.standardFee) : defaultStandardFee,
        freeDeliveryMinAmount: Number(customRule.freeDeliveryMinAmount) !== undefined && !isNaN(Number(customRule.freeDeliveryMinAmount)) ? Number(customRule.freeDeliveryMinAmount) : defaultThreshold
      };
    }
  }

  return {
    isDayWiseActive: false,
    dayIndex: todayIndex,
    dayName: dayMeta.name,
    dayHindi: dayMeta.hindi,
    standardFee: defaultStandardFee,
    freeDeliveryMinAmount: defaultThreshold
  };
}

/**
 * Calculates delivery fee based on admin thresholds, day-of-week custom rules, and VIP subscription perks.
 */
export function calculateDeliveryFee({
  subtotal,
  user,
  settings,
  isFirstOrder = false
}: {
  subtotal: number;
  user?: User | null;
  settings?: AppSettings | null;
  isFirstOrder?: boolean;
}): {
  deliveryFee: number;
  standardFee: number;
  freeDeliveryMinAmount: number;
  isFree: boolean;
  isSubscriberBenefitApplied: boolean;
  savings: number;
  remainingForFreeDelivery: number;
  subscriberDeliveryFee: number;
  isSubscribed: boolean;
  isDayWiseActive: boolean;
  dayName: string;
  dayHindi: string;
} {
  const todayRule = getTodayDeliveryRule(settings);

  if (subtotal <= 0) {
    return {
      deliveryFee: 0,
      standardFee: todayRule.standardFee,
      freeDeliveryMinAmount: todayRule.freeDeliveryMinAmount,
      isFree: true,
      isSubscriberBenefitApplied: false,
      savings: 0,
      remainingForFreeDelivery: 0,
      subscriberDeliveryFee: 0,
      isSubscribed: false,
      isDayWiseActive: todayRule.isDayWiseActive,
      dayName: todayRule.dayName,
      dayHindi: todayRule.dayHindi
    };
  }

  // Active delivery rates for today
  const standardFee = todayRule.standardFee;
  const freeDeliveryMinAmount = todayRule.freeDeliveryMinAmount;
  const subscriberDeliveryFee = settings?.subscriberDeliveryFee !== undefined ? Number(settings.subscriberDeliveryFee) : 0;
  const subscriberMinOrder = Number(settings?.subscriberMinOrderAmount) || 0;

  const isVip = isSubscriptionActive(user);

  // Normal fee calculation based on today's threshold
  const normalFee = subtotal >= freeDeliveryMinAmount ? 0 : standardFee;
  const remainingForFreeDelivery = Math.max(0, freeDeliveryMinAmount - subtotal);

  // 1. VIP Subscriber condition
  if (isVip && subtotal >= subscriberMinOrder) {
    const finalFee = subscriberDeliveryFee;
    const savings = Math.max(0, normalFee - finalFee);
    return {
      deliveryFee: finalFee,
      standardFee,
      freeDeliveryMinAmount,
      isFree: finalFee === 0,
      isSubscriberBenefitApplied: true,
      savings,
      remainingForFreeDelivery: 0,
      subscriberDeliveryFee,
      isSubscribed: true,
      isDayWiseActive: todayRule.isDayWiseActive,
      dayName: todayRule.dayName,
      dayHindi: todayRule.dayHindi
    };
  }

  // 2. First order free promotion
  if (isFirstOrder && user) {
    return {
      deliveryFee: 0,
      standardFee,
      freeDeliveryMinAmount,
      isFree: true,
      isSubscriberBenefitApplied: false,
      savings: normalFee,
      remainingForFreeDelivery: 0,
      subscriberDeliveryFee,
      isSubscribed: false,
      isDayWiseActive: todayRule.isDayWiseActive,
      dayName: todayRule.dayName,
      dayHindi: todayRule.dayHindi
    };
  }

  // 3. Normal order with threshold check
  const finalFee = normalFee;
  return {
    deliveryFee: finalFee,
    standardFee,
    freeDeliveryMinAmount,
    isFree: finalFee === 0,
    isSubscriberBenefitApplied: false,
    savings: 0,
    remainingForFreeDelivery,
    subscriberDeliveryFee,
    isSubscribed: false,
    isDayWiseActive: todayRule.isDayWiseActive,
    dayName: todayRule.dayName,
    dayHindi: todayRule.dayHindi
  };
}

/**
 * Activates or renews VIP Subscription for a user in Firestore
 */
export async function activateUserSubscription({
  user,
  settings,
  paymentMethod = 'upi',
  upiTransactionId = ''
}: {
  user: User;
  settings: AppSettings;
  paymentMethod?: string;
  upiTransactionId?: string;
}): Promise<User> {
  const durationDays = Number(settings.subscriptionDurationDays) || 30;
  const maxOrders = settings.subscriptionMaxOrders !== undefined && settings.subscriptionMaxOrders > 0
    ? Number(settings.subscriptionMaxOrders)
    : -1; // -1 for Unlimited
  const feePaid = Number(settings.subscriptionFee) || 99;
  const planName = settings.subscriptionPlanName || 'Lumaro VIP Club';
  const subscriberDeliveryFee = Number(settings.subscriberDeliveryFee) || 0;

  const nowMs = Date.now();
  const expiresAtMs = nowMs + durationDays * 24 * 60 * 60 * 1000;

  const subscriptionData: Partial<User> = {
    isSubscribed: true,
    subscriptionPlanName: planName,
    subscriptionStartDate: nowMs,
    subscriptionExpiresAt: expiresAtMs,
    subscriptionOrdersRemaining: maxOrders,
    subscriptionOrdersTotal: maxOrders,
    subscriptionOrdersUsed: 0,
    subscriptionFeePaid: feePaid
  };

  // 1. Update user document
  const userRef = doc(db, 'users', user.uid);
  await updateDoc(userRef, subscriptionData);

  // 2. Add record to user_subscriptions collection for tracking & history
  try {
    const subRecordRef = doc(collection(db, 'user_subscriptions'));
    const subscriptionRecord: UserSubscription = {
      id: subRecordRef.id,
      userId: user.uid,
      userName: user.displayName,
      userEmail: user.email,
      userPhone: user.phoneNumber,
      planName,
      fee: feePaid,
      durationDays,
      subscriberDeliveryFee,
      maxOrders,
      ordersRemaining: maxOrders,
      ordersUsed: 0,
      startDate: nowMs,
      expiresAt: expiresAtMs,
      status: 'active',
      paymentMethod,
      upiTransactionId,
      createdAt: serverTimestamp()
    };
    await setDoc(subRecordRef, subscriptionRecord);
  } catch (err) {
    console.warn('Could not record subscription document (proceeding with user doc):', err);
  }

  return {
    ...user,
    ...subscriptionData
  };
}

/**
 * Consumes 1 order from quota when a subscriber places an order
 */
export async function decrementSubscriberOrderQuota(user: User): Promise<void> {
  if (!user || !user.uid || !user.isSubscribed) return;

  // If unlimited (-1), only increment ordersUsed
  if (user.subscriptionOrdersRemaining === -1 || user.subscriptionOrdersRemaining === undefined) {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        subscriptionOrdersUsed: increment(1)
      });
    } catch (e) {
      console.warn('Failed to update unlimited subscriber order count:', e);
    }
    return;
  }

  // If limited quota
  const currentRemaining = user.subscriptionOrdersRemaining || 0;
  const newRemaining = Math.max(0, currentRemaining - 1);

  try {
    await updateDoc(doc(db, 'users', user.uid), {
      subscriptionOrdersRemaining: newRemaining,
      subscriptionOrdersUsed: increment(1),
      ...(newRemaining === 0 ? { isSubscribed: false } : {}) // expire if quota reached
    });
  } catch (e) {
    console.warn('Failed to decrement subscriber quota:', e);
  }
}

/**
 * Submits a subscription request with UPI/UTR for admin verification
 */
export async function submitSubscriptionVerificationRequest({
  user,
  settings,
  upiTransactionId
}: {
  user: User;
  settings: AppSettings;
  upiTransactionId: string;
}): Promise<void> {
  const durationDays = Number(settings.subscriptionDurationDays) || 30;
  const maxOrders = settings.subscriptionMaxOrders !== undefined && settings.subscriptionMaxOrders > 0
    ? Number(settings.subscriptionMaxOrders)
    : -1;
  const feePaid = Number(settings.subscriptionFee) || 99;
  const planName = settings.subscriptionPlanName || 'Lumaro VIP Club';
  const subscriberDeliveryFee = Number(settings.subscriberDeliveryFee) || 0;

  const nowMs = Date.now();
  const expiresAtMs = nowMs + durationDays * 24 * 60 * 60 * 1000;

  // 1. Create a user_subscriptions request doc with pending_verification
  const subRecordRef = doc(collection(db, 'user_subscriptions'));
  const subscriptionRecord: UserSubscription = {
    id: subRecordRef.id,
    userId: user.uid,
    userName: user.displayName,
    userEmail: user.email,
    userPhone: user.phoneNumber,
    planName,
    fee: feePaid,
    durationDays,
    subscriberDeliveryFee,
    maxOrders,
    ordersRemaining: maxOrders,
    ordersUsed: 0,
    startDate: nowMs,
    expiresAt: expiresAtMs,
    status: 'pending_verification',
    paymentMethod: 'upi',
    upiTransactionId: upiTransactionId.trim(),
    submittedAt: nowMs,
    createdAt: serverTimestamp()
  };
  await setDoc(subRecordRef, subscriptionRecord);

  // 2. Mark user doc as pending verification
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      subscriptionPendingVerification: true,
      subscriptionPendingUtr: upiTransactionId.trim(),
      subscriptionPendingPlanName: planName,
      subscriptionPendingFee: feePaid,
      subscriptionStatus: 'pending_verification'
    });
  } catch (err) {
    console.warn('Could not update user doc with pending verification:', err);
  }
}

/**
 * Admin verifies and activates a pending subscription
 */
export async function verifyAndActivateSubscription({
  subscription,
  adminId
}: {
  subscription: UserSubscription;
  adminId?: string;
}): Promise<void> {
  const nowMs = Date.now();
  const durationDays = subscription.durationDays || 30;
  const expiresAtMs = nowMs + durationDays * 24 * 60 * 60 * 1000;

  // 1. Update user_subscriptions document
  if (subscription.id) {
    try {
      await updateDoc(doc(db, 'user_subscriptions', subscription.id), {
        status: 'active',
        startDate: nowMs,
        expiresAt: expiresAtMs,
        verifiedAt: serverTimestamp(),
        verifiedBy: adminId || 'admin'
      });
    } catch (e) {
      console.warn('Failed to update subscription doc:', e);
    }
  }

  // 2. Update user profile to grant VIP perks
  const userRef = doc(db, 'users', subscription.userId);
  await updateDoc(userRef, {
    isSubscribed: true,
    subscriptionPlanName: subscription.planName,
    subscriptionStartDate: nowMs,
    subscriptionExpiresAt: expiresAtMs,
    subscriptionOrdersRemaining: subscription.maxOrders,
    subscriptionOrdersTotal: subscription.maxOrders,
    subscriptionOrdersUsed: 0,
    subscriptionFeePaid: subscription.fee,
    subscriptionPendingVerification: false,
    subscriptionPendingUtr: '',
    subscriptionStatus: 'active'
  });
}

/**
 * Admin rejects a pending subscription verification
 */
export async function rejectSubscriptionRequest({
  subscriptionId,
  userId,
  reason = 'Payment not received or invalid UTR'
}: {
  subscriptionId: string;
  userId: string;
  reason?: string;
}): Promise<void> {
  // Update subscription document
  try {
    await updateDoc(doc(db, 'user_subscriptions', subscriptionId), {
      status: 'rejected',
      rejectionReason: reason
    });
  } catch (e) {
    console.warn('Failed to update subscription rejection:', e);
  }

  // Clear pending status on user
  try {
    await updateDoc(doc(db, 'users', userId), {
      subscriptionPendingVerification: false,
      subscriptionStatus: 'rejected'
    });
  } catch (e) {
    console.warn('Failed to clear user pending flag:', e);
  }
}

/**
 * Admin cancels an active user subscription
 */
export async function cancelUserSubscription({
  userId,
  subscriptionId,
  adminId,
  reason
}: {
  userId: string;
  subscriptionId?: string;
  adminId?: string;
  reason?: string;
}): Promise<void> {
  const nowMs = Date.now();

  // 1. Revoke VIP on user document immediately
  await updateDoc(doc(db, 'users', userId), {
    isSubscribed: false,
    subscriptionStatus: 'canceled',
    subscriptionCanceledAt: nowMs
  });

  // 2. Update subscription record if provided
  if (subscriptionId) {
    try {
      await updateDoc(doc(db, 'user_subscriptions', subscriptionId), {
        status: 'canceled',
        canceledAt: serverTimestamp(),
        canceledBy: adminId || 'admin',
        rejectionReason: reason || 'Cancelled by admin'
      });
    } catch (e) {
      console.warn('Failed to update canceled subscription doc:', e);
    }
  }
}

