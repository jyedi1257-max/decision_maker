import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { FitBar, Title, TopBar } from '@/components/Controls'
import { delay } from '@/styles/motion'
import { evaluate } from '@/core/evaluate'
import { uncertainties } from '@/core/explain'
import { flipPointSentence, ordinalMark } from '@/core/narrate'
import { analyzeSensitivity } from '@/core/sensitivity'
import { EVIDENCE_LABEL } from '@/core/types'
import { useDecision } from '@/app/useDecision'

/**
 * 왜 이런 결과인지
 *
 * 기준마다 어디서 얼마나 벌어졌는지, 결과가 뒤집히는 지점, 남은 불확실성.
 * 숫자와 그래프는 여기(상세 보기) 안에만 둔다 (기획안 4.2).
 */
export function Why() {
  const { decision } = useDecision()

  const view = useMemo(() => {
    if (!decision) return null
    const result = evaluate(decision)
    const sensitivity = analyzeSensitivity(decision, result)
    return { result, sensitivity, unknowns: uncertainties(result, 2) }
  }, [decision])

  if (!decision || !view) return <Paper> </Paper>

  const { result, sensitivity, unknowns } = view
  const shown = result.ranked.slice(0, 2)
  if (shown.length === 0) return <Paper> </Paper>

  return (
    <Paper>
      <TopBar back={`/d/${decision.id}/result`} backLabel="결과로 돌아가기" center="자세히" />

      <div style={{ marginTop: 26 }}>
        <Title lines={['기준마다 어디서', '얼마나 벌어졌나']} size={24} />
      </div>

      <div className="stack" style={{ marginTop: 24, gap: 18 }}>
        {decision.criteria.map((criterion, ci) => (
          <div key={criterion.id} className="m-lift" style={delay(ci, 'm-lift', 240)}>
            <div className="barhead">
              <span style={{ fontSize: 14, fontWeight: 600 }}>{criterion.name}</span>
              <span style={{ fontSize: 12, color: 'var(--soft)', whiteSpace: 'nowrap' }}>
                비중 {ci + 1}순위
              </span>
            </div>
            {shown.map((alt, ai) => (
              <div
                key={alt.alternativeId}
                style={{ marginTop: ai === 0 ? 8 : 6, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span style={{ width: 18, fontSize: 12, color: 'var(--soft)' }}>
                  {ordinalMark(alt.ordinal)}
                </span>
                <span style={{ flexGrow: 1 }}>
                  <FitBar
                    ratio={alt.breakdown[ci]?.value ?? 0}
                    lead={ai === 0}
                    thin
                    delayMs={280 + ci * 60 + ai * 30}
                  />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="card m-settle" style={{ marginTop: 24, padding: 17, ...delay(0, 'm-settle', 560) }}>
        <div className="card__label">이 선을 넘으면 달라져요</div>
        <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.75 }}>
          {flipPointSentence(sensitivity)}
        </p>

        {sensitivity.weightFlip && (
          <>
            <div style={{ marginTop: 14, position: 'relative', height: 26 }} aria-hidden="true">
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 11,
                  width: '100%',
                  height: 4,
                  borderRadius: 999,
                  background: 'var(--rule)',
                }}
              />
              <span
                className="m-grow"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 11,
                  width: `${sensitivity.weightFlip.currentPosition * 100}%`,
                  height: 4,
                  borderRadius: 999,
                  background: 'var(--ink)',
                  ...delay(0, 'm-grow', 500),
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: `${sensitivity.weightFlip.currentPosition * 100}%`,
                  top: 4,
                  width: 18,
                  height: 18,
                  marginLeft: -9,
                  borderRadius: '50%',
                  background: 'var(--paper)',
                  border: '2px solid var(--ink)',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: `${sensitivity.weightFlip.flipPosition * 100}%`,
                  top: 0,
                  width: 2,
                  height: 26,
                  background: 'var(--pen)',
                }}
              />
            </div>
            <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--soft)' }}>
                ‘{sensitivity.weightFlip.criterionName}’의 무게
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-title)',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'var(--pen)',
                }}
              >
                여기부터{' '}
                {ordinalMark(
                  result.all.find((a) => a.alternativeId === sensitivity.weightFlip!.newLeaderId)
                    ?.ordinal ?? 1,
                )}
              </span>
            </div>
          </>
        )}
      </div>

      {unknowns.length > 0 && (
        <div className="card--dashed m-settle" style={{ marginTop: 12, padding: 17, ...delay(0, 'm-settle', 600) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="chip chip--sm">
              {unknowns[0]!.kind === 'missing' ? '빈 칸' : EVIDENCE_LABEL[unknowns[0]!.kind]}
            </span>
            <span className="meta">아직 확인 안 한 것 {unknowns.length}개</span>
          </div>
          <p style={{ margin: '9px 0 0', fontSize: 14, lineHeight: 1.7 }}>
            {uncertaintySentence(unknowns[0]!)}
          </p>
        </div>
      )}

      <div className="spacer" />

      <div className="stack" style={{ gap: 10 }}>
        <Link
          to={`/d/${decision.id}/explore`}
          className="btn btn--ghost m-lift"
          style={delay(0, 'm-lift', 660)}
        >
          진짜 내 마음은
        </Link>
        <Link
          to={`/d/${decision.id}/commit`}
          className="btn btn--primary m-lift"
          style={{ color: 'var(--paper)', ...delay(0, 'm-lift', 680) }}
        >
          이만하면 됐어요, 정할게요
        </Link>
      </div>
    </Paper>
  )
}

function uncertaintySentence(u: ReturnType<typeof uncertainties>[number]): string {
  const who = `${ordinalMark(u.alternativeOrdinal)}의 ‘${u.criterionName}’`
  const what =
    u.kind === 'missing'
      ? '아직 비워둔 칸이에요'
      : u.kind === 'estimate'
        ? '추정이에요'
        : '느낌이에요'
  const tail = u.matters
    ? '실제 정보를 확인하면 결과가 훨씬 단단해집니다.'
    : '실제 정보를 알아두면 좋아요.'
  return `${who}은 ${what}. ${tail}`
}
