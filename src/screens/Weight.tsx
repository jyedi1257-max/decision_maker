import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { RankNum, ReorderHandle, StepBar, Title, TopBar } from '@/components/Controls'
import { delay } from '@/styles/motion'
import { moveTo, overrideFits } from '@/core/weights'
import { weightsFor } from '@/core/evaluate'
import { useDecision } from '@/app/useDecision'
import { flushPendingSave } from '@/store/decisions'
import { nextPath, prevPath, stepNumber } from '@/store/factory'

const BAR_COLORS = ['var(--ink)', 'var(--bar-second)', 'var(--bar-rest)', 'var(--dashed)', 'var(--border)']

/**
 * 6 · 중요한 순서
 *
 * 기획안 6.4 / 디자인 §7 — 가중치는 순서 입력만 받고 내부에서 ROC로 산출한다.
 * 사용자에게 숫자를 직접 요구하지 않는다.
 */
export function Weight() {
  const navigate = useNavigate()
  const { decision, update } = useDecision()
  const [showNumbers, setShowNumbers] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)
  /** 끌고 있는 중: 어디서 잡았고, 지금 놓으면 몇 번째가 되고, 손가락이 얼마나 내려왔나. */
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number } | null>(null)

  const weights = useMemo(() => (decision ? weightsFor(decision) : []), [decision])
  const handTuned = useMemo(
    () => Boolean(decision && overrideFits(decision.weightOverride, decision.criteria.length)),
    [decision],
  )

  if (!decision) return <Paper> </Paper>

  function reorder(from: number, to: number) {
    if (to < 0 || to >= decision!.criteria.length || from === to) return
    // 순서를 다시 잡는다는 건 ROC로 돌아가겠다는 뜻이다.
    // '직접 움직여보기'에서 손으로 정한 무게는 여기서 놓아준다.
    update((d) => ({ ...d, criteria: moveTo(d.criteria, from, to), weightOverride: null }))
  }

  /**
   * 손잡이를 잡고 끌기.
   *
   * HTML5 드래그앤드롭(draggable + onDrop)을 쓰고 있었는데 그건 터치에서
   * 아예 동작하지 않는다 — 손잡이 모양만 보고 끌어본 사람에게는 그냥
   * 고장 난 화면이었다. 포인터 이벤트로 바꿔서 마우스·손가락·펜이 같은
   * 길을 탄다.
   */
  function grab(index: number, event: ReactPointerEvent<HTMLElement>) {
    const list = listRef.current
    if (!list) return
    event.preventDefault()

    const rows = [...list.children] as HTMLElement[]
    const rects = rows.map((row) => row.getBoundingClientRect())
    const startY = event.clientY
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    setDrag({ from: index, to: index, dy: 0 })

    const move = (e: PointerEvent) => {
      const dy = e.clientY - startY
      const self = rects[index]
      if (!self) return
      const center = self.top + self.height / 2 + dy
      // 끌고 있는 행의 한가운데가 지금 어느 행의 구간에 들어와 있나.
      let to = rects.length - 1
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i]
        if (rect && center <= rect.bottom) {
          to = i
          break
        }
      }
      setDrag({ from: index, to, dy })
    }

    const drop = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', drop)
      handle.removeEventListener('pointercancel', drop)
      setDrag((current) => {
        if (current && current.to !== current.from) reorder(current.from, current.to)
        return null
      })
    }

    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', drop)
    handle.addEventListener('pointercancel', drop)
  }

  /** 지금 놓으면 나올 순서. 끄는 동안 번호와 자리를 미리 보여준다. */
  const preview = drag ? moveTo(decision.criteria.map((_, i) => i), drag.from, drag.to) : null

  function shift(index: number): number {
    if (!drag || !preview) return 0
    if (index === drag.from) return drag.dy
    const list = listRef.current
    if (!list) return 0
    const rows = [...list.children] as HTMLElement[]
    const target = preview.indexOf(index)
    const here = rows[index]
    const there = rows[target]
    if (!here || !there) return 0
    return there.offsetTop - here.offsetTop
  }

  async function next() {
    update((d) => ({ ...d, stage: 'evaluate' }))
    await flushPendingSave()
    navigate(nextPath(decision!.id, 'weight'))
  }

  return (
    <Paper>
      <TopBar
        back={prevPath(decision.id, 'weight')}
        center={`${stepNumber('weight')} / 7`}
        right={<span className="meta">저장됨</span>}
      />
      <StepBar step={stepNumber('weight')} />

      <div style={{ marginTop: 40 }}>
        <Title lines={['숫자 대신,', '중요한 순서로 놓아주세요.']} />
      </div>
      <p className="lede m-lift" style={delay(0, 'm-lift', 260)}>
        손잡이를 끌거나 화살표를 누르면 됩니다. 가중치는 앱이 알아서 계산해요.
      </p>

      <ol
        ref={listRef}
        className="stack"
        style={{ marginTop: 28, gap: 12, listStyle: 'none', padding: 0, margin: '28px 0 0' }}
      >
        {decision.criteria.map((criterion, i) => {
          const held = drag?.from === i
          return (
            <li
              key={criterion.id}
              className={`row m-settle${held ? ' row--held' : ''}${drag ? ' row--sorting' : ''}`}
              style={{
                padding: '19px 17px',
                gap: 14,
                transform: drag ? `translateY(${shift(i)}px)` : undefined,
                ...delay(i, 'm-settle', 320),
              }}
            >
              <RankNum n={(preview ? preview.indexOf(i) : i) + 1} delayMs={Math.min(520 + i * 100, 500)} />
              <span className="row__text" style={{ fontSize: 17, fontWeight: 600 }}>
                {criterion.name}
              </span>
              <ReorderHandle
                label={criterion.name}
                canUp={i > 0}
                canDown={i < decision.criteria.length - 1}
                onUp={() => reorder(i, i - 1)}
                onDown={() => reorder(i, i + 1)}
                onGrab={(event) => grab(i, event)}
              />
            </li>
          )
        })}
      </ol>

      <div className="card m-settle" style={{ marginTop: 24, ...delay(0, 'm-settle', 620) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--soft)' }}>
            {handTuned ? '직접 정한 무게' : '이렇게 무게가 나뉩니다'}
          </span>
          <button
            type="button"
            className="btn--link"
            aria-expanded={showNumbers}
            onClick={() => setShowNumbers((v) => !v)}
          >
            {showNumbers ? '접기' : '숫자 보기'}
          </button>
        </div>

        <div className="weightbar">
          {weights.map((w, i) => (
            <span
              key={decision.criteria[i]?.id ?? i}
              className="weightbar__seg m-grow"
              style={{
                width: `${w * 100}%`,
                background: BAR_COLORS[i] ?? 'var(--border)',
                ...delay(i, 'm-grow', 500),
              }}
            />
          ))}
        </div>

        {showNumbers ? (
          <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
            {decision.criteria.map((criterion, i) => (
              <li
                key={criterion.id}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}
              >
                <span style={{ color: 'var(--soft)' }}>{criterion.name}</span>
                <span style={{ fontWeight: 600 }}>{Math.round((weights[i] ?? 0) * 100)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.7, color: 'var(--soft)' }}>
            {handTuned
              ? '결과 화면에서 직접 움직인 무게를 쓰고 있어요. 여기서 순서를 다시 잡으면 자동 계산으로 돌아갑니다.'
              : '내가 나열한 순서입니다. 실제 마음은 다를 수 있어요.'}
          </p>
        )}
      </div>

      <div className="spacer" />

      <button type="button" className="btn btn--primary m-lift" onClick={next} style={delay(0, 'm-lift', 680)}>
        평가하러 가기
      </button>
    </Paper>
  )
}
