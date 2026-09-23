import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { StepBar, Title, TopBar, WriteField } from '@/components/Controls'
import { delay } from '@/styles/motion'
import { questionExamples, questionPlaceholder } from '@/copy/examples'
import { useDecision } from '@/app/useDecision'
import { flushPendingSave } from '@/store/decisions'
import { nextPath, prevPath, stepNumber, STEP_COUNT } from '@/store/factory'

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
    <Paper
      footer={
        <button
          type="button"
          className="btn btn--primary m-lift"
          disabled={!ready}
          onClick={next}
          style={delay(0, 'm-lift', 680)}
        >
          선택지 적기
        </button>
      }
    >
      <TopBar
        back={prevPath(decision.id, 'frame')}
        center={`${stepNumber('frame')} / ${STEP_COUNT}`}
      />
      <StepBar step={stepNumber('frame')} />

      <div style={{ marginTop: 44 }}>
        <Title lines={['어떤 걸 고민하고 있어요?']} size={27} />
      </div>

      <div className="write" style={{ marginTop: 38 }}>
        <WriteField
          id="question"
          label="고민 한 문장"
          value={decision.question}
          placeholder={questionPlaceholder(decision.id)}
          onChange={(value) => update((d) => ({ ...d, question: value }))}
        />
      </div>

      <p className="lede m-lift" style={{ marginTop: 20, ...delay(0, 'm-lift', 620) }}>
        정확하지 않아도 괜찮아요. 적고 나면 또렷해집니다.
      </p>

      <div className="card--dashed m-settle" style={{ marginTop: 24, ...delay(0, 'm-settle', 640) }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 15, fontWeight: 700, color: 'var(--pen)' }}>
          예를 들면
        </div>
        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.7, color: 'var(--soft)' }}>
          {questionExamples(decision.id).map((example, i) => (
            <span key={example} style={{ display: 'block' }}>
              {i > 0 && <br />}“{example}”
            </span>
          ))}
        </div>
      </div>
    </Paper>
  )
}
