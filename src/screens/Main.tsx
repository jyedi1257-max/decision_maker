import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { InkFlourish, InkPhrase } from '@/components/Ink'
import { PlusIcon } from '@/components/Icons'
import { delay } from '@/styles/motion'
import { useDecisions } from '@/store/decisions'
import { daysUntil, formatDate } from '@/store/factory'
import { isSyncEnabled } from '@/data/sync'
import type { DecisionSummary } from '@/data/repository'

/** 홈 · 결정 노트 */
export function Main() {
  const navigate = useNavigate()
  const summaries = useDecisions((s) => s.summaries)
  const loading = useDecisions((s) => s.loading)
  const loadList = useDecisions((s) => s.loadList)
  const create = useDecisions((s) => s.create)
  const [synced, setSynced] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    void loadList()
    void isSyncEnabled().then(setSynced)
  }, [loadList])

  async function start() {
    if (starting) return
    setStarting(true)
    const decision = await create()
    navigate(`/d/${decision.id}/frame`)
  }

  return (
    <Paper ruled>
      <div className="eyebrow m-lift">결정 노트</div>

      <h1 className="title" style={{ fontSize: 29, marginTop: 16 }}>
        <span className="m-write" style={delay(0, 'm-write', 60)}>
          오늘은 어떤 걸
        </span>
        <span className="m-write" style={delay(1, 'm-write', 60)}>
          정하고 싶으세요?
        </span>
      </h1>

      <InkFlourish delayMs={300} />

      <button
        type="button"
        onClick={start}
        disabled={starting}
        className="btn btn--primary m-settle"
        style={{
          marginTop: 24,
          justifyContent: 'space-between',
          height: 60,
          padding: '0 20px',
          borderRadius: 16,
          ...delay(0, 'm-settle', 420),
        }}
      >
        <span>새 고민 펼치기</span>
        <PlusIcon size={20} color="var(--paper)" />
      </button>

      <div
        className="m-lift"
        style={{
          marginTop: 30,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          ...delay(0, 'm-lift', 500),
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--soft)' }}>
          지난 결정
        </span>
        <Link to="/settings" className="meta" style={{ color: 'var(--meta)' }}>
          {synced ? '다른 기기와 동기화 중' : '기기에만 저장됨'}
        </Link>
      </div>

      <div className="stack" style={{ marginTop: 14, gap: 12 }}>
        {loading && summaries.length === 0 ? null : summaries.length === 0 ? (
          <p className="empty m-settle" style={delay(0, 'm-settle', 540)}>
            아직 펼친 고민이 없어요. 머릿속에 있는 걸 한 문장으로 적는 것부터 시작합니다.
          </p>
        ) : (
          summaries.map((summary, i) => (
            <DecisionCard key={summary.id} summary={summary} index={i} />
          ))
        )}
      </div>

      <div className="spacer" />

      <InkPhrase
        phrase="home"
        size={31}
        rotate={-3}
        className="m-lift"
        style={{ alignSelf: 'flex-end', ...delay(0, 'm-lift', 680) }}
      />
    </Paper>
  )
}

/** 결정 하나의 현재 상태를 한 줄로 요약한다. */
function DecisionCard({ summary, index }: { summary: DecisionSummary; index: number }) {
  const { badge, badgeTone } = statusBadge(summary)

  return (
    <Link
      to={resumePath(summary)}
      className="card m-settle"
      style={{ color: 'inherit', display: 'block', ...delay(index, 'm-settle', 540) }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 600, overflowWrap: 'anywhere' }}>
          {summary.question.trim() === '' ? '제목 없는 고민' : summary.question}
        </span>
        <span className={`chip chip--sm${badgeTone === 'accent' ? ' chip--pass' : ''}`}>{badge}</span>
      </div>
      <div style={{ marginTop: 7, fontSize: 12, color: 'var(--soft)' }}>{subtitle(summary)}</div>
    </Link>
  )
}

function statusBadge(s: DecisionSummary): { badge: string; badgeTone: 'neutral' | 'accent' } {
  if (s.satisfaction !== null) return { badge: `만족 ${s.satisfaction}`, badgeTone: 'neutral' }
  if (s.committedAt && s.reviewDueAt) {
    const days = daysUntil(s.reviewDueAt)
    if (days <= 0) return { badge: '회고할 때', badgeTone: 'accent' }
    return { badge: `회고 D-${days}`, badgeTone: 'neutral' }
  }
  if (s.committedAt) return { badge: '확정됨', badgeTone: 'neutral' }
  return { badge: '진행 중', badgeTone: 'accent' }
}

function subtitle(s: DecisionSummary): string {
  if (s.committedAt) {
    const parts = [`${formatDate(s.committedAt)} 확정`, `기준 ${s.criteriaCount}개`]
    if (s.confidence !== null) parts.push(`확신 ${s.confidence}`)
    if (s.satisfaction !== null) parts.push('회고 완료')
    return parts.join(' · ')
  }
  if (s.criteriaCount > 0) return `기준 ${s.criteriaCount}개까지 적음 · 평가 전`
  if (s.alternativesCount > 0) return `후보 ${s.alternativesCount}개까지 적음`
  return '이제 막 펼침'
}

/** 멈춘 자리로 돌려보낸다. */
function resumePath(s: DecisionSummary): string {
  if (s.satisfaction !== null) return `/d/${s.id}/review`
  if (s.committedAt) {
    return daysUntil(s.reviewDueAt ?? '') <= 0 ? `/d/${s.id}/review` : `/d/${s.id}/result`
  }
  const stage = s.stage === 'result' || s.stage === 'committed' ? 'result' : s.stage
  return `/d/${s.id}/${stage}`
}
