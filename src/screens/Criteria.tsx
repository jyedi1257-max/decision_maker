import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { StepBar, Title, TopBar } from '@/components/Controls'
import { CloseIcon } from '@/components/Icons'
import { delay } from '@/styles/motion'
import { advisor } from '@/core/advisor'
import { moveTo, overrideFits } from '@/core/weights'
import { DEFAULT_CRITERIA, MAX_CRITERIA } from '@/core/types'
import { useDecision } from '@/app/useDecision'
import { flushPendingSave } from '@/store/decisions'
import { newCriterion, nextPath, prevPath, stepNumber, STEP_COUNT } from '@/store/factory'
import { slotPlaceholder } from '@/copy/examples'

/** 이만큼 가만히 누르고 있어야 줄이 들린다. 브라우저의 길게 누르기(약 500ms)보다 먼저 온다. */
const LONG_PRESS_MS = 350
/** 들리기 전에 손가락이 이만큼 움직이면 스크롤로 본다. */
const MOVE_SLOP_PX = 8

/**
 * 4 · 기준
 *
 * 무제한 추가 대신 핵심 3개를 먼저 고르게 한다 (기획안 3.2, 8.2).
 * 적은 순서가 곧 중요한 순서다 — 가중치는 이 순서에서 ROC로 뽑는다 (기획안 6.4).
 * 순서는 줄을 길게 눌러 끌어서 바꾼다. 따로 '순서 정하기' 단계를 두지 않는다.
 * 중복 감지는 기기 안에서 문자열로만 한다 — 고민 본문이 밖으로 나가지 않는다.
 */
