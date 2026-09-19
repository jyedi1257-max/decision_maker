import { describe, expect, it } from 'vitest'
import { moveTo, rocWeights, scaleWeight } from './weights'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('rocWeights', () => {
  it('합이 1이다', () => {
    for (let n = 1; n <= 12; n++) {
      expect(sum(rocWeights(n))).toBeCloseTo(1, 10)
    }
  })

  it('순위가 낮아질수록 가벼워진다 (단조감소)', () => {
    for (let n = 2; n <= 12; n++) {
      const w = rocWeights(n)
      for (let i = 1; i < n; i++) {
        expect(w[i]!).toBeLessThan(w[i - 1]!)
      }
    }
  })

  it('기준이 하나면 전부를 차지한다', () => {
    expect(rocWeights(1)).toEqual([1])
  })

  it('기준 3개는 프로토타입의 54/28/18 비중과 맞는다', () => {
    const w = rocWeights(3)
    expect(w[0]).toBeCloseTo(0.6111, 4)
    expect(w[1]).toBeCloseTo(0.2778, 4)
    expect(w[2]).toBeCloseTo(0.1111, 4)
  })

  it('0개나 음수, 소수는 거부한다', () => {
    expect(() => rocWeights(0)).toThrow(RangeError)
    expect(() => rocWeights(-1)).toThrow(RangeError)
    expect(() => rocWeights(2.5)).toThrow(RangeError)
  })

  it('모든 가중치가 양수다', () => {
    for (const w of rocWeights(8)) expect(w).toBeGreaterThan(0)
  })
})

describe('scaleWeight', () => {
  it('배율을 걸어도 합은 1로 유지된다', () => {
    const w = rocWeights(4)
    for (const f of [0.1, 0.5, 1, 2, 10]) {
      expect(sum(scaleWeight(w, 2, f))).toBeCloseTo(1, 10)
    }
  })

  it('배율 1은 원래 값 그대로다', () => {
    const w = rocWeights(3)
    const scaled = scaleWeight(w, 0, 1)
    scaled.forEach((v, i) => expect(v).toBeCloseTo(w[i]!, 10))
  })

  it('배율을 키우면 그 기준이 무거워지고 나머지는 가벼워진다', () => {
    const w = rocWeights(3)
    const scaled = scaleWeight(w, 2, 5)
    expect(scaled[2]!).toBeGreaterThan(w[2]!)
    expect(scaled[0]!).toBeLessThan(w[0]!)
  })
})

describe('moveTo', () => {
  it('항목을 앞으로 옮긴다', () => {
    expect(moveTo(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })
  it('항목을 뒤로 옮긴다', () => {
    expect(moveTo(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })
  it('제자리로 옮기면 그대로다', () => {
    expect(moveTo(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })
  it('원본을 바꾸지 않는다', () => {
    const original = ['a', 'b', 'c']
    moveTo(original, 0, 2)
    expect(original).toEqual(['a', 'b', 'c'])
  })
})
