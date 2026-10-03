import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ProductVariant } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
};

/**
 * Parses weight or volume string (e.g. "100g", "250gm", "1kg", "500ml", "1L", "2 pcs")
 * into a standardized numerical value (grams/ml) for ascending sort comparison.
 */
export function parseWeightToGrams(rawStr: string): number {
  if (!rawStr) return 0;
  const str = rawStr.toLowerCase().trim().replace(/,/g, '');

  // 1. Kilograms / Kilos (1kg = 1000g)
  const kgMatch = str.match(/([\d.]+)\s*(kg|kgs|kilo|kilogram|kilograms)/i);
  if (kgMatch) {
    const val = parseFloat(kgMatch[1]);
    if (!isNaN(val)) return val * 1000;
  }

  // 2. Liters / Litres (1L = 1000ml)
  const lMatch = str.match(/([\d.]+)\s*(l|lt|ltr|liter|litre|liters|litres)/i);
  if (lMatch) {
    const val = parseFloat(lMatch[1]);
    if (!isNaN(val)) return val * 1000;
  }

  // 3. Milliliters (1ml = 1g scale)
  const mlMatch = str.match(/([\d.]+)\s*(ml|milliliter|millilitre)/i);
  if (mlMatch) {
    const val = parseFloat(mlMatch[1]);
    if (!isNaN(val)) return val;
  }

  // 4. Milligrams (1mg = 0.001g)
  const mgMatch = str.match(/([\d.]+)\s*(mg|milligram)/i);
  if (mgMatch) {
    const val = parseFloat(mgMatch[1]);
    if (!isNaN(val)) return val / 1000;
  }

  // 5. Grams (1g)
  const gMatch = str.match(/([\d.]+)\s*(g|gm|gms|gram|grams)/i);
  if (gMatch) {
    const val = parseFloat(gMatch[1]);
    if (!isNaN(val)) return val;
  }

  // 6. Pieces / Packs (e.g. 1 pc, 2 pcs, 6 pcs)
  const pcMatch = str.match(/([\d.]+)\s*(pc|pcs|piece|pieces|pack|pkt|packet|packets|unit|units)/i);
  if (pcMatch) {
    const val = parseFloat(pcMatch[1]);
    if (!isNaN(val)) return val * 100;
  }

  // 7. Plain number (e.g. "500")
  const numMatch = str.match(/([\d.]+)/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    if (!isNaN(val)) return val;
  }

  return 0;
}

/**
 * Sorts an array of ProductVariant objects strictly in ascending order of their weight/size.
 * E.g. 50g -> 100g -> 250g -> 500g -> 1kg -> 2kg -> 5kg -> 10kg
 */
export function sortVariantsByWeight(variants: ProductVariant[]): ProductVariant[] {
  if (!variants || !Array.isArray(variants)) return [];
  return [...variants].sort((a, b) => {
    const weightA = parseWeightToGrams(a.weight);
    const weightB = parseWeightToGrams(b.weight);
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    // If weights evaluate to the same value or both are 0, sort by price ascending
    return (Number(a.price) || 0) - (Number(b.price) || 0);
  });
}
