import type { CSSProperties } from 'react'
import plane from '@/assets/stickers/plane-cut.svg'
import clip from '@/assets/stickers/clip-cut.svg'
import sign from '@/assets/stickers/sign-cut.svg'
import pencil from '@/assets/stickers/pencil-cut.svg'
import heart from '@/assets/stickers/heart-cut.svg'
import checklist from '@/assets/stickers/checklist-cut.svg'
import lock from '@/assets/stickers/lock-cut.svg'
import scale from '@/assets/stickers/scale-cut.svg'
import calendar from '@/assets/stickers/calendar-cut.svg'
import envelope from '@/assets/stickers/envelope-cut.svg'
import key from '@/assets/stickers/key-cut.svg'
import tapeRose from '@/assets/stickers/tape-rose-dots.svg'
import tapeSage from '@/assets/stickers/tape-sage-stripe.svg'
import tapeButter from '@/assets/stickers/tape-butter-dots.svg'

/**
 * 다이어리에 붙인 스티커 (디자인 시스템 §5 '스티커 (화면)').
 *
 * 쓰는 것만 여기서 불러온다 — src/assets/stickers의 158장을 전부 앱에 싣지 않기 위해서다.
 * 장식이라 읽어주지 않고, 눌리지도 않고, 글자를 가리지 않는 자리에만 둔다.
 */
const STICKERS = { plane, clip, sign, pencil, heart, checklist, lock, scale, calendar, envelope, key, tapeRose, tapeSage, tapeButter } as const

export type StickerName = keyof typeof STICKERS

export function Sticker({
  name,
  width,
  rotate = 0,
  className = '',
  style,
}: {
  name: StickerName
  width: number
  rotate?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <img
      src={STICKERS[name]}
      alt=""
      aria-hidden="true"
      draggable={false}
      data-sticker={name}
      width={width}
      className={`sticker${name.startsWith('tape') ? ' sticker--tape' : ''}${className ? ` ${className}` : ''}`}
      // transform은 등장 모션(m-settle)이 덮어쓰므로 기울기는 개별 rotate 속성으로 준다
      style={{ rotate: rotate ? `${rotate}deg` : undefined, ...style }}
    />
  )
}
