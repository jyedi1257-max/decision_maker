import { Paper } from '@/components/Paper'
import { Title, TopBar } from '@/components/Controls'
import { delay } from '@/styles/motion'

/**
 * 개인정보 처리방침
 *
 * 13화면에는 없지만 스토어 등록에는 필요하다. 앱이 실제로 하는 것만 적는다 —
 * 기획안 10.3 프라이버시 원칙과 보관함(Settings) 화면이 하는 일을 그대로 문장으로 옮긴 것.
 */
export function Privacy() {
  return (
    <Paper>
      <TopBar back="/settings" backLabel="보관함으로" center="개인정보" />

      <div style={{ marginTop: 32 }}>
        <Title lines={['어떤 정보를,', '어떻게 다루나요']} size={24} />
      </div>

      <div className="block m-settle" style={{ marginTop: 26, ...delay(0, 'm-settle', 240) }}>
        <p className="say">
          기본적으로는 아무것도 수집하지 않습니다. 로그인도 계정도 없고, 적은 내용은 이 기기
          안에만 저장됩니다.
        </p>
      </div>

      <div className="block m-settle" style={delay(0, 'm-settle', 320)}>
        <p className="say">
          보관함에서 &lsquo;다른 기기와 함께 보기&rsquo;를 켜면, 이름도 이메일도 없는 임의의
          식별자(익명 로그인)로 서버에 같은 사본이 하나 더 생깁니다. 서버로 가는 건 적은 고민
          내용 그대로이고, 그 밖의 것은 보내지 않습니다.
        </p>
      </div>

      <div className="block m-settle" style={delay(0, 'm-settle', 400)}>
        <p className="say">
          광고를 넣지 않고, 방문이나 행동을 추적하지 않고, 다른 회사와 데이터를 주고받지
          않습니다. 켜기 전에는 이 기능들에 쓰이는 코드 자체가 기기로 내려오지도 않습니다.
        </p>
      </div>

      <div className="block m-settle" style={delay(0, 'm-settle', 480)}>
        <p className="say">
          적은 내용은 보관함에서 언제든 파일로 내보내거나 전부 지울 수 있습니다. 동기화를 켜둔
          채로 전부 지우면 서버에 있는 사본도 함께 지워집니다.
        </p>
      </div>

      <div className="block m-settle" style={delay(0, 'm-settle', 560)}>
        <p className="say">궁금한 점은 [문의 이메일]로 연락해 주세요.</p>
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--soft)' }}>2026년 9월 갱신</p>
      </div>

      <div className="spacer" />
    </Paper>
  )
}
