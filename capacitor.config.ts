import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'kr.decisionnote.app',
  appName: '결정 노트',
  webDir: 'dist',
  // 종이 바깥 책상색(--desk)을 네이티브 셸 배경에도 그대로 쓴다.
  backgroundColor: '#EFECE5',
  android: {
    backgroundColor: '#EFECE5',
  },
  ios: {
    backgroundColor: '#EFECE5',
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#EFECE5',
      showSpinner: false,
      launchAutoHide: true,
      launchShowDuration: 300,
    },
    LocalNotifications: {
      // 전용 상태바 아이콘을 아직 그리지 않아 앱 아이콘을 그대로 쓴다.
      iconColor: '#B3402B',
    },
  },
}

export default config
