/**
 * 화면 하나가 결정 하나를 읽고 고치는 통로.
 * 주소의 id로 불러오고, 없으면 홈으로 돌려보낸다.
 */
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Decision } from '@/core/types'
import { useDecisions } from '@/store/decisions'

export function useDecision(): {
  decision: Decision | null
  loading: boolean
  update: (patch: (decision: Decision) => Decision) => void
} {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const current = useDecisions((s) => s.current)
  const loading = useDecisions((s) => s.loading)
  const load = useDecisions((s) => s.load)
  const update = useDecisions((s) => s.update)

  useEffect(() => {
    if (!id) {
      navigate('/', { replace: true })
      return
    }
    if (current?.id === id) return
    void load(id).then((found) => {
      if (!found) navigate('/', { replace: true })
    })
  }, [id, current?.id, load, navigate])

  return {
    decision: current?.id === id ? current : null,
    loading,
    update,
  }
}
