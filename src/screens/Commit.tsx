import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { Scale5, TopBar, WriteField } from '@/components/Controls'
import { InkPhrase } from '@/components/Ink'
import { delay } from '@/styles/motion'
import { evaluate } from '@/core/evaluate'
import type { CommitRecord } from '@/core/types'
import { ordinalMark } from '@/core/narrate'
import { useDecision } from '@/app/useDecision'
import { flushPendingSave } from '@/store/decisions'
import { formatFullDate, reviewDueDate } from '@/store/factory'
import { cancelReview, scheduleReview } from '@/platform/notify'

/**
 * 결정 확정
 *
 * 기획안 5.9 Decision Quality — "행동에 대한 실행 의지"가 좋은 결정의 여섯 요소 중 하나다.
 * 결정 버튼은 앱의 추천이 아니라 사용자의 행동이다 (기획안 10.3).
 */
export function Commit() {
  const navigate = useNavigate()
  const { decision, update } = useDecision()
  const [saving, setSaving] = useState(false)

  const leader = useMemo(() => {
    if (!decision) return null
    return evaluate(decision).ranked[0] ?? null
  }, [decision])

  if (!decision || !leader) return <Paper> </Paper>

  // 이미 확정했다면 그 내용을 그대로 고친다.
  const chosenId = decision.commit?.alternativeId ?? leader.alternativeId
  const chosen = decision.alternatives.find((a) => a.id === chosenId) ?? leader
  const chosenOrdinal = decision.alternatives.findIndex((a) => a.id === chosenId) + 1
  const reason = decision.commit?.reason ?? ''
  const confidence = decision.commit?.confidence ?? null
  const scheduled = decision.commit?.reviewScheduled ?? true
  const dueAt = decision.commit?.reviewDueAt ?? reviewDueDate().toISOString()
  const committedAt = decision.commit?.committedAt ?? new Date().toISOString()

  function patchCommit(patch: Partial<CommitRecord>) {
    update((d) => ({
      ...d,
      stage: 'committed',
      commit: {
        alternativeId: chosenId,
        reason,
        confidence,
        committedAt,
        reviewScheduled: scheduled,
        reviewDueAt: dueAt,
        ...d.commit,
        ...patch,
      },
    }))
  }

  async function toggleReview() {
    const next = !scheduled
    patchCommit({ reviewScheduled: next, reviewDueAt: next ? dueAt : null })
    if (next) await scheduleReview(decision!.id, decision!.question, new Date(dueAt))
    else await cancelReview(decision!.id)
  }

  async function finish() {
    if (saving) return
    setSaving(true)
    patchCommit({})
    if (scheduled) await scheduleReview(decision!.id, decision!.question, new Date(dueAt))
    await flushPendingSave()
    navigate('/')
  }

  return (
    <Paper>
      <TopBar back={`/d/${decision.id}/result`} center="마무리" />

      <h1 className="title" style={{ fontSize: 27, marginTop: 32 }}>
        <span className="m-write" style={delay(0, 'm-write', 80)}>
          {ordinalMark(chosenOrdinal)} {chosen.name},
        </span>
        <span className="m-write" style={delay(1, 'm-write', 80)}>
          이걸로 정합니다.
        </span>
      </h1>

      <div className="write m-lift" style={{ marginTop: 30, gap: 6, ...delay(0, 'm-lift', 280) }}>
        <WriteField
          id="reason"
          label="결국 무엇 때문이었나요"
          value={reason}
          fontSize={18}
          underlineDelayMs={320}
          hint="한 달 뒤의 내가 가장 궁금해할 한 줄이에요."
          onChange={(value) => patchCommit({ reason: value })}
        />
      </div>

      <div className="m-lift" style={{ marginTop: 26, ...delay(0, 'm-lift', 400) }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--soft)' }}>
          결과를 보니 마음이 기울었나요?
        </div>
        <Scale5
          name="마음이 기운 정도"
          value={confidence}
          onChange={(v) => patchCommit({ confidence: v })}
        />
        <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.7, color: 'var(--soft)' }}>
          결정을 눈으로 봤을 때, 생각만큼 마음이 안 갈 수도 있어요. 어떤 점이 마음에 걸리는지 다시 한 번
          생각해보세요.
        </p>
      </div>

      <div
        className="card m-settle"
        style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 14, padding: '15px 17px', ...delay(0, 'm-settle', 460) }}
      >
        <div style={{ flexGrow: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>30일 뒤에 다시 물어보기</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--soft)' }}>
            {formatFullDate(dueAt)} · 어땠는지만 한 번 체크
          </div>
        </div>
        <button
          type="button"
          className={`toggle${scheduled ? ' is-on' : ''}`}
          aria-pressed={scheduled}
          aria-label="30일 뒤 회고 알림 켜기"
          onClick={toggleReview}
        >
          <span className="toggle__knob" />
        </button>
      </div>

      <div className="m-lift" style={{ marginTop: 30, ...delay(0, 'm-lift', 500) }}>
        <div className="stamp m-stamp" style={delay(0, 'm-stamp', 560)}>
          <svg className="stamp__ring" width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
            <circle
              className="m-draw"
              cx="60"
              cy="60"
              r="55"
              stroke="var(--pen)"
              strokeWidth="2.6"
              style={{ strokeDasharray: 350, strokeDashoffset: 350, '--d': '520ms' } as object}
            />
          </svg>
          <InkPhrase phrase="stamp" size={34} className="stamp__word" />
          <span className="stamp__date">{formatFullDate(committedAt)}</span>
        </div>
      </div>

      <div className="spacer" />

      <button
        type="button"
        className="btn btn--primary m-lift"
        onClick={finish}
        disabled={saving}
        style={delay(0, 'm-lift', 680)}
      >
        기록하고 나가기
      </button>
    </Paper>
  )
}
