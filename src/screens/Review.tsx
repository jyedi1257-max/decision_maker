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
      <Paper>
        <TopBar back="/" backLabel="홈으로" center="회고" />
        <div style={{ marginTop: 40 }}>
          <p className="empty">아직 확정하지 않은 결정이에요. 먼저 결정을 마무리해 주세요.</p>
        </div>
        <div className="spacer" />
        <button type="button" className="btn btn--primary" onClick={() => navigate(`/d/${decision.id}/result`)}>
          결과로 가기
        </button>
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
    <Paper>
      <TopBar back="/" backLabel="홈으로" center="회고" />

      <div style={{ marginTop: 32 }}>
        <Title lines={['한 달 전 그 결정,', '지금은 어때요?']} size={26} />
      </div>

      <div className="card m-settle" style={{ marginTop: 24, padding: 17, ...delay(0, 'm-settle', 260) }}>
        <div style={{ fontSize: 12, color: 'var(--soft)' }}>
          {formatFullDate(commit.committedAt)}
          {commit.confidence !== null && ` · 확신 ${commit.confidence}`}
        </div>
        <div style={{ marginTop: 8, fontFamily: 'var(--font-title)', fontSize: 19, fontWeight: 700 }}>
          {ordinalMark(chosenOrdinal)} {chosen?.name ?? '고른 후보'}
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

      <div className="m-lift" style={{ marginTop: 26, ...delay(0, 'm-lift', 380) }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--soft)' }}>지금 만족도</div>
        <Scale5
          name="만족도"
          value={review?.satisfaction ?? null}
          onChange={(v) => patchReview({ satisfaction: v })}
          lowLabel="아쉽다"
          highLabel="잘했다"
        />
      </div>

      {thenTop && decision.criteria.length > 1 && (
        <div className="card m-settle" style={{ marginTop: 24, padding: 17, ...delay(0, 'm-settle', 460) }}>
          <div className="card__label">그때와 지금</div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
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
                ? '무게가 그대로예요. 그때의 기준이 지금도 맞았습니다.'
                : '살아보니 무게가 옮겨갔어요. 다음 결정에서 참고할 수 있게 기록해 둡니다.'}
            </p>
          )}
        </div>
      )}

      {/* 회고가 쌓이기 전에는 패턴을 말하지 않는다 — 한 건으로 경향을 지어내지 않기 위해서다. */}
      {pattern && (
        <div className="card--dashed m-settle" style={{ marginTop: 14, padding: 17, ...delay(0, 'm-settle', 540) }}>
          <div className="card__label">지금까지 모인 패턴</div>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.8 }}>
            확신이 4 이상이던 결정{' '}
            <Hilite delayMs={620}>
              {pattern.total}개 중 {pattern.satisfied}개
            </Hilite>
            가 만족도 4 이상이었어요.
            {pattern.satisfied < pattern.total
              ? ' 확신이 낮을 때는 결정을 한 번 미루는 편이 나았습니다.'
              : ' 확신이 높았던 판단은 지금까지 잘 맞았습니다.'}
          </p>
        </div>
      )}

      <div className="spacer" />

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
    </Paper>
  )
}

/**
 * 확신이 높았던 결정이 실제로 만족스러웠는지 (기획안 4.3 개인 의사결정 패턴).
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
