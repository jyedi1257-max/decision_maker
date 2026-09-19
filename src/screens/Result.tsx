import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { FitBar, TopBar } from '@/components/Controls'
import { ArrowDownIcon, ArrowUpIcon } from '@/components/Icons'
import { Hilite } from '@/components/Ink'
import { delay } from '@/styles/motion'
import { evaluate, fitLabel } from '@/core/evaluate'
import { gutConflict } from '@/core/explain'
import { conclusionSentence, differenceRows, ordinalMark, robustnessSentence, gutConflictSentence } from '@/core/narrate'
import { analyzeSensitivity } from '@/core/sensitivity'
import { useDecision } from '@/app/useDecision'

/**
 * 결과
 *
 * 기획안 4.2 — 첫 시선은 "현재 기준에서는 A가 조금 더 잘 맞아요" → 막대 → 차이를 만든 기준.
 * 총점 숫자는 내보내지 않는다 (디자인 §9).
 */
export function Result() {
  const { decision } = useDecision()

  const view = useMemo(() => {
    if (!decision) return null
    const result = evaluate(decision)
    const sensitivity = analyzeSensitivity(decision, result)
    return {
      result,
      sensitivity,
      conclusion: conclusionSentence(result, sensitivity),
      differences: differenceRows(result),
      conflict: gutConflict(result, decision.gut.alternativeId),
    }
  }, [decision])

  if (!decision || !view) return <Paper> </Paper>

  const { result, sensitivity, conclusion, differences, conflict } = view
  const top = result.ranked[0]
  const best = result.ranked.reduce((m, a) => Math.max(m, a.fit), 0.0001)

  if (!top || !conclusion) {
    return (
      <Paper>
        <TopBar back={`/d/${decision.id}/must`} center="결과" />
        <div style={{ marginTop: 40 }}>
          <p className="empty">
            필수조건을 지키는 후보가 남지 않았어요. 조건을 다시 보거나 후보를 더 적어주세요.
          </p>
        </div>
        <div className="spacer" />
        <Link to={`/d/${decision.id}/must`} className="btn btn--primary">
          필수조건 다시 보기
        </Link>
      </Paper>
    )
  }

  return (
    <Paper>
      <TopBar back={`/d/${decision.id}/evaluate`} center="결과" />

      <div className="m-lift" style={{ marginTop: 34, fontSize: 13, color: 'var(--soft)', ...delay(0, 'm-lift', 80) }}>
        지금 적은 기준에서는
      </div>

      <h1 className="title" style={{ fontSize: 28, marginTop: 10 }}>
        <span className="m-write" style={delay(0, 'm-write', 160)}>
          {/* 형광펜은 화면당 한 곳만 (§1) */}
          <Hilite delayMs={540}>{conclusion.lead}</Hilite>
          {conclusion.particle}
        </span>
        <span className="m-write" style={delay(1, 'm-write', 160)}>
          {conclusion.tail}
        </span>
      </h1>

      <div className="stack" style={{ marginTop: 26, gap: 16 }}>
        {result.ranked.map((alt, i) => {
          const lead = i === 0
          return (
            <div key={alt.alternativeId} className="m-lift" style={delay(i, 'm-lift', 520)}>
              <div className="barhead">
                <span style={{ fontSize: 14, fontWeight: lead ? 700 : 500 }}>
                  {ordinalMark(alt.ordinal)} {alt.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: lead ? 'var(--accent)' : 'var(--soft)',
                    fontWeight: lead ? 600 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  적합도 {fitLabel(alt.fit)}
                </span>
              </div>
              <FitBar ratio={alt.fit / best} lead={lead} delayMs={560 + i * 60} />
            </div>
          )
        })}
      </div>

      {differences.length > 0 && (
        <div className="card m-settle" style={{ marginTop: 26, padding: 17, ...delay(0, 'm-settle', 620) }}>
          <div className="card__label">
            차이를 만든 건 {differences.length === 1 ? '한 가지' : '두 가지'}
          </div>
          <div className="stack" style={{ marginTop: 14, gap: 12 }}>
            {differences.map(({ maker, text }) => (
              <div key={maker.criterion.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {maker.favorsLeader ? <ArrowUpIcon /> : <ArrowDownIcon />}
                <span style={{ flexGrow: 1, fontSize: 15 }}>{maker.criterion.name}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    color: maker.favorsLeader ? 'var(--accent)' : 'var(--pen)',
                  }}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 민감도는 그래프 전에 문장으로 (기획안 6.7) */}
      <div
        className="m-settle"
        style={{
          marginTop: 12,
          padding: '15px 17px',
          border: '1px solid var(--line-soft)',
          borderRadius: 14,
          ...delay(0, 'm-settle', 640),
        }}
      >
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75 }}>{robustnessSentence(sensitivity)}</p>
      </div>

      {conflict && (
        <div
          className="card--note m-settle"
          style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', ...delay(0, 'm-settle', 660) }}
        >
          <span
            style={{
              fontFamily: 'var(--font-title)',
              fontWeight: 700,
              fontSize: 15,
              color: 'var(--pen)',
              whiteSpace: 'nowrap',
            }}
          >
            처음 마음은 {ordinalMark(conflict.ordinal)}
          </span>
          <span style={{ flexGrow: 1, fontSize: 13, lineHeight: 1.6, color: 'var(--soft)' }}>
            {gutConflictSentence()}
          </span>
        </div>
      )}

      {/*
        머리와 마음이 갈렸을 때 가장 쓸모 있는 건 앱의 진단이 아니라 직접 만져보는 것이다.
        갈리지 않았을 때도 들어갈 수 있게 자세히 화면에 같은 입구를 둔다.
      */}
      {conflict && (
        <Link
          to={`/d/${decision.id}/explore`}
          className="btn--link m-lift"
          style={{ alignSelf: 'flex-start', marginTop: 6, ...delay(0, 'm-lift', 680) }}
        >
          무게를 직접 움직여보기 →
        </Link>
      )}

      <div className="spacer" />

      <div className="btnrow">
        <Link
          to={`/d/${decision.id}/why`}
          className="btn btn--ghost m-lift"
          style={{ width: 118, ...delay(0, 'm-lift', 680) }}
        >
          왜 이렇죠?
        </Link>
        <Link
          to={`/d/${decision.id}/commit`}
          className="btn btn--primary m-lift"
          style={{ flexGrow: 1, color: 'var(--paper)', ...delay(0, 'm-lift', 680) }}
        >
          이걸로 정하기
        </Link>
      </div>
    </Paper>
  )
}
