import type { ReactNode } from 'react'

/**
 * 디자인 시스템 §3 — "책상 위에 놓인 종이 한 장".
 * 모든 화면은 이 구조 안에 들어간다.
 *
 * footer는 스크롤 밖, 종이 아래쪽에 붙는다 (§5 하단 버튼 영역).
 * 내용이 길어도 다음으로 가는 버튼이 잘리거나 화면 밖으로 밀려나지 않는다.
 */
export function Paper({
  ruled = false,
  footer,
  children,
}: {
  ruled?: boolean
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="desk">
      <div className={ruled ? 'paper paper--ruled' : 'paper'}>
        <div className="sheet">{children}</div>
        {footer && <div className="paper__foot">{footer}</div>}
      </div>
    </div>
  )
}
