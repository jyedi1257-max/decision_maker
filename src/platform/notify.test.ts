import { afterEach, describe, expect, it, vi } from 'vitest'
import { notificationId, scheduleReview } from './notify'

describe('scheduleReview', () => {
  afterEach(() => {
    vi.doUnmock('@capacitor/local-notifications')
    delete (globalThis as { Capacitor?: unknown }).Capacitor
  })

  it('플러그인이 던져도 호출한 쪽으로 예외를 넘기지 않는다', async () => {
    ;(globalThis as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true }
    vi.doMock('@capacitor/local-notifications', () => ({
      LocalNotifications: {
        requestPermissions: async () => ({ display: 'granted' }),
        schedule: async () => {
          throw new Error('exact alarm not permitted')
        },
        cancel: async () => undefined,
      },
    }))
    await expect(scheduleReview('d1', '이사 갈까', new Date())).resolves.toBe('unsupported')
  })
})

describe('notificationId', () => {
  it('같은 결정은 같은 알림 id를 쓴다', () => {
    expect(notificationId('abc-123')).toBe(notificationId('abc-123'))
  })
  it('다른 결정은 다른 id로 갈린다', () => {
    expect(notificationId('abc-123')).not.toBe(notificationId('abc-124'))
  })
  it('안드로이드가 받는 32비트 양수 범위 안이다', () => {
    for (const id of ['a', crypto.randomUUID(), '한글 아이디', '']) {
      const n = notificationId(id)
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(2_147_483_647)
    }
  })
})
