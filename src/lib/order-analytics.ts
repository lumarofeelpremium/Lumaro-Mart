import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  writeBatch, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../types';

export interface ProductOrderStat {
  productId: string;
  productName: string;
  totalQuantity: number;
  orderCount: number;
  totalRevenue: number;
}

export interface DailyOrderAnalyticsSummary {
  lastAnalyzedAt?: any;
  analyzedDate: string; // YYYY-MM-DD
  totalOrdersChecked: number;
  totalProductsUpdated: number;
  topProducts: ProductOrderStat[];
  status: 'completed' | 'in_progress' | 'error';
}

const LOCAL_STORAGE_DATE_KEY = 'lumaro_last_order_analysis_date';
const LOCAL_STORAGE_TIME_KEY = 'lumaro_last_order_analysis_time';
const LOCAL_STORAGE_SUMMARY_KEY = 'lumaro_order_analytics_summary';

/**
 * Runs a complete aggregation of all customer orders to calculate
 * exact quantities ordered for every product, then updates product salesCount
 * in Firestore and saves a daily analytics summary.
 * 
 * @param force If true, bypasses the 24-hour check and analyzes immediately.
 */
export async function runDailyOrderSalesAnalysis(force: boolean = false): Promise<{
  success: boolean;
  message: string;
  topProducts: ProductOrderStat[];
  totalOrdersChecked: number;
  totalProductsUpdated: number;
  lastAnalyzedDate: string;
}> {
  const todayStr = new Date().toISOString().split('T')[0];
  const lastAnalyzedDate = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_DATE_KEY) : null;
  const lastAnalyzedTime = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(LOCAL_STORAGE_TIME_KEY) || '0') : 0;
  const now = Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  // If not forced and already analyzed today or within 24 hours, read cached summary
  if (!force && lastAnalyzedDate === todayStr && (now - lastAnalyzedTime) < TWENTY_FOUR_HOURS_MS) {
    const cached = getCachedOrderAnalyticsSummary();
    if (cached) {
      return {
        success: true,
        message: 'Already analyzed today. Using cached daily order stats.',
        topProducts: cached.topProducts || [],
        totalOrdersChecked: cached.totalOrdersChecked || 0,
        totalProductsUpdated: cached.totalProductsUpdated || 0,
        lastAnalyzedDate: cached.analyzedDate || todayStr
      };
    }
  }

  try {
    console.log('[OrderAnalytics] Starting Daily Order Sales Analysis...');

    // 1. Fetch orders from Firestore (excluding canceled orders)
    const ordersSnap = await getDocs(collection(db, 'orders'));
    const orderStatsMap = new Map<string, ProductOrderStat>();
    let validOrdersCount = 0;

    ordersSnap.forEach((orderDoc) => {
      const orderData = orderDoc.data();
      const status = (orderData.status || '').toLowerCase();
      // Skip canceled / rejected orders so only real customer demand is counted
      if (status === 'canceled' || status === 'cancelled' || status === 'rejected') {
        return;
      }

      validOrdersCount++;
      const items = Array.isArray(orderData.items) ? orderData.items : [];

      items.forEach((item: any) => {
        const rawId = item.productId || item.id || '';
        // In cart/orders, compound IDs might be "prodId_weight"
        const productId = String(rawId).split('_')[0].trim();
        if (!productId) return;

        const quantity = Number(item.quantity) || 1;
        const price = Number(item.price || item.discountPrice) || 0;
        const name = item.name || item.title || 'Product';

        const existing = orderStatsMap.get(productId);
        if (existing) {
          existing.totalQuantity += quantity;
          existing.orderCount += 1;
          existing.totalRevenue += price * quantity;
          if (name && existing.productName === 'Product') {
            existing.productName = name;
          }
        } else {
          orderStatsMap.set(productId, {
            productId,
            productName: name,
            totalQuantity: quantity,
            orderCount: 1,
            totalRevenue: price * quantity
          });
        }
      });
    });

    // 2. Fetch all current products to verify and update salesCount
    const productsSnap = await getDocs(collection(db, 'products'));
    const currentProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));

    let updatedProductsCount = 0;
    const batchList: any[] = [];
    let currentBatch = writeBatch(db);
    let currentBatchOps = 0;

    currentProducts.forEach((product) => {
      const stats = orderStatsMap.get(product.id);
      const accurateSalesCount = stats ? stats.totalQuantity : 0;

      // Also ensure product name in stats matches actual product title
      if (stats && product.name) {
        stats.productName = product.name;
      }

      // If product salesCount is outdated or missing, queue an update
      if (product.salesCount !== accurateSalesCount) {
        currentBatch.update(doc(db, 'products', product.id), {
          salesCount: accurateSalesCount
        });
        currentBatchOps++;
        updatedProductsCount++;

        if (currentBatchOps >= 400) {
          batchList.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          currentBatchOps = 0;
        }
      }
    });

    if (currentBatchOps > 0) {
      batchList.push(currentBatch.commit());
    }

    if (batchList.length > 0) {
      await Promise.all(batchList);
    }

    // 3. Compute Top Ordered Products in descending order (Decreasing / Ghatte Kram)
    const sortedStats = Array.from(orderStatsMap.values()).sort((a, b) => {
      if (b.totalQuantity !== a.totalQuantity) {
        return b.totalQuantity - a.totalQuantity; // Sabse zyada order kiya gaya aage
      }
      return b.orderCount - a.orderCount;
    });

    const topProducts = sortedStats.slice(0, 20);

    // 4. Save daily analytics report to Firestore for app-wide & admin visibility
    const analyticsSummary: DailyOrderAnalyticsSummary = {
      analyzedDate: todayStr,
      totalOrdersChecked: validOrdersCount,
      totalProductsUpdated: updatedProductsCount,
      topProducts,
      status: 'completed'
    };

    try {
      await setDoc(doc(db, 'settings', 'daily_order_analytics'), {
        ...analyticsSummary,
        lastAnalyzedAt: serverTimestamp()
      }, { merge: true });
    } catch (saveErr) {
      console.warn('[OrderAnalytics] Warning saving daily summary to Firestore:', saveErr);
    }

    // 5. Update local storage timestamp
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_DATE_KEY, todayStr);
      localStorage.setItem(LOCAL_STORAGE_TIME_KEY, String(now));
      localStorage.setItem(LOCAL_STORAGE_SUMMARY_KEY, JSON.stringify(analyticsSummary));
    }

    console.log(`[OrderAnalytics] Daily Analysis Completed: ${validOrdersCount} orders checked, ${updatedProductsCount} products updated.`);

    return {
      success: true,
      message: `Daily order analysis completed! ${validOrdersCount} orders analyzed, ${topProducts.length} top products ranked.`,
      topProducts,
      totalOrdersChecked: validOrdersCount,
      totalProductsUpdated: updatedProductsCount,
      lastAnalyzedDate: todayStr
    };
  } catch (error: any) {
    console.error('[OrderAnalytics] Error during daily order analysis:', error);
    return {
      success: false,
      message: error?.message || 'Failed to analyze orders',
      topProducts: [],
      totalOrdersChecked: 0,
      totalProductsUpdated: 0,
      lastAnalyzedDate: todayStr
    };
  }
}

