/**
 * 30일 뒤 회고 알림.
 *
 * 네이티브에서는 Capacitor의 로컬 알림, 웹에서는 브라우저 알림을 쓴다.
 * 어느 쪽도 서버가 필요 없다 — FCM을 쓰지 않으므로 푸시 서버 비용이 0이다.
 * 권한이 없거나 플러그인이 없으면 조용히 실패하고, 회고는 홈 화면의 D-day 배지로 남는다.
 */

export type NotifyResult = 'scheduled' | 'denied' | 'unsupported'

interface LocalNotificationsPlugin {
  requestPermissions(): Promise<{ display: string }>
  schedule(options: {
    notifications: Array<{
      id: number
      title: string
      body: string
      schedule: { at: Date }
    }>
  }): Promise<unknown>
  cancel(options: { notifications: Array<{ id: number }> }): Promise<unknown>
}

function isNative(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return cap?.isNativePlatform?.() ?? false
}

/** 결정 id를 알림 id(32비트 정수)로 접는다. */
export function notificationId(decisionId: string): number {
  let hash = 0
  for (let i = 0; i < decisionId.length; i++) {
    hash = (hash * 31 + decisionId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 2_000_000_000
}

async function nativePlugin(): Promise<LocalNotificationsPlugin | null> {
  if (!isNative()) return null
  try {
    const mod = (await import('@capacitor/local-notifications')) as unknown as {
      LocalNotifications: LocalNotificationsPlugin
    }
    return mod.LocalNotifications
  } catch {
    return null
  }
}

export async function scheduleReview(
  decisionId: string,
  question: string,
  at: Date,
): Promise<NotifyResult> {
  const body = question.trim() === '' ? '그때 적어둔 결정을 다시 볼 시간이에요.' : question

  const plugin = await nativePlugin()
  if (plugin) {
    const permission = await plugin.requestPermissions()
    if (permission.display !== 'granted') return 'denied'
    await plugin.schedule({
      notifications: [
        { id: notificationId(decisionId), title: '한 달 전 그 결정, 지금은 어때요?', body, schedule: { at } },
      ],
    })
    return 'scheduled'
  }

  // 웹: 브라우저를 계속 열어둘 수는 없으므로 권한만 받아두고
  // 실제 안내는 홈 화면의 "회고 D-7" 배지가 맡는다.
  if (typeof Notification === 'undefined') return 'unsupported'
  const permission = await Notification.requestPermission()
  return permission === 'granted' ? 'scheduled' : 'denied'
}

export async function cancelReview(decisionId: string): Promise<void> {
  const plugin = await nativePlugin()
  if (!plugin) return
  try {
    await plugin.cancel({ notifications: [{ id: notificationId(decisionId) }] })
  } catch {
    // 예약된 게 없으면 그냥 지나간다.
  }
}
