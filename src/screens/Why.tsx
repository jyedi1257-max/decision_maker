import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { Title, TopBar } from '@/components/Controls'
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
 * 결과가 뒤집히는 지점과 남은 불확실성.
 * 숫자와 그래프는 여기(상세 보기) 안에만 둔다 (기획안 4.2).
 *
 * 기준별 막대 비교는 뺐다. 같은 내용을 '내가 매긴 표'가 더 잘 보여주고,
 * 두 화면이 같은 말을 하면 어느 쪽도 자기 할 말이 없어진다.
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
  if (result.ranked.length === 0) return <Paper> </Paper>

  return (
    <Paper
      footer={
        <div className="stack" style={{ gap: 10 }}>
          <Link
            to={`/d/${decision.id}/explore`}
            className="btn btn--ghost m-lift"
            style={delay(0, 'm-lift', 660)}
          >
            무엇이 중요한지 직접 조정해보기
          </Link>
          <Link
            to={`/d/${decision.id}/commit`}
            className="btn btn--primary m-lift"
            style={{ color: 'var(--paper)', ...delay(0, 'm-lift', 680) }}
          >
            이만하면 됐어요, 정할게요
          </Link>
        </div>
      }
    >
      <TopBar back={`/d/${decision.id}/result`} backLabel="결과로 돌아가기" center="자세히" />

      <div style={{ marginTop: 26 }}>
        <Title lines={['이 결과가', '얼마나 단단한가']} size={24} />
      </div>

      <div className="block m-settle" style={{ marginTop: 24, ...delay(0, 'm-settle', 240) }}>
        <p className="say">{flipPointSentence(sensitivity)}</p>

        {sensitivity.weightFlip && (
          <>
            {/* 만질 수 있는 슬라이더처럼 보이면 안 된다 — 손잡이 없이 눈금만 둔다.
                직접 움직이는 건 '직접 조정해보기'의 몫이다. */}
            <div style={{ marginTop: 14, position: 'relative', height: 42 }} aria-hidden="true">
              <span
                className="meta"
                style={{
                  position: 'absolute',
                  left: `${sensitivity.weightFlip.currentPosition * 100}%`,
                  top: 0,
                  transform: 'translateX(-50%)',
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                }}
              >
                지금
              </span>
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 27,
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
                  top: 27,
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
                  top: 19,
                  width: 2,
                  height: 20,
                  marginLeft: -1,
                  background: 'var(--ink)',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: `${sensitivity.weightFlip.flipPosition * 100}%`,
                  top: 16,
                  width: 2,
                  height: 26,
                  marginLeft: -1,
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