/**
 * Lightweight check executed in background once per day.
 * Ensures the order statistics stay fresh automatically without blocking the UI.
 */
export function checkAndTriggerDailyAnalysis(): void {
  if (typeof window === 'undefined') return;

  const todayStr = new Date().toISOString().split('T')[0];
  const lastDate = localStorage.getItem(LOCAL_STORAGE_DATE_KEY);

  // If not analyzed today, trigger in the background after a slight delay
  if (lastDate !== todayStr) {
    setTimeout(() => {
      runDailyOrderSalesAnalysis(false).catch(e => {
        console.warn('[OrderAnalytics] Background daily analysis run error:', e);
      });
    }, 4000); // 4 seconds delay to let critical UI render first
  }
}

/**
 * Returns the cached analytics summary from localStorage if available.
 */
export function getCachedOrderAnalyticsSummary(): DailyOrderAnalyticsSummary | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SUMMARY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyOrderAnalyticsSummary;
  } catch {
    return null;
  }
}

/**
 * Fetches the daily order analytics summary document from Firestore.
 */
export async function fetchFirestoreOrderAnalyticsSummary(): Promise<DailyOrderAnalyticsSummary | null> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'daily_order_analytics'));
    if (snap.exists()) {
      return snap.data() as DailyOrderAnalyticsSummary;
    }
  } catch (err) {
    console.warn('[OrderAnalytics] Error fetching Firestore daily summary:', err);
  }
  return getCachedOrderAnalyticsSummary();
}
