import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { CircleNum, StepBar, Title, TopBar } from '@/components/Controls'
import { CloseIcon, PlusIcon, SparkIcon } from '@/components/Icons'
import { delay } from '@/styles/motion'
import { advisor } from '@/core/advisor'
import { MAX_ALTERNATIVES, MIN_ALTERNATIVES } from '@/core/types'
import { useDecision } from '@/app/useDecision'
import { flushPendingSave } from '@/store/decisions'
import { newAlternative, nextPath, prevPath, stepNumber } from '@/store/factory'

/** 2 · 후보 적기 — 2~5개로 제한한다 (기획안 8.2 choice complexity 관리) */
export function Alternatives() {
  const navigate = useNavigate()
  const { decision, update } = useDecision()
  const lastInput = useRef<HTMLInputElement | null>(null)

  const hiddenHint = useMemo(
    () => (decision ? advisor.suggestHiddenAlternative(decision) : null),
    [decision],
  )

  if (!decision) return <Paper> </Paper>

  const named = decision.alternatives.filter((a) => a.name.trim() !== '')
  const ready = named.length >= MIN_ALTERNATIVES
  const canAdd = decision.alternatives.length < MAX_ALTERNATIVES

  // 처음 들어왔을 때 빈 줄 두 개를 깔아 둔다 — 최소 개수를 몸으로 알려준다.
  const rows =
    decision.alternatives.length > 0
      ? decision.alternatives
      : [newAlternative(), newAlternative()]

  function setName(id: string, name: string) {
    update((d) => ({
      ...d,
      alternatives: (d.alternatives.length > 0 ? d.alternatives : rows).map((a) =>
        a.id === id ? { ...a, name } : a,
      ),
    }))
  }

  function add(name = '') {
    update((d) => {
      const base = d.alternatives.length > 0 ? d.alternatives : rows
      if (base.length >= MAX_ALTERNATIVES) return d
      return { ...d, alternatives: [...base, newAlternative(name)] }
    })
    requestAnimationFrame(() => lastInput.current?.focus())
  }

  function removeAt(id: string) {
    update((d) => ({
      ...d,
      alternatives: d.alternatives.filter((a) => a.id !== id),
      // 사라진 후보의 점수·직감·필수조건 판정도 함께 거둔다.
      scores: Object.fromEntries(
        Object.entries(d.scores).filter(([key]) => !key.startsWith(`${id}:`)),
      ),
      gut: d.gut.alternativeId === id ? { ...d.gut, alternativeId: null } : d.gut,
      musts: d.musts.map((m) => {
        const passes = { ...m.passes }
        delete passes[id]
        return { ...m, passes }
      }),
    }))
  }

  function dismissHint() {
    update((d) => ({ ...d, hiddenAlternativeAsked: true }))
  }

  function acceptHint() {
    update((d) => {
      if (d.alternatives.length >= MAX_ALTERNATIVES) {
        return { ...d, hiddenAlternativeAsked: true }
      }
      return {
        ...d,
        hiddenAlternativeAsked: true,
        alternatives: [...d.alternatives, newAlternative('1년 미루고 내년에 다시 보기')],
      }
    })
  }

  async function next() {
    update((d) => ({
      ...d,
      // 빈 줄은 저장하지 않는다.
      alternatives: (d.alternatives.length > 0 ? d.alternatives : rows).filter(
        (a) => a.name.trim() !== '',
      ),
      stage: 'gut',
    }))
    await flushPendingSave()
    navigate(nextPath(decision!.id, 'alternatives'))
  }

  return (
    <Paper>
      <TopBar
        back={prevPath(decision.id, 'alternatives')}
        center={`${stepNumber('alternatives')} / 7`}
        right={<span className="meta">저장됨</span>}
      />
      <StepBar step={stepNumber('alternatives')} />

      <div style={{ marginTop: 34 }}>
        <Title lines={['지금 머릿속에 있는', '후보를 적어볼까요?']} />
      </div>
      <p className="lede m-lift" style={delay(0, 'm-lift', 260)}>
        2개부터 5개까지. 비슷한 건 하나로 묶어도 돼요.
      </p>

      <div className="stack" style={{ marginTop: 24, gap: 10 }}>
        {rows.map((alt, i) => (
          <div
            key={alt.id}
            className="row m-settle"
            style={{ padding: 17, gap: 14, ...delay(i, 'm-settle', 320) }}
          >
            <CircleNum n={i + 1} />
            <input
              ref={i === rows.length - 1 ? lastInput : null}
              className="row__text"
              style={{ border: 0, background: 'transparent', padding: 0 }}
              type="text"
              value={alt.name}
              placeholder={i === 0 ? '지금 집 재계약' : '신도시 24평으로 이사'}
              aria-label={`후보 ${i + 1}`}
              autoComplete="off"
              onChange={(e) => setName(alt.id, e.target.value)}
            />
            {rows.length > MIN_ALTERNATIVES && (
              <button
                type="button"
                className="iconbtn"
                style={{ margin: '-12px -10px -12px 0' }}
                aria-label={`후보 ${i + 1} 지우기`}
                onClick={() => removeAt(alt.id)}
              >
                <CloseIcon />
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          className="btn btn--add m-lift"
          disabled={!canAdd}
          onClick={() => add()}
          style={delay(rows.length, 'm-lift', 320)}
        >
          <PlusIcon />
          {canAdd ? '후보 하나 더' : '다섯 개면 충분해요'}
        </button>
      </div>

      {hiddenHint && named.length >= MIN_ALTERNATIVES && (
        <div className="card--note m-settle" style={{ marginTop: 24, ...delay(0, 'm-settle', 660) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SparkIcon />
            <span className="card__pen-label">한 번만 묻습니다</span>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.7 }}>{hiddenHint}</p>
          <div className="btnrow" style={{ marginTop: 12, gap: 8 }}>
            <button type="button" className="btn--answer is-strong" onClick={acceptHint}>
              후보에 넣기
            </button>
            <button type="button" className="btn--answer" onClick={dismissHint}>
              아니요
            </button>
          </div>
        </div>
      )}

      <div className="spacer" />

      <button
        type="button"
        className="btn btn--primary m-lift"
        disabled={!ready}
        onClick={next}
        style={delay(0, 'm-lift', 680)}
      >
        {ready ? '다음' : '후보를 두 개 이상 적어주세요'}
      </button>
    </Paper>
  )
}
