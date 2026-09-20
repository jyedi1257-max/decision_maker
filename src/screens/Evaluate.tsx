import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { Score5, StepBar, Title, TopBar } from '@/components/Controls'
import { CautionIcon } from '@/components/Icons'
import { delay } from '@/styles/motion'
import { evaluationCells } from '@/core/evaluate'
import { EVIDENCE_LABEL, scoreKey, type Evidence } from '@/core/types'
import { ordinalMark } from '@/core/narrate'
import { useDecision } from '@/app/useDecision'
import { flushPendingSave } from '@/store/decisions'
import { prevPath, stepNumber } from '@/store/factory'

const SCORE_LABELS = ['매우 불만족', '불만족', '보통', '만족', '매우 만족'] as const
const EVIDENCES: Evidence[] = ['fact', 'estimate', 'feeling']

/** 한 칸당 대략 이만큼 걸린다고 보고 남은 시간을 어림한다. */
const SECONDS_PER_CELL = 20

/**
 * 7 · 평가
 *
 * 한 화면에 한 판단만 둔다 (기획안 3.2 "한 화면 = 한 판단").
 * 사실/추정/느낌을 구분해 두고, 그 표시가 결과의 "남은 불확실성"으로 이어진다.
 */
export function Evaluate() {
  const navigate = useNavigate()
  const { decision, update } = useDecision()
  const [index, setIndex] = useState(0)

  const cells = useMemo(() => (decision ? evaluationCells(decision) : []), [decision])
  if (!decision) return <Paper> </Paper>

  const cell = cells[Math.min(index, cells.length - 1)]
  if (!cell) return <Paper> </Paper>

  const alternative = decision.alternatives.find((a) => a.id === cell.alternativeId)!
  const criterion = decision.criteria.find((c) => c.id === cell.criterionId)!
  const criterionIndex = decision.criteria.findIndex((c) => c.id === cell.criterionId)
  const alternativeIndex = decision.alternatives.findIndex((a) => a.id === cell.alternativeId)
  const score = decision.scores[scoreKey(cell.alternativeId, cell.criterionId)]

  const done = index
  const remaining = cells.length - done
  const isLast = index >= cells.length - 1

  function setScore(value: number | null) {
    update((d) => ({
      ...d,
      scores: {
        ...d.scores,
        [scoreKey(cell!.alternativeId, cell!.criterionId)]: {
          value,
          evidence: d.scores[scoreKey(cell!.alternativeId, cell!.criterionId)]?.evidence ?? null,
        },
      },
    }))
  }

  function setEvidence(evidence: Evidence) {
    update((d) => {
      const key = scoreKey(cell!.alternativeId, cell!.criterionId)
      const existing = d.scores[key]
      return {
        ...d,
        scores: {
          ...d.scores,
          [key]: {
            value: existing?.value ?? null,
            evidence: existing?.evidence === evidence ? null : evidence,
          },
        },
      }
    })
  }

  async function advance() {
    if (!isLast) {
      setIndex((i) => i + 1)
      return
    }
    update((d) => ({ ...d, stage: 'result' }))
    await flushPendingSave()
    navigate(`/d/${decision!.id}/result`)
  }

  function skip() {
    setScore(null)
    void advance()
  }

  function back() {
    if (index > 0) setIndex((i) => i - 1)
    else navigate(prevPath(decision!.id, 'evaluate'))
  }

  return (
    <Paper>
      <TopBar
        onBack={back}
        backLabel={index > 0 ? '앞 문항으로' : '뒤로'}
        center={`${stepNumber('evaluate')} / 7`}
        right={<span className="meta">저장됨</span>}
      />
      <StepBar step={stepNumber('evaluate')} />

      <div
        className="m-lift"
        style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', ...delay(0, 'm-lift', 80) }}
      >
        <span style={{ fontSize: 12, color: 'var(--soft)' }}>
          평가 {done + 1} / {cells.length}
        </span>
        <span className="meta">약 {Math.max(1, Math.round((remaining * SECONDS_PER_CELL) / 10) * 10)}초 남음</span>
      </div>
      <div className="progress">
        <span
          className="progress__fill m-grow"
          style={{ width: `${((done + 1) / cells.length) * 100}%`, ...delay(0, 'm-grow', 160) }}
        />
      </div>

      <div className="m-lift" style={{ marginTop: 36, ...delay(0, 'm-lift', 200) }}>
        <span style={{ fontSize: 12, letterSpacing: '0.08em', color: 'var(--soft)' }}>
          기준 {criterionIndex + 1} · {criterion.name}
        </span>
      </div>

      <div style={{ marginTop: 12 }}>
        <Title
          key={`${cell.alternativeId}:${cell.criterionId}`}
          lines={[
            `${ordinalMark(alternativeIndex + 1)} ${alternative.name},`,
            `‘${criterion.name}’에 몇 점을 줄까요?`,
          ]}
          size={26}
          base={240}
        />
      </div>

      <div className="m-lift" style={{ marginTop: 30, ...delay(0, 'm-lift', 420) }}>
        <Score5 value={score?.value ?? null} onChange={setScore} labels={SCORE_LABELS} />
      </div>
      <div className="scale5__ends m-lift" style={delay(0, 'm-lift', 480)}>
        <span>{SCORE_LABELS[0]}</span>
        <span>{SCORE_LABELS[4]}</span>
      </div>

      <div className="m-lift" style={{ marginTop: 30, ...delay(0, 'm-lift', 540) }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--soft)' }}>
          그렇게 생각한 근거가 뭐예요?
        </div>
        <div className="btnrow" style={{ marginTop: 12, gap: 8 }} role="group" aria-label="점수의 근거">
          {EVIDENCES.map((evidence) => {
            const picked = score?.evidence === evidence
            return (
              <button
                key={evidence}
                type="button"
                aria-pressed={picked}
                className="btn--answer"
                style={
                  picked
                    ? {
                        border: '2px solid var(--accent)',
                        background: 'var(--chip-accent)',
                        color: 'var(--accent)',
                        fontWeight: 600,
                      }
                    : undefined
                }
                onClick={() => setEvidence(evidence)}
              >
                {EVIDENCE_LABEL[evidence]}
              </button>
            )
          })}
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 12, lineHeight: 1.7, color: 'var(--soft)' }}>
          내 판단이 어떤 정보에 기반하고 있는지 알아보면, 내가 놓친 정보나 다시 확인해볼 부분을 찾을 수
          있어요.
        </p>
      </div>

      <div
        className="card--dashed m-settle"
        style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 10, ...delay(0, 'm-settle', 600) }}
      >
        <CautionIcon />
        <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--soft)' }}>
          잘 모르겠으면 비워두세요. 빈 칸도 결과에 반영됩니다.
        </span>
      </div>

      <div className="spacer" />

      <div className="btnrow">
        <button
          type="button"
          className="btn btn--quiet m-lift"
          style={{ width: 100, ...delay(0, 'm-lift', 640) }}
          onClick={skip}
        >
          건너뛰기
        </button>
        <button
          type="button"
          className="btn btn--primary m-lift"
          style={{ flexGrow: 1, ...delay(0, 'm-lift', 680) }}
          onClick={advance}
        >
          {isLast ? '결과 보기' : '다음 평가'}
        </button>
      </div>
    </Paper>
  )
}
