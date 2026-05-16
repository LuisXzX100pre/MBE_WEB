import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mbemighty.app',
  appName: 'MBE',
  webDir: 'android-shell',
  server: {
    url: 'https://www.mbemighty.com.mx',
    cleartext: false,
  },
}

export default config