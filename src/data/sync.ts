/**
 * 선택적 클라우드 동기화.
 *
 * 켜기 전에는 firebase 코드가 로드조차 되지 않는다 (동적 import + 별도 청크).
 * 켜는 순간 익명 계정을 만들어 UID를 받는다 — 사용자는 여전히 아무것도 입력하지 않는다.
 *
 * 기획안 10.3: 가능하면 로컬 우선 저장, 전송범위를 명확히 한다.
 */
import type { Decision } from '@/core/types'
import { firebaseConfig, isFirebaseConfigured } from '@/firebase/config'
import { localRepository, settings } from './local'

const SYNC_FLAG = 'sync-enabled'

export type SyncState = 'off' | 'connecting' | 'on' | 'error'

let cached: {
  uid: string
  put: (decision: Decision) => Promise<void>
  del: (id: string) => Promise<void>
  pull: () => Promise<Decision[]>
} | null = null

export async function isSyncEnabled(): Promise<boolean> {
  if (!isFirebaseConfigured()) return false
  return settings.get(SYNC_FLAG, false)
}

/** Firebase를 여기서 처음 불러온다. 이 함수를 부르기 전에는 번들이 로드되지 않는다. */
async function connect() {
  if (cached) return cached

  // 동적으로 가져오는 건 firebase SDK뿐이다. config.ts는 상수 객체 하나라
  // 어차피 본 번들에 있고(보관함 화면이 정적으로 쓴다), 동적으로 또 부르면
  // "static/dynamic 양쪽에서 불린다"는 경고만 난다.
  const [{ initializeApp, getApps }, { getAuth, signInAnonymously }, firestore] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ])

  const app = getApps()[0] ?? initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const credential = auth.currentUser ?? (await signInAnonymously(auth)).user
  const uid = credential.uid

  const { getFirestore, doc, setDoc, deleteDoc, collection, getDocs } = firestore
  const db = getFirestore(app)
  const path = () => collection(db, 'users', uid, 'decisions')

  cached = {
    uid,
    put: async (decision) => {
      await setDoc(doc(path(), decision.id), decision)
    },
    del: async (id) => {
      await deleteDoc(doc(path(), id))
    },
    pull: async () => {
      const snapshot = await getDocs(path())
      return snapshot.docs.map((d) => d.data() as Decision)
    },
  }
  return cached
}

/**
 * 동기화를 켠다. 기기에 있던 결정을 올리고, 클라우드에만 있던 결정을 내려받는다.
 * 같은 결정이 양쪽에 있으면 updatedAt이 최신인 쪽을 남긴다.
 */
export async function enableSync(): Promise<void> {
  const remote = await connect()
  const [mine, theirs] = await Promise.all([localRepository.all(), remote.pull()])

  const merged = new Map<string, Decision>()
  for (const d of [...theirs, ...mine]) {
    const existing = merged.get(d.id)
    if (!existing || d.updatedAt > existing.updatedAt) merged.set(d.id, d)
  }

  await Promise.all(
    [...merged.values()].map(async (d) => {
      await localRepository.save(d)
      await remote.put(d)
    }),
  )
  await settings.set(SYNC_FLAG, true)
}

/** 동기화를 끈다. 클라우드에 올라간 사본은 지우지 않는다 — 삭제는 따로 고른다. */
export async function disableSync(): Promise<void> {
  await settings.set(SYNC_FLAG, false)
  cached = null
}

/** 저장할 때 조용히 따라 올린다. 실패해도 기기 저장은 이미 끝나 있다. */
export async function pushIfEnabled(decision: Decision): Promise<void> {
  if (!(await isSyncEnabled())) return
  try {
    const remote = await connect()
    await remote.put(decision)
  } catch {
    // 네트워크가 없어도 앱은 그대로 쓰인다. 다음 저장 때 다시 시도된다.
  }
}

export async function removeIfEnabled(id: string): Promise<void> {
  if (!(await isSyncEnabled())) return
  try {
    const remote = await connect()
    await remote.del(id)
  } catch {
    // 위와 같다.
  }
}
