import { describe, expect, it } from 'vitest'
import { notificationId } from './notify'

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
