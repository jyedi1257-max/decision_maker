/**
 * 화면이 쓰는 상태. 저장은 항상 기기에 먼저 하고, 동기화는 그 뒤에 조용히 따라간다.
 */
import { create } from 'zustand'
import type { Decision } from '@/core/types'
import { localRepository } from '@/data/local'
import type { DecisionSummary } from '@/data/repository'
import { pushIfEnabled, removeIfEnabled } from '@/data/sync'
import { newDecision } from './factory'

interface DecisionStore {
  summaries: DecisionSummary[]
  current: Decision | null
  loading: boolean

  loadList: () => Promise<void>
  load: (id: string) => Promise<Decision | null>
  create: () => Promise<Decision>
  update: (patch: (decision: Decision) => Decision) => void
  remove: (id: string) => Promise<void>
}

/** 연달아 들어오는 입력을 한 번에 저장한다. */
let flushTimer: ReturnType<typeof setTimeout> | null = null
let pending: Decision | null = null

function scheduleSave(decision: Decision) {
  pending = decision
  if (flushTimer !== null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    const toSave = pending
    pending = null
    if (toSave) void persist(toSave)
  }, 250)
}

async function persist(decision: Decision) {
  await localRepository.save(decision)
  void pushIfEnabled(decision)
}

/** 화면을 떠나기 전에 남은 저장을 끝낸다. */
export async function flushPendingSave(): Promise<void> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  const toSave = pending
  pending = null
  if (toSave) await persist(toSave)
}

export const useDecisions = create<DecisionStore>((set, get) => ({
  summaries: [],
  current: null,
  loading: true,

  async loadList() {
    set({ loading: true })
    const summaries = await localRepository.list()
    set({ summaries, loading: false })
  },

  async load(id) {
    const existing = get().current
    if (existing?.id === id) return existing
    set({ loading: true })
    const decision = await localRepository.get(id)
    set({ current: decision, loading: false })
    return decision
  },

  async create() {
    const decision = newDecision()
    await persist(decision)
    set({ current: decision })
    return decision
  },

  update(patch) {
    const current = get().current
    if (!current) return
    const next = { ...patch(current), updatedAt: new Date().toISOString() }
    set({ current: next })
    scheduleSave(next)
  },

  async remove(id) {
    await localRepository.remove(id)
    void removeIfEnabled(id)
    const summaries = await localRepository.list()
    set({ summaries, current: get().current?.id === id ? null : get().current })
  },
}))
