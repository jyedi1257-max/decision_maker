import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { CircleNum, StepBar, Title, TopBar } from '@/components/Controls'
import { CheckIcon, CloseIcon, PlusIcon } from '@/components/Icons'
import { InkStrike } from '@/components/Ink'
import { delay } from '@/styles/motion'
import { evaluate } from '@/core/evaluate'
import { MAX_MUSTS } from '@/core/types'
import { useDecision } from '@/app/useDecision'
import { flushPendingSave } from '@/store/decisions'
import { newMust, nextPath, prevPath, stepNumber } from '@/store/factory'

/**
 * 5 · 필수조건
 *
 * 기획안 6.6: 중요한 안전조건의 낮은 점수를 다른 장점이 상쇄할 수 있으므로
 * MUST/절대조건을 합산 전에 필터링한다. 0~2개, 없으면 건너뛴다.
 */
export function Must() {
  const navigate = useNavigate()
  const { decision, update } = useDecision()
  const lastInput = useRef<HTMLInputElement | null>(null)

  const result = useMemo(() => (decision ? evaluate(decision) : null), [decision])
  if (!decision || !result) return <Paper> </Paper>

  const canAdd = decision.musts.length < MAX_MUSTS
  const survivors = result.ranked.length

  function add() {
    update((d) => (d.musts.length >= MAX_MUSTS ? d : { ...d, musts: [...d.musts, newMust()] }))
    requestAnimationFrame(() => lastInput.current?.focus())
  }

  function setName(id: string, name: string) {
    update((d) => ({ ...d, musts: d.musts.map((m) => (m.id === id ? { ...m, name } : m)) }))
  }

  function removeAt(id: string) {
    update((d) => ({ ...d, musts: d.musts.filter((m) => m.id !== id) }))
  }

  function togglePass(mustId: string, alternativeId: string) {
    update((d) => ({
      ...d,
      musts: d.musts.map((m) =>
        m.id === mustId
          ? { ...m, passes: { ...m.passes, [alternativeId]: m.passes[alternativeId] === false } }
          : m,
      ),
    }))
  }

  async function next() {
    update((d) => ({ ...d, musts: d.musts.filter((m) => m.name.trim() !== ''), stage: 'weight' }))
    await flushPendingSave()
    navigate(nextPath(decision!.id, 'must'))
  }

  const namedMusts = decision.musts.filter((m) => m.name.trim() !== '')

  return (
    <Paper>
      <TopBar
        back={prevPath(decision.id, 'must')}
        center={`${stepNumber('must')} / 7`}
        right={<span className="meta">저장됨</span>}
      />
      <StepBar step={stepNumber('must')} />

      <div style={{ marginTop: 34 }}>
        <Title lines={['이것만 안 되면', '바로 빼는 조건, 있나요?']} />
      </div>
      <p className="lede m-lift" style={delay(0, 'm-lift', 260)}>
        없으면 건너뛰어도 됩니다. 최대 두 개까지.
      </p>

      <div className="stack" style={{ marginTop: 22, gap: 10 }}>
        {decision.musts.map((must, i) => (
          <div key={must.id} className="row m-settle" style={delay(i, 'm-settle', 300)}>
            <CheckIcon delayMs={380} />
            <input
              ref={i === decision.musts.length - 1 ? lastInput : null}
              className="row__text"
              style={{ border: 0, background: 'transparent', padding: 0 }}
              type="text"
              value={must.name}
              placeholder="보증금 3억 이하"
              aria-label={`필수조건 ${i + 1}`}
              autoComplete="off"
              onChange={(e) => setName(must.id, e.target.value)}
            />
            <button
              type="button"
              className="iconbtn"
              style={{ margin: '-12px -10px -12px 0' }}
              aria-label={`필수조건 ${i + 1} 지우기`}
              onClick={() => removeAt(must.id)}
            >
              <CloseIcon />
            </button>
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            className="btn btn--add m-lift"
            onClick={add}
            style={delay(decision.musts.length, 'm-lift', 300)}
          >
            <PlusIcon />
            조건 하나 더
          </button>
        )}
      </div>

      {namedMusts.length > 0 && (
        <>
          <div
            className="m-lift"
            style={{ marginTop: 28, fontSize: 13, fontWeight: 600, color: 'var(--soft)', ...delay(0, 'm-lift', 500) }}
          >
            걸러본 결과 — 조건을 못 지키는 후보를 눌러 빼주세요
          </div>

          <div className="stack" style={{ marginTop: 12, gap: 10 }}>
            {result.all.map((alt, i) => {
              const eliminated = alt.eliminatedBy !== null
              const must = namedMusts[0]!
              return (
                <button
                  key={alt.alternativeId}
                  type="button"
                  aria-pressed={!eliminated}
                  className={`row m-settle${eliminated ? ' row--quiet is-eliminated' : ''}`}
                  style={{
                    padding: '15px 17px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%',
                    ...delay(i, 'm-settle', 540),
                  }}
                  onClick={() => togglePass(must.id, alt.alternativeId)}
                >
                  <CircleNum n={alt.ordinal} size={18} />
                  <span className="row__text" style={{ fontSize: 15 }}>
                    {alt.name}
                  </span>
                  <span className={`chip${eliminated ? '' : ' chip--pass'}`}>
                    {eliminated ? alt.eliminatedBy : '통과'}
                  </span>
                  {eliminated && <InkStrike delayMs={0} />}
                </button>
              )
            })}
          </div>

          <p className="lede m-lift" style={{ marginTop: 18, ...delay(0, 'm-lift', 700) }}>
            필수조건은 점수로 상쇄되지 않습니다. 다른 장점이 아무리 커도 먼저 빠져요.
          </p>
        </>
      )}

      <div className="spacer" />

      {survivors === 0 ? (
        <p className="empty" style={{ marginBottom: 12 }}>
          조건을 지키는 후보가 하나도 남지 않았어요. 조건을 다시 보거나 후보를 더 적어주세요.
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn--primary m-lift"
        disabled={survivors === 0}
        onClick={next}
        style={delay(0, 'm-lift', 720)}
      >
        {namedMusts.length === 0
          ? '조건 없이 넘어가기'
          : survivors === 1
            ? '남은 하나 보기'
            : `남은 ${survivors}개 비교하기`}
      </button>
    </Paper>
  )
}
