import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'

import { Main } from '@/screens/Main'
import { Frame } from '@/screens/Frame'
import { Alternatives } from '@/screens/Alternatives'
import { Gut } from '@/screens/Gut'
import { Criteria } from '@/screens/Criteria'
import { Must } from '@/screens/Must'
import { Evaluate } from '@/screens/Evaluate'
import { Result } from '@/screens/Result'
import { Why } from '@/screens/Why'
import { Explore } from '@/screens/Explore'
import { Commit } from '@/screens/Commit'
import { Matrix } from '@/screens/Matrix'
import { Review } from '@/screens/Review'
import { Settings } from '@/screens/Settings'
import { Privacy } from '@/screens/Privacy'

/**
 * 기본은 깔끔한 주소(BrowserRouter)다. firebase.json이 모든 경로를 index.html로 돌려준다.
 *
 * 그런 되돌림 규칙을 못 거는 정적 호스트에 미리보기를 올릴 때만 VITE_HASH_ROUTER를 켠다.
 * 안 켜면 /d/:id/frame 같은 주소를 새로고침했을 때 404가 난다.
 */
const Router = import.meta.env.VITE_HASH_ROUTER === '1' ? HashRouter : BrowserRouter

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Main />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/d/:id/frame" element={<Frame />} />
        <Route path="/d/:id/alternatives" element={<Alternatives />} />
        <Route path="/d/:id/gut" element={<Gut />} />
        <Route path="/d/:id/criteria" element={<Criteria />} />
        <Route path="/d/:id/must" element={<Must />} />
        {/* 예전 '중요한 순서' 화면. 순서는 이제 기준 화면에서 잡는다. */}
        <Route path="/d/:id/weight" element={<Navigate to="../criteria" relative="path" replace />} />
        <Route path="/d/:id/evaluate" element={<Evaluate />} />
        <Route path="/d/:id/result" element={<Result />} />
        <Route path="/d/:id/why" element={<Why />} />
        <Route path="/d/:id/explore" element={<Explore />} />
        <Route path="/d/:id/commit" element={<Commit />} />
        <Route path="/d/:id/matrix" element={<Matrix />} />
        <Route path="/d/:id/review" element={<Review />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
