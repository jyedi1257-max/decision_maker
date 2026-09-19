import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'

import { Main } from '@/screens/Main'
import { Frame } from '@/screens/Frame'
import { Alternatives } from '@/screens/Alternatives'
import { Gut } from '@/screens/Gut'
import { Criteria } from '@/screens/Criteria'
import { Must } from '@/screens/Must'
import { Weight } from '@/screens/Weight'
import { Evaluate } from '@/screens/Evaluate'
import { Result } from '@/screens/Result'
import { Why } from '@/screens/Why'
import { Commit } from '@/screens/Commit'
import { Review } from '@/screens/Review'
import { Settings } from '@/screens/Settings'

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Main />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/d/:id/frame" element={<Frame />} />
        <Route path="/d/:id/alternatives" element={<Alternatives />} />
        <Route path="/d/:id/gut" element={<Gut />} />
        <Route path="/d/:id/criteria" element={<Criteria />} />
        <Route path="/d/:id/must" element={<Must />} />
        <Route path="/d/:id/weight" element={<Weight />} />
        <Route path="/d/:id/evaluate" element={<Evaluate />} />
        <Route path="/d/:id/result" element={<Result />} />
        <Route path="/d/:id/why" element={<Why />} />
        <Route path="/d/:id/commit" element={<Commit />} />
        <Route path="/d/:id/review" element={<Review />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
