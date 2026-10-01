import { AppSettings } from '../types';

export interface LoyaltyConversionConfig {
  loyaltyProgramEnabled?: boolean;
  loyaltySpendBase?: number;          // e.g. every ₹100, ₹50, ₹200 spent
  loyaltyPointsEarned?: number;       // e.g. gives 5 points, 1 point, 10 points
  loyaltyPointsPerHundred?: number;   // legacy backwards compatibility fallback
  loyaltyPointValue?: number;         // e.g. 1 point = ₹1 discount
}

export interface PotentialEarningsDetail {
  pointsEarned: number;
  rupeeValue: number;
  spendBase: number;
  pointsPerBase: number;
  pointValue: number;
  amountToNextTier: number;
  pointsForNextTier: number;
  isEnabled: boolean;
  rateDescription: string;
}

/**
 * Calculates loyalty points earned based on order total/subtotal
 * and the dynamic conversion rate (Points per ₹).
 *
 * @param orderTotal - The order amount or subtotal in ₹
 * @param config - Dynamic conversion configuration from AppSettings or custom parameters
 * @returns Number of points earned (integer >= 0)
 */
export function calculatePointsEarned(
  orderTotal: number,
  config?: LoyaltyConversionConfig | AppSettings | null
): number {
  if (!orderTotal || orderTotal <= 0) return 0;
  
  const isEnabled = config?.loyaltyProgramEnabled ?? true;
  if (!isEnabled) return 0;

  const spendBase = Math.max(1, config?.loyaltySpendBase || 100);
  const pointsPerBase = typeof config?.loyaltyPointsEarned === 'number'
    ? config.loyaltyPointsEarned
    : (typeof config?.loyaltyPointsPerHundred === 'number' ? config.loyaltyPointsPerHundred : 5);

  if (pointsPerBase <= 0) return 0;

  return Math.floor(orderTotal / spendBase) * pointsPerBase;
}

/**
 * Calculates the monetary discount value in ₹ for a given number of loyalty points.
 *
 * @param points - Number of loyalty points
 * @param pointValue - Value in ₹ per point (default 1)
 * @returns Discount value in ₹
 */
export function calculatePointsRupeeValue(
  points: number,
  pointValue: number = 1
): number {
  if (!points || points <= 0) return 0;
  const val = typeof pointValue === 'number' && pointValue > 0 ? pointValue : 1;
  return Math.round(points * val);
}

/**
 * Comprehensive helper that returns full potential earnings details
 * for the cart summary screen, including points earned, monetary worth,
 * progress towards the next reward tier, and user-facing rate description.
 *
 * @param orderTotal - The order amount or subtotal in ₹
 * @param config - Dynamic conversion configuration
 */
export function getPotentialEarningsDetail(
  orderTotal: number,
  config?: LoyaltyConversionConfig | AppSettings | null
): PotentialEarningsDetail {
  const isEnabled = config?.loyaltyProgramEnabled ?? true;
  const spendBase = Math.max(1, config?.loyaltySpendBase || 100);
  const pointsPerBase = typeof config?.loyaltyPointsEarned === 'number'
    ? config.loyaltyPointsEarned
    : (typeof config?.loyaltyPointsPerHundred === 'number' ? config.loyaltyPointsPerHundred : 5);
  const pointValue = typeof config?.loyaltyPointValue === 'number' && config.loyaltyPointValue > 0
    ? config.loyaltyPointValue
    : 1;

  const safeTotal = Math.max(0, orderTotal || 0);

  if (!isEnabled || safeTotal <= 0) {
    return {
      pointsEarned: 0,
      rupeeValue: 0,
      spendBase,
      pointsPerBase,
      pointValue,
      amountToNextTier: spendBase,
      pointsForNextTier: pointsPerBase,
      isEnabled,
      rateDescription: spendBase === 100 
        ? `Earn ${pointsPerBase}% points on every order above ₹${spendBase}`
        : `Earn ${pointsPerBase} pts for every ₹${spendBase} spent`
    };
  }

  const pointsEarned = Math.floor(safeTotal / spendBase) * pointsPerBase;
  const rupeeValue = Math.round(pointsEarned * pointValue);

  const remainder = safeTotal % spendBase;
  const amountToNextTier = remainder === 0 ? spendBase : (spendBase - remainder);

  const rateDescription = spendBase === 100
    ? `Earn ${pointsPerBase}% points on every order above ₹${spendBase}`
    : `Earn ${pointsPerBase} point${pointsPerBase === 1 ? '' : 's'} for every ₹${spendBase} spent`;

  return {
    pointsEarned,
    rupeeValue,
    spendBase,
    pointsPerBase,
    pointValue,
    amountToNextTier,
    pointsForNextTier: pointsPerBase,
    isEnabled,
    rateDescription
  };
}
