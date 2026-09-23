import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { Scale5, Title, TopBar } from '@/components/Controls'
import { ArrowRightIcon } from '@/components/Icons'
import { Hilite } from '@/components/Ink'
import { delay } from '@/styles/motion'
import { ordinalMark } from '@/core/narrate'
import { localRepository } from '@/data/local'
import { useDecision } from '@/app/useDecision'
import { flushPendingSave } from '@/store/decisions'
import { formatFullDate } from '@/store/factory'
import type { Decision } from '@/core/types'
import { leanWords } from '@/copy/scale-words'

/**
 * 30일 뒤 회고
 *
 * 기획안 5.9 Decision Quality — 결과의 성공/실패는 운의 영향을 받으므로
 * 당시의 결정 과정을 따로 평가한다. 여기서는 만족도와 기준의 이동만 묻는다.
 */
export function Review() {
  const navigate = useNavigate()
  const { decision, update } = useDecision()
  const [history, setHistory] = useState<Decision[]>([])

  useEffect(() => {
    void localRepository.all().then(setHistory)
  }, [])

  const pattern = useMemo(() => patternSentence(history), [history])

  if (!decision) return <Paper> </Paper>

  const commit = decision.commit
  if (!commit) {
    return (
      <Paper
        footer={
          <button type="button" className="btn btn--primary" onClick={() => navigate(`/d/${decision.id}/result`)}>
            결과로 가기
          </button>
        }
      >
        <TopBar back="/" backLabel="홈으로" center="회고" />
        <div style={{ marginTop: 40 }}>
          <p className="empty">아직 확정하지 않은 결정이에요. 먼저 결정을 마무리해 주세요.</p>
        </div>
      </Paper>
    )
  }

  const chosen = decision.alternatives.find((a) => a.id === commit.alternativeId)
  const chosenOrdinal = decision.alternatives.findIndex((a) => a.id === commit.alternativeId) + 1
  const review = decision.review
  const thenTop = decision.criteria[0]
  const nowTopId = review?.topCriterionNow ?? null
  const nowTop = decision.criteria.find((c) => c.id === nowTopId) ?? null

  function patchReview(patch: Partial<NonNullable<Decision['review']>>) {
    update((d) => ({
      ...d,
      stage: 'reviewed',
      review: {
        satisfaction: null,
        topCriterionNow: null,
        reviewedAt: new Date().toISOString(),
        ...d.review,
        ...patch,
      },
    }))
  }

  async function save() {
    patchReview({ reviewedAt: new Date().toISOString() })
    await flushPendingSave()
    navigate('/')
  }

  return (
    <Paper
      footer={
        <div className="btnrow">
          <button
            type="button"
            className="btn btn--quiet m-lift"
            style={{ width: 118, ...delay(0, 'm-lift', 640) }}
            onClick={() => navigate('/')}
          >
            나중에
          </button>
          <button
            type="button"
            className="btn btn--primary m-lift"
            style={{ flexGrow: 1, ...delay(0, 'm-lift', 680) }}
            disabled={review?.satisfaction == null}
            onClick={save}
          >
            기록 남기기
          </button>
        </div>
      }
    >
      <TopBar back="/" backLabel="홈으로" center="회고" />

      <div style={{ marginTop: 32 }}>
        <Title lines={['한 달 전 그 결정,', '지금은 어때요?']} size={26} />
      </div>

      <div className="card m-settle" style={{ marginTop: 24, padding: 17, ...delay(0, 'm-settle', 260) }}>
        <div style={{ fontSize: 12, color: 'var(--soft)' }}>
          {formatFullDate(commit.committedAt)}
          {commit.confidence !== null && ` · ${leanWords(commit.confidence)}`}
        </div>
        <div style={{ marginTop: 8, fontFamily: 'var(--font-title)', fontSize: 19, fontWeight: 700 }}>
          {ordinalMark(chosenOrdinal)} {chosen?.name ?? '고른 선택지'}
        </div>
        {commit.reason.trim() !== '' && (
          <div
            style={{
              marginTop: 8,
              fontFamily: 'var(--font-title)',
              fontSize: 17,
              lineHeight: 1.6,
              color: 'var(--pen)',
            }}
          >
            “{commit.reason}”
          </div>
        )}
      </div>

      {decision.insight && (
        <div className="block m-settle" style={{ marginTop: 12, ...delay(0, 'm-settle', 320) }}>
          <p className="say" style={{ whiteSpace: 'pre-line' }}>
            무게를 움직여보며 이렇게 적으셨네요.{' '}
            <span style={{ color: 'var(--soft)' }}>“{decision.insight}”</span>
          </p>
        </div>
      )}

      <div className="m-lift" style={{ marginTop: 26, ...delay(0, 'm-lift', 380) }}>
        <p className="say" style={{ margin: 0, fontSize: 16, lineHeight: 1.85 }}>
          돌아보면, 그 결정은 어땠나요?
        </p>
        <Scale5
          name="돌아보면"
          value={review?.satisfaction ?? null}
          onChange={(v) => patchReview({ satisfaction: v })}
          lowLabel="별로였다"
          highLabel="잘한 선택이었다"
        />
      </div>

      {thenTop && decision.criteria.length > 1 && (
        <div className="block m-settle" style={{ marginTop: 24, ...delay(0, 'm-settle', 460) }}>
          <p className="say">그때 제일 무겁게 봤던 기준은 이거였어요.</p>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--soft)' }}>그때 1순위</div>
              <div style={{ marginTop: 4, fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>
                {thenTop.name}
              </div>
            </div>
            <ArrowRightIcon delayMs={560} />
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <label
                htmlFor="now-top"
                style={{ display: 'block', fontSize: 12, color: 'var(--soft)' }}
              >
                지금 1순위
              </label>
              <select
                id="now-top"
                value={nowTopId ?? ''}
                onChange={(e) => patchReview({ topCriterionNow: e.target.value || null })}
                style={{
                  marginTop: 4,
                  width: '100%',
                  minHeight: 44,
                  border: 0,
                  borderBottom: '1px solid var(--rule-ink)',
                  background: 'transparent',
                  fontFamily: 'var(--font-body)',
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--ink)',
                }}
              >
                <option value="">고르기</option>
                {decision.criteria.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {nowTop && (
            <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.7, color: 'var(--soft)' }}>
              {nowTop.id === thenTop.id
                ? '그때 본 게 지금도 맞았어요.'
                : '겪어보니 중요한 게 달라졌네요. 이게 다음 결정에서 제일 쓸모 있는 정보예요.'}
            </p>
          )}
        </div>
      )}

      {/* 회고가 쌓이기 전에는 패턴을 말하지 않는다 — 한 건으로 경향을 지어내지 않기 위해서다. */}
      {pattern && (
        <div className="block m-settle" style={{ marginTop: 14, ...delay(0, 'm-settle', 540) }}>
          <p className="say">
            마음이 크게 기울었던 결정{' '}
            <Hilite delayMs={620}>
              {pattern.total}개 중 {pattern.satisfied}개
            </Hilite>
            가 실제로도 괜찮았어요.
            {pattern.satisfied < pattern.total
              ? ' 마음이 덜 기울었을 때는 한 번 미루는 편이 나았습니다.'
              : ' 당신의 직감은 꽤 믿을 만한 편입니다.'}
          </p>
        </div>
      )}
    </Paper>
  )
}

/**
 * 마음이 크게 기울었던 결정이 실제로 괜찮았는지 (기획안 4.3 개인 의사결정 패턴).
 * 표본이 2건 미만이면 아무 말도 하지 않는다.
 */
function patternSentence(history: Decision[]): { total: number; satisfied: number } | null {
  const confident = history.filter(
    (d) => (d.commit?.confidence ?? 0) >= 4 && d.review?.satisfaction != null,
  )
  if (confident.length < 2) return null
  return {
    total: confident.length,
    satisfied: confident.filter((d) => (d.review?.satisfaction ?? 0) >= 4).length,
  }
}
