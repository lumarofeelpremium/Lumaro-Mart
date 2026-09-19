import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { showBannerAd, hideBannerAd } from '../lib/admob';

interface AdMobBannerProps {
  customBannerId?: string;
  isTesting?: boolean;
  enabled?: boolean;
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  customBannerId,
  isTesting = true,
  enabled = true
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!enabled || isDismissed) {
      hideBannerAd();
      return;
    }

    if (isNative) {
      showBannerAd(customBannerId, isTesting);
    }

    return () => {
      if (isNative) {
        hideBannerAd();
      }
    };
  }, [enabled, isDismissed, customBannerId, isTesting, isNative]);

  if (!enabled || isDismissed) return null;

  // On Web preview, display a subtle non-intrusive AdMob banner simulation for testing
  if (!isNative) {
    return (
      <aside 
        aria-label="Sponsored advertisement"
        className="w-full max-w-md mx-auto px-4 py-2 mt-4"
      >
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl p-2.5 shadow-xs flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <span className="bg-amber-600 text-white font-bold px-1.5 py-0.5 rounded text-[10px] tracking-wider uppercase">
              Ad
            </span>
            <div>
              <p className="font-semibold text-gray-800">Google AdMob Banner Preview</p>
              <p className="text-[11px] text-gray-500">Active in official Android APK/AAB build</p>
            </div>
          </div>
          <button
            onClick={() => setIsDismissed(true)}
            className="text-gray-400 hover:text-gray-600 p-1 text-xs font-semibold"
            title="Dismiss Preview"
          >
            ✕
          </button>
        </div>
      </aside>
    );
  }

  return null;
};
