import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Paper } from '@/components/Paper'
import { Title, TopBar } from '@/components/Controls'
import { delay } from '@/styles/motion'
import { localRepository } from '@/data/local'
import { clearRemote, disableSync, enableSync, isSyncEnabled } from '@/data/sync'
import { isFirebaseConfigured } from '@/firebase/config'
import { useDecisions } from '@/store/decisions'

/**
 * 보관함
 *
 * 13화면에는 없지만 "로컬 우선 + 선택 동기화"를 고른 이상 필요하다.
 * 기획안 10.3 — 프라이버시: 전송범위를 명확히 하고, 내보내기와 삭제를 사용자가 쥔다.
 */
export function Settings() {
  const navigate = useNavigate()
  const loadList = useDecisions((s) => s.loadList)
  const [synced, setSynced] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const configured = isFirebaseConfigured()

  useEffect(() => {
    void isSyncEnabled().then(setSynced)
  }, [])

  async function toggleSync() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (synced) {
        await disableSync()
        setSynced(false)
      } else {
        await enableSync()
        setSynced(true)
      }
    } catch {
      setError('연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요. 기기에 있는 기록은 그대로입니다.')
    } finally {
      setBusy(false)
    }
  }

  async function exportAll() {
    const all = await localRepository.all()
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `결정노트-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function clearAll() {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    if (busy) return
    setBusy(true)
    setError(null)
    // 서버를 먼저 지운다. 기기를 먼저 비우면 무엇을 지워야 할지 알 수 없게 된다.
    try {
      await clearRemote()
    } catch {
      setError('서버에 올라간 사본은 지우지 못했어요. 기기 기록은 그대로 두었습니다. 잠시 뒤에 다시 해주세요.')
      setBusy(false)
      return
    }
    await localRepository.clear()
    await loadList()
    setConfirmClear(false)
    setBusy(false)
    navigate('/')
  }

  return (
    <Paper>
      <TopBar back="/" backLabel="홈으로" center="보관함" sticker="envelope" />

      <div style={{ marginTop: 32 }}>
        <Title lines={['보관함']} size={24} />
      </div>

      <div className="card m-settle" style={{ marginTop: 24, ...delay(0, 'm-settle', 240) }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>이 기기</div>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.7, color: 'var(--soft)' }}>
          적은 건 전부 이 기기에만 있습니다. 서버로 보내지 않고, 계정도 만들지 않아요.
        </p>
      </div>

      <div className="card m-settle" style={{ marginTop: 12, ...delay(1, 'm-settle', 240) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flexGrow: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>다른 기기에서도 보기</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--soft)' }}>
              {configured
                ? '켜면 서버에도 사본이 생깁니다. 계정은 만들지 않아요.'
                : '이 빌드에는 서버 설정이 들어 있지 않아 기기 저장만 씁니다.'}
            </div>
          </div>
          <button
            type="button"
            className={`toggle${synced ? ' is-on' : ''}`}
            aria-pressed={synced}
            aria-label="다른 기기와 동기화"
            disabled={!configured || busy}
            style={!configured ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            onClick={toggleSync}
          >
            <span className="toggle__knob" />
          </button>
        </div>
        {synced && (
          <p style={{ margin: '12px 0 0', fontSize: 12, lineHeight: 1.7, color: 'var(--soft)' }}>
            끄면 새 기록은 더 올라가지 않지만, 이미 올라간 사본은 서버에 남습니다. 지우려면
            동기화를 켜둔 채로 아래에서 전체 삭제를 해주세요.
          </p>
        )}
        {error && (
          <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.7, color: 'var(--pen)' }}>{error}</p>
        )}
      </div>

      <div className="stack" style={{ marginTop: 24, gap: 10 }}>
        <button type="button" className="btn btn--quiet m-lift" onClick={exportAll} style={delay(0, 'm-lift', 420)}>
          전부 파일로 내보내기
        </button>
        <button
          type="button"
          className="btn btn--quiet m-lift"
          onClick={clearAll}
          style={{
            color: confirmClear ? 'var(--pen)' : undefined,
            borderColor: confirmClear ? 'var(--pen)' : undefined,
            ...delay(1, 'm-lift', 420),
          }}
        >
          {confirmClear ? '정말 지울까요? 한 번 더 누르면 지워집니다' : '이 기기의 기록 전부 지우기'}
        </button>
        {confirmClear && (
          <button type="button" className="btn--link" onClick={() => setConfirmClear(false)}>
            그만두기
          </button>
        )}
        <Link to="/privacy" className="btn--link">
          개인정보 처리방침
        </Link>
      </div>

      <div className="spacer" />
    </Paper>
  )
}