export function Criteria() {
  const navigate = useNavigate()
  const { decision, update } = useDecision()
  const lastInput = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLOListElement>(null)

  /** 지금 고치고 있는 줄. 이름이 있는 줄은 평소엔 글자로 보이고, 누르면 입력칸이 된다. */
  const [editingId, setEditingId] = useState<string | null>(null)
  /** 들고 있는 줄: 어디서 들었고, 지금 놓으면 몇 번째가 되고, 손가락이 얼마나 내려왔나. */
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number } | null>(null)
  const dragging = useRef(false)
  /** 들었다 놓은 손길 끝에 따라오는 click은 '고치기'가 아니다. */
  const swallowClick = useRef(false)
  const focusAfterMove = useRef<string | null>(null)
  const [announce, setAnnounce] = useState('')

  // 들고 있는 동안만 스크롤을 막는다. 문서 리스너는 기본이 passive라 명시해야 막힌다.
  useEffect(() => {
    const block = (e: TouchEvent) => {
      if (dragging.current && e.cancelable) e.preventDefault()
    }
    document.addEventListener('touchmove', block, { passive: false })
    return () => document.removeEventListener('touchmove', block)
  }, [])

  const rows = useMemo(() => {
    if (!decision) return []
    if (decision.criteria.length > 0) return decision.criteria
    return Array.from({ length: DEFAULT_CRITERIA }, () => newCriterion())
  }, [decision])

  useEffect(() => {
    const id = focusAfterMove.current
    if (!id) return
    focusAfterMove.current = null
    listRef.current
      ?.querySelector<HTMLElement>(`[data-row="${id}"] .row__edit, [data-row="${id}"] input`)
      ?.focus()
  })

  const duplicate = useMemo(() => {
    if (!decision) return null
    return advisor.findDuplicateCriteria(
      decision.criteria.filter((c) => c.name.trim() !== ''),
      decision.dismissedDuplicateHints,
    )
  }, [decision])

  if (!decision) return <Paper> </Paper>

  const named = rows.filter((c) => c.name.trim() !== '')
  const ready = named.length >= 1
  const canAdd = rows.length < MAX_CRITERIA
  const handTuned = overrideFits(decision.weightOverride, decision.criteria.length)

  function setName(id: string, name: string) {
    update((d) => ({
      ...d,
      criteria: (d.criteria.length > 0 ? d.criteria : rows).map((c) =>
        c.id === id ? { ...c, name } : c,
      ),
    }))
  }

  function add(name = '') {
    update((d) => {
      const base = d.criteria.length > 0 ? d.criteria : rows
      if (base.length >= MAX_CRITERIA) return d
      return { ...d, criteria: [...base, newCriterion(name)] }
    })
    if (name === '') requestAnimationFrame(() => lastInput.current?.focus())
  }

  function removeAt(id: string) {
    update((d) => ({
      ...d,
      criteria: d.criteria.filter((c) => c.id !== id),
      scores: Object.fromEntries(
        Object.entries(d.scores).filter(([key]) => !key.endsWith(`:${id}`)),
      ),
    }))
  }

  function reorder(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to) return
    const moved = rows[from]
    // 순서를 다시 잡는다는 건 ROC로 돌아가겠다는 뜻이다.
    // '직접 조정해보기'에서 손으로 정한 무게는 여기서 놓아준다.
    update((d) => ({
      ...d,
      criteria: moveTo(d.criteria.length > 0 ? d.criteria : rows, from, to),
      weightOverride: null,
    }))
    if (moved) {
      const label = moved.name.trim() || `기준 ${from + 1}`
      setAnnounce(`‘${label}’을 ${to + 1}번째로 옮겼어요.`)
    }
  }

  /**
   * 길게 눌러 들기.
   *
   * 손가락이 먼저 움직이면 스크롤이고, 가만히 LONG_PRESS_MS를 버티면 줄이 들린다.
   * 들린 뒤에는 문서의 touchmove를 막아 스크롤 대신 줄이 따라오게 한다.
   * 입력칸과 지우기 버튼에서 시작한 누름은 그쪽 몫이라 건드리지 않는다.
   */
  function press(index: number, event: ReactPointerEvent<HTMLLIElement>) {
    swallowClick.current = false
    if (event.button !== 0 || rows.length < 2) return
    if ((event.target as HTMLElement).closest('input, [data-no-press]')) return
    const list = listRef.current
    if (!list) return

    const pointerId = event.pointerId
    const startX = event.clientX
    const startY = event.clientY
    let rects: DOMRect[] = []
    let to = index
    let lifted = false

    const timer = window.setTimeout(() => {
      lifted = true
      dragging.current = true
      rects = [...list.children].map((row) => row.getBoundingClientRect())
      navigator.vibrate?.(12)
      setDrag({ from: index, to: index, dy: 0 })
    }, LONG_PRESS_MS)

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const dy = e.clientY - startY
      if (!lifted) {
        if (Math.hypot(e.clientX - startX, dy) > MOVE_SLOP_PX) end()
        return
      }
      const self = rects[index]
      if (!self) return
      const center = self.top + self.height / 2 + dy
      // 들고 있는 줄의 한가운데가 지금 어느 줄의 구간에 들어와 있나.
      to = rects.length - 1
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i]
        if (rect && center <= rect.bottom) {
          to = i
          break
        }
      }
      setDrag({ from: index, to, dy })
    }

    const end = () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (!lifted) return
      dragging.current = false
      swallowClick.current = true
      setDrag(null)
      reorder(index, to)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  /** 키보드·보조기기 길: 줄 안에서 Alt+위/아래. */
  function onRowKey(index: number, id: string, e: ReactKeyboardEvent) {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    const to = e.key === 'ArrowUp' ? index - 1 : index + 1
    if (to < 0 || to >= rows.length) return
    focusAfterMove.current = id
    reorder(index, to)
  }

  /** 지금 놓으면 나올 순서. 드는 동안 번호와 자리를 미리 보여준다. */
  const preview = drag ? moveTo(rows.map((_, i) => i), drag.from, drag.to) : null

  function shift(index: number): number {
    if (!drag || !preview) return 0
    if (index === drag.from) return drag.dy
    const list = listRef.current
    if (!list) return 0
    const els = [...list.children] as HTMLElement[]
    const here = els[index]
    const there = els[preview.indexOf(index)]
    if (!here || !there) return 0
    return there.offsetTop - here.offsetTop
  }

  /** 묶기 — 뒤엣것을 지우고 앞엣것만 남긴다. 같은 가치를 이중계산하지 않기 위해서다. */
  function mergeDuplicate() {
    if (!duplicate) return
    update((d) => ({
      ...d,
      criteria: d.criteria.filter((c) => c.id !== duplicate.b.id),
      scores: Object.fromEntries(
        Object.entries(d.scores).filter(([key]) => !key.endsWith(`:${duplicate.b.id}`)),
      ),
    }))
  }

  function keepBoth() {
    if (!duplicate) return
    update((d) => ({
      ...d,
      dismissedDuplicateHints: [...d.dismissedDuplicateHints, duplicate.key],
    }))
  }

  async function next() {
    update((d) => ({
      ...d,
      criteria: (d.criteria.length > 0 ? d.criteria : rows).filter((c) => c.name.trim() !== ''),
      stage: 'must',
    }))
    await flushPendingSave()
    navigate(nextPath(decision!.id, 'criteria'))
  }

  const footer = (
    <div className="stack" style={{ gap: 8 }}>
      <span
        className="m-lift"
        style={{
          alignSelf: 'center',
          fontFamily: 'var(--font-title)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--pen)',
          ...delay(0, 'm-lift', 660),
        }}
      >
        세 개면 충분해요
      </span>
      <button
        type="button"
        className="btn btn--primary m-lift"
        disabled={!ready}
        onClick={next}
        style={delay(0, 'm-lift', 680)}
      >
        다음
      </button>
    </div>
  )

  return (
    <Paper footer={footer}>
      <TopBar back={prevPath(decision.id, 'criteria')} center={`${stepNumber('criteria')} / ${STEP_COUNT}`} sticker="checklist" />
      <StepBar step={stepNumber('criteria')} />

      <div style={{ marginTop: 34 }}>
        <Title lines={['무엇을 판단 기준으로 둘까요?', '중요한 것부터 세 개만.']} />
      </div>
      <p className="lede m-lift" id="criteria-order-hint" style={delay(0, 'm-lift', 260)}>
        위에 둘수록 무겁게 봐요. 순서를 바꾸려면 줄을 길게 눌러 옮기세요.
      </p>

      <ol ref={listRef} className="stack" style={{ gap: 10, listStyle: 'none', padding: 0, margin: '22px 0 0' }}>
        {rows.map((criterion, i) => {
          const held = drag?.from === i
          const hasName = criterion.name.trim() !== ''
          const editing = !hasName || editingId === criterion.id
          const rank = (preview ? preview.indexOf(i) : i) + 1
          return (
            <li
              key={criterion.id}
              data-row={criterion.id}
              className={`row m-settle${rows.length > 1 ? ' row--pressable' : ''}${drag ? ' row--sorting' : ''}${held ? ' row--held' : ''}`}
              style={{
                transform: drag
                  ? `translateY(${shift(i)}px)${held ? ' rotate(-0.8deg) scale(1.01)' : ''}`
                  : undefined,
                ...delay(i, 'm-settle', 320),
              }}
              onPointerDown={(e) => press(i, e)}
              onContextMenu={(e) => {
                if (!(e.target as HTMLElement).closest('input')) e.preventDefault()
              }}
              onKeyDown={(e) => onRowKey(i, criterion.id, e)}
            >
              <span className="ordinal" aria-hidden="true">
                {rank}
              </span>
              {editing ? (
                <input
                  ref={i === rows.length - 1 ? lastInput : null}
                  className="row__text"
                  style={{ border: 0, background: 'transparent', padding: 0 }}
                  type="text"
                  value={criterion.name}
                  placeholder={slotPlaceholder(i, '기준')}
                  aria-label={`기준 ${i + 1}`}
                  aria-describedby="criteria-order-hint"
                  autoComplete="off"
                  autoFocus={editingId === criterion.id}
                  onFocus={() => setEditingId(criterion.id)}
                  onBlur={() => setEditingId((id) => (id === criterion.id ? null : id))}
                  onChange={(e) => setName(criterion.id, e.target.value)}
                />
              ) : (
                <button
                  type="button"
                  className="row__edit"
                  draggable={false}
                  aria-label={`기준 ${i + 1}: ${criterion.name}. 누르면 고치고, Alt와 위아래 화살표로 순서를 바꿔요.`}
                  onClick={() => {
                    if (swallowClick.current) {
                      swallowClick.current = false
                      return
                    }
                    setEditingId(criterion.id)
                  }}
                >
                  {criterion.name}
                </button>
              )}
              {rows.length > 1 && (
                <button
                  type="button"
                  className="iconbtn"
                  data-no-press
                  style={{ margin: '-12px -10px -12px 0' }}
                  aria-label={`기준 ${i + 1} 지우기`}
                  onClick={() => removeAt(criterion.id)}
                >
                  <CloseIcon />
                </button>
              )}
            </li>
          )
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {handTuned && (
        <p className="lede" style={{ marginTop: 14 }}>
          결과에서 직접 정한 무게를 쓰는 중이에요. 순서를 옮기면 자동 계산으로 돌아갑니다.
        </p>
      )}

      {duplicate && (
        <div className="card--note m-settle" style={{ marginTop: 20, ...delay(0, 'm-settle', 560) }}>
          <div className="card__pen-label">비슷해 보여요</div>
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.7 }}>
            ‘<strong>{duplicate.a.name}</strong>’과 ‘<strong>{duplicate.b.name}</strong>’는 같은 걸 두 번
            보는 것 같아요. 하나로 묶을까요?
          </p>
          <div className="btnrow" style={{ marginTop: 14, gap: 8 }}>
            <button type="button" className="btn--answer is-strong" onClick={mergeDuplicate}>
              하나로
            </button>
            <button type="button" className="btn--answer" onClick={keepBoth}>
              각각 둘게요
            </button>
          </div>
        </div>
      )}

      {canAdd && (
        <div className="m-lift" style={{ marginTop: 20, ...delay(0, 'm-lift', 600) }}>
          {/*
            기준 후보를 앱이 늘어놓지 않는다. 고른 예시는 그 사람의 고민에 안 맞으면
            생각을 엉뚱한 쪽으로 끌고 가고, 맞아도 "고려할 것"을 늘린다 (기획안 8.3).
          */}
          <button type="button" className="btn--chip" onClick={() => add()}>
            + 기준 하나 더
          </button>
        </div>
      )}
    </Paper>
  )
}
