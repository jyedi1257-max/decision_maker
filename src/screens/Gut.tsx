import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { CircleNum, Scale5, StepBar, Title, TopBar } from '@/components/Controls'
import { CheckIcon, LockIcon } from '@/components/Icons'
import { delay } from '@/styles/motion'
import { useDecision } from '@/app/useDecision'
import { flushPendingSave } from '@/store/decisions'
import { nextPath, prevPath, stepNumber, STEP_COUNT } from '@/store/factory'

/**
 * 3 · 직감 봉인
 *
 * 분석 전에 첫 마음을 한 번 저장해 둔다 (기획안 8.2 "분석 전 한 번 저장").
 * 직감을 오류로 보지 않는다 — 결과와 갈리면 그 지점을 같이 본다 (기획안 7.3).
 */
export function Gut() {
  const navigate = useNavigate()
  const { decision, update } = useDecision()
  if (!decision) return <Paper> </Paper>

  const { gut } = decision
  const ready = gut.alternativeId !== null && gut.confidence !== null

  async function next() {
    update((d) => ({ ...d, stage: 'criteria' }))
    await flushPendingSave()
    navigate(nextPath(decision!.id, 'gut'))
  }

  return (
    <Paper
      footer={
        <button
          type="button"
          className="btn btn--primary m-lift"
          disabled={!ready}
          onClick={next}
          style={delay(0, 'm-lift', 680)}
        >
          판단 기준 정하기
        </button>
      }
    >
      <TopBar
        back={prevPath(decision.id, 'gut')}
        center={`${stepNumber('gut')} / ${STEP_COUNT}`}
      />
      <StepBar step={stepNumber('gut')} />

      <div style={{ marginTop: 40 }}>
        <Title lines={['계산하기 전에,', '지금 끌리는 쪽이 있나요?']} />
      </div>
      <p className="lede m-lift" style={delay(0, 'm-lift', 260)}>
        지금 끌리는 답과 계산한 답을 나중에 비교해볼게요.
      </p>

      <div className="stack" style={{ marginTop: 30, gap: 10 }} role="radiogroup" aria-label="지금 끌리는 쪽">
        {decision.alternatives.map((alt, i) => {
          const picked = gut.alternativeId === alt.id
          return (
            <button
              key={alt.id}
              type="button"
              role="radio"
              aria-checked={picked}
              className={`pick m-settle${picked ? ' is-picked' : ''}`}
              style={delay(i, 'm-settle', 320)}
              onClick={() => update((d) => ({ ...d, gut: { ...d.gut, alternativeId: alt.id } }))}
            >
              <CircleNum n={i + 1} />
              <span className="pick__label">{alt.name}</span>
              {picked && <CheckIcon delayMs={0} />}
            </button>
          )
        })}
      </div>

      <div className="m-lift" style={{ marginTop: 28, ...delay(0, 'm-lift', 560) }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--soft)' }}>
          그 마음이 얼마나 기울었어요?
        </div>
        <Scale5
          name="마음이 기운 정도"
          value={gut.confidence}
          onChange={(v) => update((d) => ({ ...d, gut: { ...d.gut, confidence: v } }))}
          lowLabel="기울지 않았다"
          highLabel="이미 정했다"
        />
        <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.7, color: 'var(--soft)' }}>
          끌리는 게 없어도 괜찮아요. 나중에 나의 직감을 살펴보기 위해 사용됩니다.
        </p>
      </div>

      <div
        className="card m-settle"
        style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12, ...delay(0, 'm-settle', 640) }}
      >
        <LockIcon delayMs={780} />
        <span style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--soft)' }}>
          직감은 틀린 게 아니라 <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>또 하나의 정보</strong>
          예요. 결과와 다르면 그 지점을 같이 봅니다.
        </span>
      </div>
    </Paper>
  )
}
