/**
 * ROC(Rank Order Centroid) 가중치 — Edwards & Barron(1994)의 SMARTER.
 *
 * 사용자에게 "가격 37, 공간 24, 통근 19"를 입력시키지 않고 중요한 순서만 받는다.
 * 논문은 이 방식이 어려운 판단을 요구하지 않으면서 SMARTS 성능의 약 98% 수준을
 * 보일 수 있다고 설명한다 (기획안 6.4).
 *
 *   w_i = (1/n) · Σ_{k=i..n} (1/k)
 *
 * n=3이면 [0.6111, 0.2778, 0.1111].
 */
export function rocWeights(n: number): number[] {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`기준 개수는 1 이상의 정수여야 합니다: ${n}`)
  }
  const weights: number[] = []
  for (let i = 1; i <= n; i++) {
    let sum = 0
    for (let k = i; k <= n; k++) sum += 1 / k
    weights.push(sum / n)
  }
  return weights
}

/**
 * 한 기준의 무게에 배율을 걸고 전체를 다시 1로 맞춘다.
 * 민감도 분석에서 "이 기준을 조금 더 중요하게 보면"을 계산할 때 쓴다.
 */
export function scaleWeight(weights: number[], index: number, factor: number): number[] {
  const scaled = weights.map((w, i) => (i === index ? w * factor : w))
  const total = scaled.reduce((a, b) => a + b, 0)
  if (total === 0) return weights.slice()
  return scaled.map((w) => w / total)
}

/** 순서에서 항목 하나를 다른 자리로 옮긴 새 배열. */
export function moveTo<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice()
  const [item] = next.splice(from, 1)
  if (item === undefined) return items.slice()
  next.splice(to, 0, item)
  return next
}
