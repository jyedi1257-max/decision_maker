import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { StepBar, Title, TopBar } from '@/components/Controls'
import { CloseIcon } from '@/components/Icons'
import { delay } from '@/styles/motion'
import { advisor } from '@/core/advisor'
import { DEFAULT_CRITERIA, MAX_CRITERIA } from '@/core/types'
import { useDecision } from '@/app/useDecision'
import { flushPendingSave } from '@/store/decisions'
import { newCriterion, nextPath, prevPath, stepNumber } from '@/store/factory'
import { slotPlaceholder } from '@/copy/examples'

/**
 * 4 · 기준 세 개
 *
 * 무제한 추가 대신 핵심 3개를 먼저 고르게 한다 (기획안 3.2, 8.2).
 * 중복 감지는 기기 안에서 문자열로만 한다 — 고민 본문이 밖으로 나가지 않는다.
 */
export function Criteria() {
  const navigate = useNavigate()
  const { decision, update } = useDecision()
  const lastInput = useRef<HTMLInputElement | null>(null)

  const rows = useMemo(() => {
    if (!decision) return []
    if (decision.criteria.length > 0) return decision.criteria
    return Array.from({ length: DEFAULT_CRITERIA }, () => newCriterion())
  }, [decision])

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

  return (
    <Paper>
      <TopBar
        back={prevPath(decision.id, 'criteria')}
        center={`${stepNumber('criteria')} / 7`}
        right={<span className="meta">저장됨</span>}
      />
      <StepBar step={stepNumber('criteria')} />

      <div style={{ marginTop: 34 }}>
        <Title lines={['무엇을 기준으로', '볼까요? 먼저 세 개만.']} />
      </div>
      <p className="lede m-lift" style={delay(0, 'm-lift', 260)}>
        세 개면 대부분의 결정이 갈립니다. 더 필요하면 나중에 한 개씩 늘려요.
      </p>

      <div className="stack" style={{ marginTop: 22, gap: 10 }}>
        {rows.map((criterion, i) => (
          <div key={criterion.id} className="row m-settle" style={delay(i, 'm-settle', 320)}>
            <span className="ordinal" aria-hidden="true">
              {i + 1}
            </span>
            <input
              ref={i === rows.length - 1 ? lastInput : null}
              className="row__text"
              style={{ border: 0, background: 'transparent', padding: 0 }}
              type="text"
              value={criterion.name}
              placeholder={slotPlaceholder(i, '기준')}
              aria-label={`기준 ${i + 1}`}
              autoComplete="off"
              onChange={(e) => setName(criterion.id, e.target.value)}
            />
            {rows.length > 1 && (
              <button
                type="button"
                className="iconbtn"
                style={{ margin: '-12px -10px -12px 0' }}
                aria-label={`기준 ${i + 1} 지우기`}
                onClick={() => removeAt(criterion.id)}
              >
                <CloseIcon />
              </button>
            )}
          </div>
        ))}
      </div>

      {duplicate && (
        <div className="card--note m-settle" style={{ marginTop: 20, ...delay(0, 'm-settle', 560) }}>
          <div className="card__pen-label">겹쳐 보여요</div>
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.7 }}>
            ‘<strong style={{ color: 'var(--pen)' }}>{duplicate.a.name}</strong>’과 ‘
            <strong style={{ color: 'var(--pen)' }}>{duplicate.b.name}</strong>’는 같은 걸 두 번 보는
            것 같아요. 하나로 묶을까요?
          </p>
          <div className="btnrow" style={{ marginTop: 14, gap: 8 }}>
            <button type="button" className="btn--answer is-strong" onClick={mergeDuplicate}>
              묶기
            </button>
            <button type="button" className="btn--answer" onClick={keepBoth}>
              따로 볼게요
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

      <div className="spacer" />

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
    </Paper>
  )
}
