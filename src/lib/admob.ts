import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdOptions,
  BannerAdSize,
  BannerAdPosition,
  AdmobConsentStatus,
  RewardAdOptions,
  AdOptions,
  RewardAdPluginEvents
} from '@capacitor-community/admob';

// Google Official Android Test Ad Unit IDs (guaranteed to work safely without account bans)
export const ADMOB_TEST_IDS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917'
};

export interface AdMobSettings {
  enabled: boolean;
  isTesting: boolean;
  appId?: string;
  bannerId?: string;
  interstitialId?: string;
  rewardedId?: string;
}

let isInitialized = false;
let isBannerActive = false;

/**
 * Initialize AdMob SDK. Safe on both Web and Native Android.
 */
export async function initializeAdMob(customSettings?: Partial<AdMobSettings>): Promise<boolean> {
  if (isInitialized) return true;

  if (!Capacitor.isNativePlatform()) {
    console.log('[AdMob] Running on Web/Preview mode. Native AdMob calls are safely emulated.');
    isInitialized = true;
    return true;
  }

  try {
    await AdMob.initialize({
      testingDevices: ['EMULATOR'],
      initializeForTesting: customSettings?.isTesting !== false
    });
    isInitialized = true;
    console.log('[AdMob] Native AdMob initialized successfully');
    return true;
  } catch (error) {
    console.warn('[AdMob] Failed to initialize native AdMob:', error);
    return false;
  }
}

/**
 * Show a sticky Banner Ad at the bottom of the screen.
 */
export async function showBannerAd(customId?: string, isTesting = true): Promise<boolean> {
  const adId = customId && !isTesting ? customId : ADMOB_TEST_IDS.banner;

  if (!Capacitor.isNativePlatform()) {
    console.log(`[AdMob Emulated] Showing Banner Ad with Unit ID: ${adId}`);
    isBannerActive = true;
    return true;
  }

  try {
    await initializeAdMob({ isTesting });

    const options: BannerAdOptions = {
      adId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting
    };

    await AdMob.showBanner(options);
    isBannerActive = true;
    return true;
  } catch (error) {
    console.warn('[AdMob] Error showing banner ad:', error);
    return false;
  }
}

/**
 * Hide or remove the active Banner Ad.
 */
export async function hideBannerAd(): Promise<boolean> {
  if (!isBannerActive) return true;

  if (!Capacitor.isNativePlatform()) {
    console.log('[AdMob Emulated] Hiding Banner Ad');
    isBannerActive = false;
    return true;
  }

  try {
    await AdMob.hideBanner();
    await AdMob.removeBanner();
    isBannerActive = false;
    return true;
  } catch (error) {
    console.warn('[AdMob] Error hiding banner ad:', error);
    return false;
  }
}

/**
 * Show a Full-Screen Interstitial Ad (e.g. after order placed).
 */
export async function showInterstitialAd(customId?: string, isTesting = true): Promise<boolean> {
  const adId = customId && !isTesting ? customId : ADMOB_TEST_IDS.interstitial;

  if (!Capacitor.isNativePlatform()) {
    console.log(`[AdMob Emulated] Showing Interstitial Ad with Unit ID: ${adId}`);
    return true;
  }

  try {
    await initializeAdMob({ isTesting });

    const options: AdOptions = {
      adId,
      isTesting
    };

    await AdMob.prepareInterstitial(options);
    await AdMob.showInterstitial();
    return true;
  } catch (error) {
    console.warn('[AdMob] Error displaying interstitial ad:', error);
    return false;
  }
}

/**
 * Show a Rewarded Video Ad (e.g., watch ad to get extra ₹10 discount or free shipping).
 */
export async function showRewardedAd(
  onRewardEarned: (reward: { type: string; amount: number }) => void,
  customId?: string,
  isTesting = true
): Promise<boolean> {
  const adId = customId && !isTesting ? customId : ADMOB_TEST_IDS.rewarded;

  if (!Capacitor.isNativePlatform()) {
    console.log(`[AdMob Emulated] Rewarded video ad completed! Reward granted.`);
    // Emulate reward callback on web
    onRewardEarned({ type: 'Discount Coins', amount: 10 });
    return true;
  }

  try {
    await initializeAdMob({ isTesting });

    const options: RewardAdOptions = {
      adId,
      isTesting
    };

    // Listen for reward event
    const rewardListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
      console.log('[AdMob] Reward granted:', reward);
      onRewardEarned({ type: reward.type || 'Coins', amount: reward.amount || 10 });
    });

    await AdMob.prepareRewardVideoAd(options);
    await AdMob.showRewardVideoAd();

    // Clean up listener after delay
    setTimeout(() => {
      rewardListener.remove();
    }, 60000);

    return true;
  } catch (error) {
    console.warn('[AdMob] Error showing rewarded ad:', error);
    return false;
  }
}
