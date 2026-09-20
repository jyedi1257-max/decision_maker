import { useMemo, useState } from 'react'
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
  const [dragging, setDragging] = useState<number | null>(null)

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
        위아래로 옮기면 됩니다. 가중치는 앱이 알아서 계산해요.
      </p>

      <ol className="stack" style={{ marginTop: 28, gap: 12, listStyle: 'none', padding: 0, margin: '28px 0 0' }}>
        {decision.criteria.map((criterion, i) => (
          <li
            key={criterion.id}
            className="row m-settle"
            draggable
            onDragStart={() => setDragging(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragging !== null) reorder(dragging, i)
              setDragging(null)
            }}
            onDragEnd={() => setDragging(null)}
            style={{
              padding: '19px 17px',
              gap: 14,
              opacity: dragging === i ? 0.5 : 1,
              ...delay(i, 'm-settle', 320),
            }}
          >
            <RankNum n={i + 1} delayMs={Math.min(520 + i * 100, 500)} />
            <span className="row__text" style={{ fontSize: 17, fontWeight: 600 }}>
              {criterion.name}
            </span>
            <ReorderHandle
              label={criterion.name}
              canUp={i > 0}
              canDown={i < decision.criteria.length - 1}
              onUp={() => reorder(i, i - 1)}
              onDown={() => reorder(i, i + 1)}
            />
          </li>
        ))}
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
