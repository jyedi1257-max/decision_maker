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
          // 동기화를 켜기 전에는 firebase 청크가 로드되지 않게 분리한다.
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase'
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
