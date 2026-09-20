/**
 * 만년필이 결정 매트릭스를 써 내려가는 장면.
 *
 * 표가 한 화면에 안 들어오는 문제를 **시간축으로** 푼다. 다 그려진 표를
 * 들이미는 대신, 쓰는 동안은 그 부분으로 확대해 붙어 있다가 마지막에만
 * 물러난다. 전체가 보일 땐 이미 한 칸씩 다 읽은 상태다.
 *
 * 결과 화면 **앞에** 오는 화면이라 적합도는 그리지 않는다. 사용자가 적은
 * 점수와 기준별 최고점까지만 보여주고, "그래서 어느 쪽이 더 맞는가"는
 * 다음 화면이 말한다. 여기서 막대를 띄우면 결과를 미리 말해버린다.
 *
 * 디자인 §9의 "진입 모션 900ms"를 넘긴다. 그 규칙은 화면이 뜰 때마다
 * 반복되는 모션을 겨냥한 것이고 이건 결정당 한 번만 보는 장면이라
 * 다른 종류로 본다. 대신 건너뛰기를 항상 띄우고, 모션을 줄이는 설정이
 * 켜져 있으면 아예 그리지 않고 완성된 표만 보여준다.
 *
 * React도 저장소도 모른다 — SVG 엘리먼트 하나와 값만 받는다.
 */
import type { PenSound } from '@/platform/sound'

const NS = 'http://www.w3.org/2000/svg'
/** 손글씨 서브셋. 숫자·①②③·%·적합도 라벨만 담겨 있다 (ink-phrases.ts). */
const INK = 'var(--font-ink)'
const BODY = 'var(--font-title)'

export interface MatrixAlternative {
  /** ①②③ */
  mark: string
  name: string
  /** 이 선택지의 고유색 (--alt-n) */
  color: string
}

export interface MatrixCriterion {
  name: string
  /** "61%" */
  percent: string
}

export interface MatrixData {
  alternatives: MatrixAlternative[]
  criteria: MatrixCriterion[]
  /** [기준][선택지]. 비워둔 칸은 null */
  scores: (number | null)[][]
  /** 기준마다 가장 높은 점수의 선택지. 동점이거나 전부 비었으면 -1 */
  winners: number[]
}

export interface SceneHandle {
  play(): void
  /** 그리지 않고 끝 상태만 찍는다 */
  finish(): void
  destroy(): void
  /** 자리가 모자라 이름을 줄인 쪽 — 화면이 범례를 붙일지 정한다 */
  readonly truncated: { alternatives: boolean; criteria: boolean }
}

// ── 자리 ──────────────────────────────────────────────────────
const VW = 342
const GRID_L = 104 // 세로축
const GRID_R = 332
const GRID_T = 92 // 가로축
const LABEL_R = 96 // 기준 이름이 끝나는 자리
const LABEL_L = 14

/** 고르기 페이지에서 정한 값 — A 흑단·금장, 47도. */
const PEN_ANGLE = 47
const PEN_SCALE = 1.7
const PEN_SHAPE = `
  <path d="M -5.4 -38 C -7.4 -84 -7.6 -164 -3 -210 L 3 -210 C 7.6 -164 7.4 -84 5.4 -38 Z" style="fill:#1F332C"/>
  <path d="M -3.1 -46 C -4.5 -86 -4.7 -152 -2.2 -196" style="fill:none;stroke:#ffffff;stroke-width:1.9;opacity:.13"/>
  <rect x="-5.6" y="-42" width="11.2" height="4.4" style="fill:#C2A059"/>
  <rect x="-5.5" y="-47" width="11" height="1.6" style="fill:#C2A059;opacity:.55"/>
  <path d="M -5 -38 Q -5.5 -28 -4.3 -21 L 4.3 -21 Q 5.5 -28 5 -38 Z" style="fill:#1F332C"/>
  <path d="M -4 -21 Q 0 -24.5 4 -21 L 0 0 Z" style="fill:#C2A059"/>
  <path d="M -4 -21 Q 0 -24.5 4 -21 L 0 0 Z" style="fill:none;stroke:#8E7338;stroke-width:.5"/>
  <circle cx="0" cy="-15.6" r="1.5" style="fill:#8E7338"/>
  <path d="M 0 -13 L 0 -1.6" style="stroke:#8E7338;stroke-width:.8"/>`

/* fill="var(--ink)" 같은 표현 속성은 브라우저마다 var()를 안 풀어준다.
   CSS 속성으로 가는 키는 style에 직접 건다. */
const STYLED = new Set([
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'text-anchor',
])

type Attrs = Record<string, string | number>

