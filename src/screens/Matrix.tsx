import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { TopBar } from '@/components/Controls'
import { evaluate, fitLabel } from '@/core/evaluate'
import { ordinalMark } from '@/core/narrate'
import { scoreKey } from '@/core/types'
import { useDecision } from '@/app/useDecision'
import { sound, soundPreference } from '@/platform/sound'
import { createMatrixScene, type MatrixData } from './matrix-scene'

/**
 * 내가 매긴 표 — 확정 뒤에 한 번 보는 화면.
 *
 * 결정을 끝내고 나면 남는 건 "②로 정했다" 한 줄뿐이라, 그 답이 무엇 위에
 * 서 있었는지가 사라진다. 이 화면은 그걸 표 하나로 되돌려준다.
 * 새 정보를 더하지 않고, 사용자가 이미 적은 것만 모아 보여준다.
 *
 * 표가 한 화면에 안 들어오는 문제는 만년필이 써 내려가는 시간으로 푼다
 * (matrix-scene.ts). 건너뛰기는 항상 떠 있다.
 */
export function Matrix() {
  const navigate = useNavigate()
  const { decision } = useDecision()
  const svgRef = useRef<SVGSVGElement>(null)
  const [done, setDone] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const sceneRef = useRef<ReturnType<typeof createMatrixScene> | null>(null)
  const [legend, setLegend] = useState({ alternatives: false, criteria: false })
  /** "다시 보기"를 누를 때마다 올라간다 — 장면을 처음부터 다시 만든다. */
  const [run, setRun] = useState(0)

  const data = useMemo(() => (decision ? toMatrix(decision) : null), [decision])

  /** 필수조건에 걸려 표에서 빠진 선택지 */
  const dropped = useMemo(() => {
    if (!decision) return []
    return evaluate(decision)
      .all.filter((a) => a.eliminatedBy !== null)
      .map((a) => `${ordinalMark(a.ordinal)} ${a.name}`)
  }, [decision])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !data || data.alternatives.length === 0) return

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let cancelled = false

    setDone(false)
    // 글자 폭을 재서 줄을 나누므로 서체가 올라온 뒤에 그린다.
    void document.fonts.ready.then(() => {
      if (cancelled) return
      const wanted = soundPreference()
      // 그리는 도중에 소리를 껐다 켤 수 있으니 매번 지금 상태를 묻는다.
      const scene = createMatrixScene(svg, data, {
        sound: {
          scratch: (seconds) => sound.effects().scratch(seconds),
          circle: (seconds) => sound.effects().circle(seconds),
        },
        onDone: () => setDone(true),
      })
      sceneRef.current = scene
      setLegend(scene.truncated)

      if (still) {
        // 모션을 줄이는 설정 — 그리지 않고 완성된 표만 (디자인 §4).
        scene.finish()
        return
      }
      if (wanted) {
        void sound.enable().then(() => {
          if (!cancelled) setSoundOn(sound.on)
        })
      }
      scene.play()
    })

    return () => {
      cancelled = true
      sceneRef.current?.destroy()
      sceneRef.current = null
      sound.silence()
    }
    // data는 decision이 바뀔 때만 새로 만들어진다.
  }, [data, run])

  if (!decision || !data) return <Paper> </Paper>

  function toggleSound() {
    if (sound.on) {
      sound.disable()
      setSoundOn(false)
      return
    }
    void sound.enable().then(() => setSoundOn(sound.on))
  }

  function skip() {
    if (done) return
    sceneRef.current?.finish()
  }

  const empty = data.alternatives.length === 0

  return (
    <Paper>
      <TopBar
        back={`/d/${decision.id}/commit`}
        center="내가 매긴 표"
        right={
          <button
            type="button"
            className={`soundbadge${soundOn ? ' is-on' : ''}`}
            aria-pressed={soundOn}
            aria-label={soundOn ? '소리 끄기' : '소리 켜기'}
            onClick={toggleSound}
          >
            <span className="soundbadge__eq" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {soundOn ? '소리 나는 중' : '소리 꺼짐'}
          </button>
        }
      />

      {empty ? (
        <p className="empty" style={{ marginTop: 40 }}>
          필수조건에 모두 걸려서 표로 그릴 선택지가 없어요.
        </p>
      ) : (
        <div className="matrix">
          <svg
            ref={svgRef}
            className="matrix__sheet"
            role="img"
            aria-label={describe(data)}
          />
        </div>
      )}

      {/* 표 안에서 자리가 모자라 줄인 이름은 여기서 온전히 보여준다. */}
      {legend.alternatives && (
        <ul className="matrix__legend">
          {data.alternatives.map((alt) => (
            <li key={alt.mark}>
              <span style={{ color: 'var(--pen)' }}>{alt.mark}</span> {alt.name}
            </li>
          ))}
        </ul>
      )}

      {legend.criteria && (
        <ul className="matrix__legend">
          {data.criteria.map((criterion) => (
            <li key={criterion.name}>
              {criterion.name} <span style={{ color: 'var(--meta)' }}>{criterion.percent}</span>
            </li>
          ))}
        </ul>
      )}

      {dropped.length > 0 && (
        <p className="matrix__dropped">필수조건에 걸린 {dropped.join(', ')}는 표에서 뺐습니다.</p>
      )}

      <div className="spacer" />

      <div className="btnrow">
        <button
          type="button"
          className="btn btn--quiet"
          style={{ flexShrink: 0, paddingInline: 18 }}
          onClick={done ? () => setRun((r) => r + 1) : skip}
        >
          {done ? '다시 보기' : '건너뛰기'}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          style={{ flexGrow: 1 }}
          disabled={!done && !empty}
          onClick={() => navigate('/')}
        >
          다음으로
        </button>
      </div>
    </Paper>
  )
}

