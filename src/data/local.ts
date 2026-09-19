/**
 * 기기 저장소. 고민 본문은 여기에 먼저, 그리고 기본적으로는 여기에만 남는다.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Decision } from '@/core/types'
import { summarize, type DecisionRepository, type DecisionSummary } from './repository'

interface DecisionDB extends DBSchema {
  decisions: {
    key: string
    value: Decision
    indexes: { 'by-updated': string }
  }
  settings: {
    key: string
    value: unknown
  }
}

const DB_NAME = 'decision-note'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<DecisionDB>> | null = null

function db(): Promise<IDBPDatabase<DecisionDB>> {
  dbPromise ??= openDB<DecisionDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore('decisions', { keyPath: 'id' })
      store.createIndex('by-updated', 'updatedAt')
      database.createObjectStore('settings')
    },
  })
  return dbPromise
}

export const localRepository: DecisionRepository = {
  async list(): Promise<DecisionSummary[]> {
    const all = await (await db()).getAllFromIndex('decisions', 'by-updated')
    return all.reverse().map(summarize)
  },

  async get(id) {
    return (await (await db()).get('decisions', id)) ?? null
  },

  async save(decision) {
    await (await db()).put('decisions', decision)
  },

  async remove(id) {
    await (await db()).delete('decisions', id)
  },

  async all() {
    return (await db()).getAll('decisions')
  },

  async clear() {
    await (await db()).clear('decisions')
  },
}

/** 화면 밖의 작은 설정값 (동기화 켬/끔 등). */
export const settings = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const value = await (await db()).get('settings', key)
    return (value as T) ?? fallback
  },
  async set(key: string, value: unknown): Promise<void> {
    await (await db()).put('settings', value, key)
  },
}
