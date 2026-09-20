import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // 네이티브 셸에서도 그대로 서빙되도록 상대 경로 자산을 쓴다.
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          // 동기화를 켜기 전에는 firebase가 로드조차 되지 않아야 한다.
          // 셋으로 나누는 건 용량 때문이 아니라 — 어차피 같이 로드된다 —
          // 한 덩이가 500KB를 넘어 경고가 상시로 켜져 있으면 진짜 회귀를
          // 못 알아보기 때문이다.
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) {
            return 'firebase-firestore'
          }
          if (id.includes('@firebase/auth') || id.includes('firebase/auth')) {
            return 'firebase-auth'
          }
          if (id.includes('@firebase') || id.includes('firebase')) return 'firebase-app'

          // React는 거의 안 바뀐다. 따로 떼면 앱 코드만 고쳐 배포했을 때
          // 사용자 브라우저가 이 덩이를 다시 받지 않는다.
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react'
          }
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
