import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lumaromart.app',
  appName: 'Lumaro Mart',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    AdMob: {
      // Google Official Sample AdMob App ID for Android testing
      appId: 'ca-app-pub-3940256099942544~3347511713'
    }
  }
};

export default config;
