import { Product } from '../types';

export interface MultiQuantitySavingsInfo {
  hasSavings: boolean;
  quantity: number;
  savingsAmount: number;
  costForQty: number;
  mrpForQty: number;
  unitPrice: number;
  unitSaving: number;
  percentSaved: number;
  badgeText: string;
  badgeHeadline: string;
  tierList: {
    quantity: number;
    totalPrice: number;
    savings: number;
    unitPrice: number;
    isRecommended?: boolean;
  }[];
}

/**
 * Calculates potential savings when a user adds multiple quantities of a product to their cart.
 */
export function getMultiQuantitySavings(product: Product, targetQty?: number): MultiQuantitySavingsInfo | null {
  if (!product || (product.stock !== undefined && product.stock < 2)) {
    return null;
  }

  const mrp = Number(product.price) || 0;
  const unitSellingPrice = Number(product.discountPrice) && Number(product.discountPrice) < mrp
    ? Number(product.discountPrice)
    : mrp;

  const defaultQty = product.bulkDiscountQty && product.stock >= product.bulkDiscountQty
    ? product.bulkDiscountQty
    : 2;

  const qty = targetQty && targetQty >= 2
    ? Math.min(targetQty, product.stock || targetQty)
    : defaultQty;

  const mrpForQty = mrp * qty;

  let costForQty = 0;
  let savingsAmount = 0;

  // 1. Explicit Bulk Discount Price if configured on product
  if (product.bulkDiscountQty && product.bulkDiscountPrice && qty >= product.bulkDiscountQty) {
    costForQty = product.bulkDiscountPrice * (qty / product.bulkDiscountQty);
    savingsAmount = Math.max(0, mrpForQty - costForQty);
  }
  // 2. Standard MRP Discount scaled by quantity
  else if (product.discountPrice && product.discountPrice < mrp) {
    costForQty = product.discountPrice * qty;
    savingsAmount = Math.max(0, (mrp - product.discountPrice) * qty);
  }

  if (savingsAmount <= 0) {
    return null;
  }

  const unitSaving = mrp - unitSellingPrice;
  const percentSaved = mrpForQty > 0 ? Math.round((savingsAmount / mrpForQty) * 100) : 0;

  // Build tier recommendations for 2, 3 (and 4 if in stock)
  const maxTier = Math.min(product.stock || 4, 4);
  const tierList = [];
  for (let q = 2; q <= maxTier; q++) {
    const tierMrp = mrp * q;
    let tierCost = unitSellingPrice * q;
    if (product.bulkDiscountQty && product.bulkDiscountPrice && q >= product.bulkDiscountQty) {
      tierCost = product.bulkDiscountPrice * (q / product.bulkDiscountQty);
    }
    const tierSavings = Math.max(0, tierMrp - tierCost);
    if (tierSavings > 0) {
      tierList.push({
        quantity: q,
        totalPrice: tierCost,
        savings: tierSavings,
        unitPrice: Math.round(tierCost / q),
        isRecommended: q === 2 || q === product.bulkDiscountQty,
      });
    }
  }

  return {
    hasSavings: true,
    quantity: qty,
    savingsAmount,
    costForQty,
    mrpForQty,
    unitPrice: unitSellingPrice,
    unitSaving,
    percentSaved,
    badgeText: `Save ₹${savingsAmount} on ${qty}`,
    badgeHeadline: `Buy ${qty} • Save ₹${savingsAmount}`,
    tierList,
  };
}