/** 결정 하나를 표가 필요로 하는 값들로 옮긴다. 여기서 새로 계산하는 건 없다. */
function toMatrix(decision: Parameters<typeof evaluate>[0]): MatrixData {
  const result = evaluate(decision)
  // 필수조건에 걸린 선택지는 뺀다. 다만 순서는 적합도가 아니라 ①②③ 그대로 —
  // 다른 화면에서 부르던 번호와 표의 열이 어긋나면 안 된다.
  const alive = result.all.filter((a) => a.eliminatedBy === null).sort((a, b) => a.ordinal - b.ordinal)

  const scores = decision.criteria.map((criterion) =>
    alive.map((alt) => decision.scores[scoreKey(alt.alternativeId, criterion.id)]?.value ?? null),
  )

  const winners = scores.map((row) => {
    let best = -1
    let bestValue = -Infinity
    let tied = false
    row.forEach((value, i) => {
      if (value === null) return
      if (value > bestValue) {
        bestValue = value
        best = i
        tied = false
      } else if (value === bestValue) {
        tied = true
      }
    })
    // 동점이면 동그라미를 치지 않는다 — 앱이 없는 차이를 만들지 않는다.
    return tied ? -1 : best
  })

  let leader = 0
  let bestFit = -Infinity
  alive.forEach((alt, i) => {
    if (alt.fit > bestFit) {
      bestFit = alt.fit
      leader = i
    }
  })

  return {
    alternatives: alive.map((alt) => ({
      mark: ordinalMark(alt.ordinal),
      name: alt.name,
      fit: alt.fit,
      label: fitLabel(alt.fit),
    })),
    criteria: decision.criteria.map((criterion, i) => ({
      name: criterion.name,
      percent: `${Math.round((result.weights[i] ?? 0) * 100)}%`,
    })),
    scores,
    winners,
    leader: alive.length === 0 ? 0 : leader,
  }
}

/** 화면을 못 보는 사람에게 표를 말로. */
function describe(data: MatrixData): string {
  const rows = data.criteria.map((criterion, ci) => {
    const cells = data.alternatives
      .map((alt, ai) => {
        const value = data.scores[ci]?.[ai]
        return `${alt.mark} ${value === null || value === undefined ? '비어 있음' : `${value}점`}`
      })
      .join(', ')
    return `${criterion.name} ${criterion.percent}: ${cells}`
  })
  const fits = data.alternatives.map((alt) => `${alt.mark} ${alt.label}`).join(', ')
  return `${data.alternatives.map((a) => `${a.mark} ${a.name}`).join(', ')}. ${rows.join('. ')}. 적합도 ${fits}.`
}
