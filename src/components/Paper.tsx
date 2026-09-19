import type { ReactNode } from 'react'

/**
 * 디자인 시스템 §3 — "책상 위에 놓인 종이 한 장".
 * 모든 화면은 이 구조 안에 들어간다.
 */
export function Paper({ ruled = false, children }: { ruled?: boolean; children: ReactNode }) {
  return (
    <div className="desk">
      <div className={ruled ? 'paper paper--ruled' : 'paper'}>
        <div className="sheet">{children}</div>
      </div>
    </div>
  )
}
