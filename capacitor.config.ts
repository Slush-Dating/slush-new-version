import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.slush.app',
  appName: 'Slush',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;