function mk<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Attrs,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, name)
  for (const key of Object.keys(attrs)) {
    if (STYLED.has(key)) el.style.setProperty(key, String(attrs[key]))
    else el.setAttribute(key, String(attrs[key]))
  }
  if (parent) parent.appendChild(el)
  return el
}

interface Act {
  dur: number
  at(progress: number, now: number): void
  /** 이 동작에 붙는 소리. 길이는 재생할 때 act.dur에서 가져온다 —
      전체 길이를 맞추느라 dur을 줄이면 소리도 같이 줄어야 한다. */
  fx?: 'scratch' | 'circle'
  started?: boolean
  end?: () => void
}

/** 표가 커져도 이 시간을 넘기지 않는다. 5×5면 칸이 25개라 그냥 두면 30초가 넘는다. */
const MAX_TOTAL_MS = 19000
/** 아무리 줄여도 이보다 짧으면 글씨가 그어지는 게 안 보인다. */
const MIN_ACT_MS = 80

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)

export function createMatrixScene(
  svg: SVGSVGElement,
  data: MatrixData,
  options: { sound: PenSound; onDone?: () => void },
): SceneHandle {
  const alts = data.alternatives
  const crits = data.criteria
  const n = alts.length
  const m = crits.length

  const COL_W = (GRID_R - GRID_L) / n
  const ROW_H = m <= 3 ? 64 : 54
  const GRID_B = GRID_T + ROW_H * m
  const VH = GRID_B + 28
  const CY = VH / 2

  const colX = (i: number) => GRID_L + COL_W * i + COL_W / 2
  const rowY = (i: number) => GRID_T + ROW_H * i + ROW_H / 2

  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`)
  svg.textContent = ''

  const defs = mk('defs', {}, svg)
  const zoom = mk('g', {}, svg)
  const gGrid = mk('g', { class: 'mx-grid' }, zoom)
  const gLabels = mk('g', { class: 'mx-labels' }, zoom)
  const gScores = mk('g', { class: 'mx-scores' }, zoom)
  const gRings = mk('g', { class: 'mx-rings' }, zoom)
  const penG = mk('g', { class: 'mx-pen', opacity: '0' }, svg)

  // ── 글자 폭 재기 ────────────────────────────────────────────
  /* 이름은 사용자가 친 글자라 길이를 알 수 없다. 실제로 재서 줄을 나누고,
     그래도 안 들어가면 크기를 줄이고, 끝내 안 되면 자른다. 자른 이름은
     화면이 표 아래에 범례로 다시 보여준다. */
  const ruler = mk('text', { class: 'mx-ruler', x: 0, y: -999, 'font-family': BODY }, svg)
  ruler.style.visibility = 'hidden'
  ruler.setAttribute('aria-hidden', 'true')

  function measure(text: string, size: number, family = BODY): number {
    ruler.style.setProperty('font-size', String(size))
    ruler.style.setProperty('font-family', family)
    ruler.textContent = text
    return ruler.getComputedTextLength()
  }

  function clip(text: string, maxWidth: number, size: number): string {
    if (measure(text, size) <= maxWidth) return text
    let cut = text.length - 1
    while (cut > 1 && measure(text.slice(0, cut) + '…', size) > maxWidth) cut--
    return text.slice(0, cut) + '…'
  }

  /** 한 줄로 안 되면 가장 고르게 갈리는 자리에서 두 줄로 나눈다. */
  function split(text: string, size: number): [string, string] | null {
    const spots: number[] = []
    for (let i = 1; i < text.length; i++) if (text[i - 1] === ' ') spots.push(i)
    if (spots.length === 0) spots.push(Math.ceil(text.length / 2))
    let best: [string, string] | null = null
    let bestWidest = Infinity
    for (const at of spots) {
      const a = text.slice(0, at).trimEnd()
      const b = text.slice(at).trimStart()
      if (!a || !b) continue
      const widest = Math.max(measure(a, size), measure(b, size))
      if (widest < bestWidest) {
        bestWidest = widest
        best = [a, b]
      }
    }
    return best
  }

  const cut = { alternatives: false, criteria: false }
  let cutting: 'alternatives' | 'criteria' = 'alternatives'

  function layout(text: string, maxWidth: number, maxLines: 1 | 2): { lines: string[]; size: number } {
    for (const size of [13.5, 12.5, 11.5, 10.5, 9.5]) {
      if (measure(text, size) <= maxWidth) return { lines: [text], size }
      if (maxLines === 2) {
        const pair = split(text, size)
        if (pair && measure(pair[0], size) <= maxWidth && measure(pair[1], size) <= maxWidth) {
          return { lines: pair, size }
        }
      }
    }
    cut[cutting] = true
    const size = 9.5
    if (maxLines === 1) return { lines: [clip(text, maxWidth, size)], size }
    const pair = split(text, size)
    if (!pair) return { lines: [clip(text, maxWidth, size)], size }
    return { lines: [clip(pair[0], maxWidth, size), clip(pair[1], maxWidth, size)], size }
  }

  // ── 펜 ──────────────────────────────────────────────────────
  /* 끝(닙)이 원점이고 몸통이 위로 뻗는다. 마스크가 아래 22%만 온전히
     남기고 34%에서 완전히 지운다 — 손이 잡은 윗부분은 보이지 않는다. */
  const grad = mk('linearGradient', { id: 'mx-penfade', x1: '0', y1: '1', x2: '0', y2: '0' }, defs)
  mk('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': '1' }, grad)
  mk('stop', { offset: '22%', 'stop-color': '#fff', 'stop-opacity': '1' }, grad)
  mk('stop', { offset: '34%', 'stop-color': '#fff', 'stop-opacity': '0' }, grad)
  const mask = mk(
    'mask',
    { id: 'mx-penmask', maskUnits: 'userSpaceOnUse', x: -40, y: -210, width: 80, height: 216 },
    defs,
  )
  mk('rect', { x: -40, y: -210, width: 80, height: 216, fill: 'url(#mx-penfade)' }, mask)
  const penTilt = mk('g', {}, penG)
  const penBody = mk('g', { mask: 'url(#mx-penmask)' }, penTilt)
  penBody.innerHTML = PEN_SHAPE

  let penShown = false
  function penAt(x: number, y: number, now: number, moving: boolean): void {
    const sx = cam.tx + cam.s * x
    const sy = cam.ty + cam.s * y
    // 손이 끌리듯, 옮겨가는 동안만 2도쯤 더 눕는다
    const lean = PEN_ANGLE + (moving ? 2 : 0) + Math.sin(now * 17) * 1.0
    penG.setAttribute('transform', `translate(${sx.toFixed(2)} ${sy.toFixed(2)})`)
    penTilt.setAttribute('transform', `rotate(${lean.toFixed(2)}) scale(${PEN_SCALE})`)
    if (!penShown) {
      penG.style.opacity = '1'
      penShown = true
    }
  }
  function penOff(): void {
    if (!penShown) return
    penG.style.opacity = '0'
    penShown = false
  }

  // ── 카메라 ──────────────────────────────────────────────────
  const cam = { s: 1, cx: VW / 2, cy: CY, tx: 0, ty: 0 }
  function applyCam(s: number, cx: number, cy: number): void {
    cam.s = s
    cam.cx = cx
    cam.cy = cy
    cam.tx = VW / 2 - s * cx
    cam.ty = CY - s * cy
    zoom.setAttribute('transform', `translate(${cam.tx.toFixed(3)} ${cam.ty.toFixed(3)}) scale(${s.toFixed(4)})`)
  }
  applyCam(1, VW / 2, CY)

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  /** x가 [left, right]를 다 담는 배율. 잘리면 사용자가 자기 글자를 못 읽는다. */
  const spanZoom = (left: number, right: number, cap: number) => clamp(VW / (right - left), 1, cap)

  const Z_HEAD = spanZoom(GRID_L - 4, GRID_R + 6, 1.5)
  const Z_LABEL = spanZoom(LABEL_L - 6, GRID_L + 44, 1.45)
  const Z_ROW = spanZoom(LABEL_L + 4, colX(n - 1) + COL_W * 0.5, 1.3)

  // ── 타임라인 ────────────────────────────────────────────────
  const acts: Act[] = []
  let cursor = { x: GRID_L, y: GRID_T }

  function travel(x: number, y: number, dur = 190): void {
    const from = { ...cursor }
    acts.push({
      dur,
      at(p, now) {
        const e = ease(p)
        const lift = Math.sin(p * Math.PI) * 9 // 살짝 들었다 놓는다
        penAt(from.x + (x - from.x) * e, from.y + (y - from.y) * e - lift, now, true)
      },
    })
    cursor = { x, y }
  }

  function stroke(parent: Element, d: string, dur: number, attrs: Attrs = {}): void {
    const path = mk(
      'path',
      { d, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.2, 'stroke-linecap': 'round', ...attrs },
      parent,
    )
    const len = path.getTotalLength()
    path.style.strokeDasharray = String(len)
    path.style.strokeDashoffset = String(len)
    const head = path.getPointAtLength(0)
    travel(head.x, head.y)
    acts.push({
      dur,
      fx: 'scratch',
      at(p, now) {
        path.style.strokeDashoffset = String(len * (1 - p))
        const pt = path.getPointAtLength(len * p)
        penAt(pt.x, pt.y, now, false)
      },
    })
    const tail = path.getPointAtLength(len)
    cursor = { x: tail.x, y: tail.y }
  }

  /** 글자를 왼쪽부터 드러낸다. 폭은 실제로 재서 쓴다. */
  function write(
    parent: Element,
    text: string,
    x: number,
    y: number,
    attrs: Attrs & { 'text-anchor'?: string; 'font-size'?: number } = {},
    dur?: number,
  ): void {
    const el = mk('text', { x, y, fill: 'var(--ink)', 'font-family': BODY, 'font-size': 13, ...attrs }, parent)
    el.textContent = text
    const len = el.getComputedTextLength()
    const anchor = attrs['text-anchor']
    const x0 = anchor === 'end' ? x - len : anchor === 'middle' ? x - len / 2 : x
    const size = Number(attrs['font-size'] ?? 13)

    const id = `mx-clip${acts.length}`
    const cp = mk('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, defs)
    const rect = mk('rect', { x: x0 - 3, y: y - size - 4, width: 0, height: size + 12 }, cp)
    el.setAttribute('clip-path', `url(#${id})`)

    const ms = dur ?? Math.max(190, len * 9)
    travel(x0, y + 1)
    acts.push({
      dur: ms,
      fx: 'scratch',
      at(p, now) {
        rect.setAttribute('width', ((len + 5) * p).toFixed(2))
        penAt(x0 + len * p, y + 1.5, now, false)
      },
    })
    cursor = { x: x0 + len, y: y + 1 }
  }

  /** 손으로 그린 동그라미. 한 바퀴를 조금 넘겨 닫는다. */
  function ringPath(cx: number, cy: number, rx: number, ry: number): string {
    const steps = 64
    const start = -1.75
    const tilt = -0.12
    let d = ''
    for (let i = 0; i <= steps; i++) {
      const a = start + (i / steps) * Math.PI * 2 * 1.1
      // 낮은 주파수로만 흔든다 — 촘촘히 떨면 톱니가 된다
      const j = 1 + Math.sin(a * 2 + 0.6) * 0.045 + Math.sin(a * 3 - 1.1) * 0.025
      const ex = Math.cos(a) * rx * j
      const ey = Math.sin(a) * ry * j
      d += (i === 0 ? 'M' : ' L')
      d += (cx + ex * Math.cos(tilt) - ey * Math.sin(tilt)).toFixed(2)
      d += ' ' + (cy + ex * Math.sin(tilt) + ey * Math.cos(tilt)).toFixed(2)
    }
    return d
  }

  function camTo(s: number, cx: number, cy: number, dur: number): void {
    const from = { s: cam.s, cx: cam.cx, cy: cam.cy }
    acts.push({
      dur,
      at(p) {
        const e = ease(p)
        applyCam(from.s + (s - from.s) * e, from.cx + (cx - from.cx) * e, from.cy + (cy - from.cy) * e)
        penOff()
      },
    })
  }

  // ── 장면 ────────────────────────────────────────────────────
  // 1. 가로축과 세로축
  camTo(1.02, VW / 2, CY, 420)
  stroke(gGrid, `M ${LABEL_L} ${GRID_T} L ${GRID_R} ${GRID_T}`, 700)
  // 세로축은 아래에서 위로 긋는다. 펜의 몸통은 끝점에서 **위로** 뻗으므로,
  // 위에서 시작하면 긋는 내내 몸통이 종이 밖에 있다.
  stroke(gGrid, `M ${GRID_L} ${GRID_B + 6} L ${GRID_L} ${GRID_T - 62}`, 620)

  // 2. 선택지를 가로축에
  camTo(Z_HEAD, (GRID_L + GRID_R) / 2, 54, 560)
  cutting = 'alternatives'
  alts.forEach((alt, i) => {
    // 번호는 선택지의 고유색을 쓴다 — 결과 화면에서 같은 ①이 같은 색이어야
    // 두 화면이 한 이야기로 읽힌다 (디자인 §1).
    write(gLabels, alt.mark, colX(i), 40, { 'text-anchor': 'middle', 'font-size': 20, 'font-family': INK, fill: alt.color }, 230)
    const { lines, size } = layout(alt.name, COL_W - 6, 2)
    lines.forEach((line, li) => {
      write(gLabels, line, colX(i), 62 + li * (size + 2.5), { 'text-anchor': 'middle', 'font-size': size })
    })
  })

  // 3. 기준을 세로축에
  camTo(Z_LABEL, (LABEL_L + GRID_L + 44) / 2, rowY((m - 1) / 2), 560)
  cutting = 'criteria'
  crits.forEach((crit, i) => {
    const { lines, size } = layout(crit.name, LABEL_R - LABEL_L, m <= 3 ? 2 : 1)
    const top = rowY(i) - 3 - (lines.length - 1) * (size + 1.5)
    lines.forEach((line, li) => {
      write(gLabels, line, LABEL_R, top + li * (size + 1.5), { 'text-anchor': 'end', 'font-size': size })
    })
    write(gLabels, crit.percent, LABEL_R, rowY(i) + 15, { 'text-anchor': 'end', 'font-size': 12, 'font-family': INK, fill: 'var(--meta)' }, 170)
  })

  // 4·5. 점수를 가로 방향으로 — 첫 줄을 보여주고, 나머지도 같은 방식으로
  const rowCx = (LABEL_L + 4 + colX(n - 1) + COL_W * 0.5) / 2
  crits.forEach((_, ci) => {
    camTo(Z_ROW, rowCx, rowY(ci), ci === 0 ? 520 : 420)
    alts.forEach((_alt, ai) => {
      const value = data.scores[ci]?.[ai] ?? null
      write(
        gScores,
        value === null ? '·' : String(value),
        colX(ai),
        rowY(ci) + (m <= 3 ? 8 : 6),
        {
          'text-anchor': 'middle',
          'font-size': value === null ? 22 : m <= 3 && n <= 3 ? 30 : 24,
          'font-family': INK,
          fill: value === null ? 'var(--meta)' : 'var(--ink)',
        },
        250,
      )
    })
  })

  // 6. 기준마다 가장 높은 점수에 빨간 동그라미
  camTo(Z_ROW, rowCx, rowY((m - 1) / 2), 540)
  const RX = Math.min(24, COL_W * 0.34)
  const RY = Math.min(19, ROW_H * 0.31)
  crits.forEach((_, ci) => {
    const ai = data.winners[ci] ?? -1
    if (ai < 0) return
    // 동그라미는 색연필이다 — 사용자의 손자국이라 --pen 그대로 둔다.
    stroke(gRings, ringPath(colX(ai), rowY(ci), RX, RY), 520, {
      stroke: 'var(--pen)',
      'stroke-width': 1.8,
      opacity: 0.9,
    })
    // 사각거림 대신 색연필 소리로 바꿔 단다.
    const last = acts[acts.length - 1]
    if (last) last.fx = 'circle'
  })

  // 7. 물러나서 전체를 본다
  camTo(1, VW / 2, CY, 900)
  acts.push({
    dur: 260,
    at() {
      penOff()
    },
    end: () => done(),
  })

  // 다 짜고 나서 전체 길이를 맞춘다. 칸이 많을수록 한 칸에 쓰는 시간이 줄어든다.
  const planned = acts.reduce((sum, act) => sum + act.dur, 0)
  if (planned > MAX_TOTAL_MS) {
    const k = MAX_TOTAL_MS / planned
    for (const act of acts) act.dur = Math.max(MIN_ACT_MS, Math.round(act.dur * k))
  }

  // ── 재생 ────────────────────────────────────────────────────
  let raf = 0
  let finished = false
  let destroyed = false

  function done(): void {
    if (finished) return
    finished = true
    penOff()
    options.onDone?.()
  }

  function play(): void {
    let i = 0
    let base = performance.now()
    const step = (now: number) => {
      if (destroyed) return
      const clock = now / 1000
      let guard = 0
      while (i < acts.length && guard++ < 200) {
        const act = acts[i]
        if (!act) break
        const elapsed = now - base
        if (elapsed >= act.dur) {
          act.at(1, clock)
          act.end?.()
          i++
          base += act.dur
          continue
        }
        if (!act.started) {
          act.started = true
          if (act.fx === 'scratch') options.sound.scratch(act.dur / 1000)
          else if (act.fx === 'circle') options.sound.circle(act.dur / 1000)
        }
        act.at(elapsed / act.dur, clock)
        break
      }
      if (i < acts.length) raf = requestAnimationFrame(step)
      else done()
    }
    raf = requestAnimationFrame(step)
  }

  function finish(): void {
    cancelAnimationFrame(raf)
    for (const act of acts) {
      act.started = true
      act.at(1, 0)
    }
    applyCam(1, VW / 2, CY)
    done()
  }

  return {
    play,
    finish,
    destroy() {
      destroyed = true
      cancelAnimationFrame(raf)
    },
    get truncated() {
      return { ...cut }
    },
  }
}
