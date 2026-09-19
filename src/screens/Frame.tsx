import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { InkUnderline } from '@/components/Ink'
import { StepBar, Title, TopBar } from '@/components/Controls'
import { delay } from '@/styles/motion'
import { useDecision } from '@/app/useDecision'
import { flushPendingSave } from '@/store/decisions'
import { nextPath, prevPath, stepNumber } from '@/store/factory'

/** 1 · 고민 한 문장 — Decision Quality의 frame (기획안 5.9) */
export function Frame() {
  const navigate = useNavigate()
  const { decision, update } = useDecision()
  if (!decision) return <Paper> </Paper>

  const ready = decision.question.trim().length > 0

  async function next() {
    update((d) => ({ ...d, stage: 'alternatives' }))
    await flushPendingSave()
    navigate(nextPath(decision!.id, 'frame'))
  }

  return (
    <Paper>
      <TopBar
        back={prevPath(decision.id, 'frame')}
        center={`${stepNumber('frame')} / 7`}
        right={<span className="meta">저장됨</span>}
      />
      <StepBar step={stepNumber('frame')} />

      <div style={{ marginTop: 44 }}>
        <Title lines={['무엇 때문에', '고민하고 있어요?']} size={27} />
      </div>

      <div className="write" style={{ marginTop: 38 }}>
        <label className="write__label" htmlFor="question">
          고민 한 문장
        </label>
        <div className="write__line">
          <input
            id="question"
            type="text"
            className="write__input"
            placeholder="가을에 이사할까, 지금 집에 더 살까"
            value={decision.question}
            autoComplete="off"
            onChange={(e) => update((d) => ({ ...d, question: e.target.value }))}
          />
          {!ready && <span className="write__caret m-caret" style={delay(0, 'm-write', 760)} />}
        </div>
        <InkUnderline delayMs={300} />
      </div>

      <p className="lede m-lift" style={{ marginTop: 20, ...delay(0, 'm-lift', 620) }}>
        한 문장이면 충분해요. 나중에 언제든 고칠 수 있습니다.
      </p>

      <div className="card--dashed m-settle" style={{ marginTop: 24, ...delay(0, 'm-settle', 640) }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 15, fontWeight: 700, color: 'var(--pen)' }}>
          이런 문장도 좋아요
        </div>
        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.7, color: 'var(--soft)' }}>
          “대학원을 올해 갈까, 2년 뒤에 갈까”
          <br />
          “지금 차를 바꿀까, 2년 더 탈까”
        </div>
      </div>

      <div className="spacer" />

      <button
        type="button"
        className="btn btn--primary m-lift"
        disabled={!ready}
        onClick={next}
        style={delay(0, 'm-lift', 680)}
      >
        후보 적기
      </button>
    </Paper>
  )
}
