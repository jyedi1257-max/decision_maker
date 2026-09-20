/**
 * 매트릭스 화면의 소리.
 *
 * 음원 파일을 쓰지 않는다 — 전부 웹 오디오 API로 합성한다. 파일이 없으니
 * 용량이 안 붙고, 오프라인에서 로딩에 실패할 일도 없고, 펜이 움직이는
 * 시간에 맞춰 사각거림 길이를 그때그때 맞출 수 있다. 네이티브로 감싸도
 * 같은 코드가 그대로 돈다 (Capacitor의 WebView가 웹 오디오를 그대로 준다).
 *
 * 소리를 켤지는 사용자가 정한다. 선택은 localStorage에 남겨서, 한 번 끄면
 * 다음 결정에서 다시 소리가 나지 않는다.
 */

const PREF_KEY = 'decision-note:sound'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let stopMusic: (() => void) | null = null

/** 껐다 켠 기록이 없으면 켜진 채로 시작한다. */
export function soundPreference(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off'
  } catch {
    // 시크릿 모드 등에서 접근이 막힐 수 있다. 그때는 기본값으로 간다.
    return true
  }
}

function rememberPreference(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off')
  } catch {
    /* 못 적어도 이번 화면은 그대로 돈다 */
  }
}

function ensure(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  try {
    ctx = new AC()
  } catch {
    // 오디오 장치가 없는 환경도 있다. 그래도 표는 그려져야 한다.
    return null
  }
  master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)

  // 사각거림의 재료 — 2초짜리 잡음 한 조각을 돌려 쓴다
  const n = ctx.sampleRate * 2
  noise = ctx.createBuffer(1, n, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

/** 만년필이 종이를 긁는 소리. 받은 길이만큼 이어진다. */
function scratch(seconds: number): void {
  if (!ctx || !master || !noise) return
  const t = ctx.currentTime
  const dur = Math.max(0.09, Math.min(seconds, 1.6))

  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  src.playbackRate.value = 0.8 + Math.random() * 0.4

  // 종이 결 — 좁은 대역만 남겨야 '쉬익'이 아니라 '사각'이 된다
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1500 + Math.random() * 700
  band.Q.value = 0.9

  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 700

  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.055, t + 0.02)
  // 결이 고르지 않게 — 사람 손의 떨림
  const steps = Math.max(2, Math.round(dur / 0.045))
  for (let i = 1; i < steps; i++) {
    g.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.045, t + (dur * i) / steps)
  }
  g.gain.linearRampToValueAtTime(0, t + dur)

  src.connect(band).connect(hp).connect(g).connect(master)
  src.start(t)
  src.stop(t + dur + 0.05)
}

/** 색연필로 동그라미 한 바퀴 — 사각거림보다 굵고 경쾌하게. */
function circle(seconds: number): void {
  if (!ctx || !master || !noise) return
  const t = ctx.currentTime
  const dur = Math.max(0.2, Math.min(seconds, 1.2))

  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  src.playbackRate.value = 0.65

  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.value = 1.6
  band.frequency.setValueAtTime(700, t)
  band.frequency.linearRampToValueAtTime(1900, t + dur * 0.6)
  band.frequency.linearRampToValueAtTime(900, t + dur)

  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.085, t + 0.05)
  g.gain.setValueAtTime(0.085, t + dur * 0.75)
  g.gain.linearRampToValueAtTime(0, t + dur)

  src.connect(band).connect(g).connect(master)
  src.start(t)
  src.stop(t + dur + 0.05)

  // 마지막에 톡 — 동그라미가 닫히는 순간
  const o = ctx.createOscillator()
  const og = ctx.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(520, t + dur - 0.04)
  o.frequency.exponentialRampToValueAtTime(300, t + dur + 0.1)
  og.gain.setValueAtTime(0.05, t + dur - 0.04)
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12)
  o.connect(og).connect(master)
  o.start(t + dur - 0.04)
  o.stop(t + dur + 0.15)
}

/**
 * 배경 — 3화음이 5초마다 규칙적으로 바뀐다.
 *
 * 디튠은 0이다. 두 음을 몇 센트 어긋나게 하면 맥놀이가 생기고, 빈 5도를
 * 길게 깔면 공허해지고, 다음 음을 난수로 뽑으면 예측이 안 된다 — 공포
 * 음악이 쓰는 방법 셋이다. 셋 다 쓰지 않는다.
 */
const CHORDS = [
  [261.63, 329.63, 392.0], // C
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [196.0, 246.94, 293.66], // G
]
const CHORD_HOLD = 5.0
const CHORD_FADE = 1.6

function startChords(): () => void {
  if (!ctx || !master) return () => {}
  const audio = ctx
  const bus = audio.createGain()
  bus.gain.value = 0
  bus.gain.linearRampToValueAtTime(0.5, audio.currentTime + 1.4)
  const lp = audio.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  lp.Q.value = 0.4
  lp.connect(bus)
  bus.connect(master)

  let i = 0
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const play = () => {
    if (stopped) return
    const t = audio.currentTime
    for (const freq of CHORDS[i % CHORDS.length] ?? []) {
      const o = audio.createOscillator()
      const g = audio.createGain()
      o.type = 'triangle'
      o.frequency.value = freq
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.042, t + CHORD_FADE)
      g.gain.setValueAtTime(0.042, t + CHORD_HOLD)
      g.gain.linearRampToValueAtTime(0, t + CHORD_HOLD + CHORD_FADE)
      o.connect(g).connect(lp)
      o.start(t)
      o.stop(t + CHORD_HOLD + CHORD_FADE + 0.1)
    }
    i++
    timer = setTimeout(play, CHORD_HOLD * 1000)
  }
  play()

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
    bus.gain.linearRampToValueAtTime(0, audio.currentTime + 0.5)
  }
}

export interface PenSound {
  scratch(seconds: number): void
  circle(seconds: number): void
}

/** 소리를 내지 않는 자리채움. 꺼져 있을 때 화면 쪽 코드가 분기하지 않게 한다. */
const SILENT: PenSound = { scratch: () => {}, circle: () => {} }

let live = false

export const sound = {
  get on(): boolean {
    return live
  },

  /**
   * 켠다. 브라우저는 손가락이 한 번 닿기 전에는 소리를 내주지 않는데,
   * 확정 화면의 "기록하고 나가기"를 누른 그 손길이 같은 문서 안에서
   * 그 역할을 한다 (SPA라 페이지가 새로 뜨지 않는다).
   */
  async enable(): Promise<boolean> {
    if (!ensure() || !ctx) return false
    try {
      if (ctx.state === 'suspended') await ctx.resume()
    } catch {
      /* 못 깨워도 화면은 돈다 */
    }
    live = true
    rememberPreference(true)
    if (!stopMusic) stopMusic = startChords()
    return true
  },

  disable(): void {
    live = false
    rememberPreference(false)
    if (stopMusic) stopMusic()
    stopMusic = null
  },

  /** 화면을 떠날 때. 선택은 그대로 두고 소리만 멈춘다. */
  silence(): void {
    live = false
    if (stopMusic) stopMusic()
    stopMusic = null
  },

  effects(): PenSound {
    return live ? { scratch, circle } : SILENT
  },
}
