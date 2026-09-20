import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { FitBar, Title, TopBar } from '@/components/Controls'
import { delay } from '@/styles/motion'
import { evaluate, fitLabel, weightsFor } from '@/core/evaluate'
import { ordinalMark } from '@/core/narrate'
import { normalizeWeights } from '@/core/weights'
import { useDecision } from '@/app/useDecision'
import { flushPendingSave } from '@/store/decisions'

/**
 * 직접 움직여보기
 *
 * 앱이 "당신의 진짜 기준은 이것입니다"라고 진단하지 않는다. 대신 무게를 손에 쥐여주고,
 * 움직이는 동안 결과가 어떻게 흔들리는지 보게 한다. 깨달음은 사용자 쪽에서 온다
 * (기획안 8.1 원칙 7 Human decides, 1.3 가시화).
 *
 * 머리와 마음이 갈릴 때 원인은 보통 둘 중 하나다 — 기준의 무게를 실제와 다르게 놓았거나,
 * 정말 중요한 기준을 아예 적지 않았거나. 여기서 둘 다 만져볼 수 있다.
 *
 * 숫자는 여전히 내보내지 않는다 (디자인 §9). 무게는 막대 길이와 말로만 읽힌다.
 */
export function Explore() {
  const navigate = useNavigate()
  const { decision, update } = useDecision()

  /*
   * 슬라이더는 서로 견주는 '원시 눈금'(1~100)을 잡는다. 합을 1로 맞추는 건 계산할 때만 한다.
   * 슬라이더 값 자체를 정규화해 되돌리면, 끝까지 밀었는데 손잡이가 튕겨 돌아온다.
   */
  const [draft, setDraft] = useState<number[] | null>(null)
  const [touched, setTouched] = useState<Set<number>>(() => new Set())
  const [note, setNote] = useState<string | null>(null)

  const saved = useMemo(() => (decision ? weightsFor(decision) : []), [decision])
  const savedTicks = useMemo(() => saved.map(toTick), [saved])

  useEffect(() => {
    if (decision && draft === null) setDraft(savedTicks)
    if (decision && note === null) setNote(decision.insight ?? '')
  }, [decision, draft, note, savedTicks])

  const weights = useMemo(() => (draft ? normalizeWeights(draft) : []), [draft])
  const before = useMemo(() => (decision ? evaluate(decision) : null), [decision])
  const after = useMemo(
    () => (decision && weights.length > 0 ? evaluate(decision, weights) : null),
    [decision, weights],
  )

  if (!decision || !draft || !before || !after || note === null) return <Paper> </Paper>

  const leaderBefore = before.ranked[0]
  const leaderAfter = after.ranked[0]
  const flipped = Boolean(leaderBefore && leaderAfter && leaderBefore.alternativeId !== leaderAfter.alternativeId)
  const moved = draft.some((tick, i) => tick !== savedTicks[i])
  const best = after.ranked.reduce((m, a) => Math.max(m, a.fit), 0.0001)

  /** 움직인 손잡이만 그 자리에 둔다. 나머지 눈금은 그대로고, 비율은 계산할 때 맞춘다. */
  function setTick(index: number, tick: number) {
    setDraft((current) => {
      if (!current) return current
      const next = current.slice()
      next[index] = Math.max(1, Math.min(100, tick))
      return next
    })
    setTouched((current) => new Set(current).add(index))
  }

  function reset() {
    setDraft(savedTicks)
    setTouched(new Set())
  }

  async function apply() {
    update((d) => ({ ...d, weightOverride: normalizeWeights(draft!), insight: note!.trim() || null }))
    await flushPendingSave()
    navigate(`/d/${decision!.id}/result`)
  }

  async function saveNoteOnly() {
    update((d) => ({ ...d, insight: note!.trim() || null }))
    await flushPendingSave()
    navigate(`/d/${decision!.id}/result`)
  }

  return (
    <Paper>
      <TopBar back={`/d/${decision.id}/why`} backLabel="자세히로 돌아가기" center="무엇이 중요한지 직접 조정해보기" />

      <div style={{ marginTop: 26 }}>
        <Title lines={['무게를 바꾸면', '결과가 어떻게 바뀔까']} size={24} />
      </div>
      <p className="lede m-lift" style={delay(0, 'm-lift', 240)}>
        앱이 정해준 무게가 마음과 다르면, 여기서 직접 밀어보세요. 적용하기 전까지는 아무것도 바뀌지 않아요.
      </p>

      {/* ── 무게 손잡이 ─────────────────────────────── */}
      <div className="tune" style={{ marginTop: 26 }}>
        {decision.criteria.map((criterion, i) => {
          const tick = draft[i] ?? 1
          const wasChanged = touched.has(i) && tick !== savedTicks[i]
          return (
            <div key={criterion.id} className="tune__row m-lift" style={delay(i, 'm-lift', 300)}>
              <div className="tune__head">
                <span className="tune__name">{criterion.name}</span>
                <span className={`tune__weight${wasChanged ? ' is-moved' : ''}`}>
                  {weightWord(weights[i] ?? 0, draft.length)}
                  {wasChanged && ' · 바꿈'}
                </span>
              </div>
              <input
                type="range"
                className="tune__slider"
                min={1}
                max={100}
                step={1}
                value={tick}
                aria-label={`${criterion.name}의 무게`}
                aria-valuetext={weightWord(weights[i] ?? 0, draft.length)}
                onChange={(e) => setTick(i, Number(e.target.value))}
              />
            </div>
          )
        })}
        <div className="tune__ends" style={{ marginTop: 0 }}>
          <span>거의 안 봄</span>
          <span>제일 중요</span>
        </div>
      </div>

      {/* ── 지금 이 무게로 보면 ─────────────────────── */}
      <div className="card" style={{ marginTop: 26, padding: 17 }}>
        <div className="card__label">이렇게 보면</div>
        <div className="stack" style={{ marginTop: 14, gap: 14 }}>
          {after.ranked.map((alt, i) => (
            <div key={alt.alternativeId}>
              <div className="barhead">
                <span style={{ fontSize: 14, fontWeight: i === 0 ? 700 : 500 }}>
                  {ordinalMark(alt.ordinal)} {alt.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    fontWeight: i === 0 ? 600 : 400,
                    color: i === 0 ? 'var(--accent)' : 'var(--soft)',
                  }}
                >
                  적합도 {fitLabel(alt.fit)}
                </span>
              </div>
              <FitBar ratio={alt.fit / best} lead={i === 0} />
            </div>
          ))}
        </div>
      </div>

      <div className={`flipbox${flipped ? '' : ' flipbox--same'}`} style={{ marginTop: 12 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75 }}>
          {flipped ? (
            <>
              여기선{' '}
              <strong style={{ color: 'var(--pen)' }}>
                {ordinalMark(leaderAfter!.ordinal)} {leaderAfter!.name}
              </strong>
              로 바뀌네요.
            </>
          ) : moved ? (
            <>
              꽤 움직였는데도 1위는 그대로예요. 이 결과는 무게에 크게 흔들리지 않습니다.
            </>
          ) : (
            <>마음이 가는 대로 밀어보세요. 그게 진짜 내 기준일 수 있어요.</>
          )}
        </p>
      </div>

      {moved && (
        <button
          type="button"
          className="btn--link"
          style={{ alignSelf: 'flex-start', marginTop: 4 }}
          onClick={reset}
        >
          되돌리기
        </button>
      )}

      {/* ── 빠진 기준 ───────────────────────────────── */}
      <div className="card--dashed" style={{ marginTop: 18, padding: '14px 16px' }}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, color: 'var(--soft)' }}>
          아무리 움직여도 마음과 안 맞나요? 그러면 무게 문제가 아니라{' '}
          <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>아직 안 적은 기준</strong>이 있을 수
          있어요.
        </p>
        <button
          type="button"
          className="btn--link"
          style={{ marginTop: 2 }}
          onClick={() => navigate(`/d/${decision.id}/criteria`)}
        >
          기준 다시 보기
        </button>
      </div>

      {/* ── 통찰 메모 ───────────────────────────────── */}
      <div className="insight" style={{ marginTop: 26 }}>
        <label htmlFor="insight" style={{ fontSize: 13, fontWeight: 600, color: 'var(--soft)' }}>
          진짜 중요했던 건
        </label>
        <textarea
          id="insight"
          value={note}
          placeholder="나중에 이 한 줄이 제일 쓸모 있어요."
          onChange={(e) => setNote(e.target.value)}
        />
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: 'var(--meta)' }}>
          정리된 문장일 필요 없어요. 떠오른 그대로 적으면 됩니다.
        </p>
      </div>

      <div className="spacer" />

      <div className="stack" style={{ gap: 10 }}>
        {decision.commit && moved && (
          <p className="meta" style={{ margin: 0, lineHeight: 1.7 }}>
            정한 결정이지만 다시 볼 수 있어요. 예전 기록은 지워지지 않습니다.
          </p>
        )}
        <div className="btnrow">
          <button type="button" className="btn btn--quiet" style={{ flexGrow: 1 }} onClick={saveNoteOnly}>
            그냥 나가기
          </button>
          <button
            type="button"
            className="btn btn--primary"
            style={{ flexGrow: 1 }}
            disabled={!moved}
            onClick={apply}
          >
            이걸로 계산하기
          </button>
        </div>
      </div>
    </Paper>
  )
}

/** 0~1 무게를 슬라이더 눈금(1~100)으로. 합이 1이므로 그대로 100배 하면 된다. */
function toTick(weight: number): number {
  return Math.max(1, Math.min(100, Math.round(weight * 100)))
}

/**
 * 무게를 숫자 대신 말로. 기준이 몇 개냐에 따라 '고르게'의 기준점이 달라지므로
 * 균등 배분(1/n)과 견줘서 읽는다.
 */
function weightWord(weight: number, count: number): string {
  if (count <= 1) return '전부'
  const even = 1 / count
  const ratio = weight / even
  if (ratio >= 2.2) return '제일 중요'
  if (ratio >= 1.35) return '중요'
  if (ratio >= 0.75) return '보통'
  if (ratio >= 0.4) return '덜 중요'
  return '거의 안 봄'
}
