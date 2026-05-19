import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeScrollPositions,
  computeCropTopPx,
  computeDrawRect,
  computeCanvasHeightPx,
} from './stitch.js'

describe('computeScrollPositions', () => {
  it('returns single position for short pages', () => {
    assert.deepEqual(computeScrollPositions(400, 800), [0])
  })

  it('steps by viewport height for tall pages', () => {
    const pos = computeScrollPositions(2500, 800)
    assert.equal(pos[0], 0)
    assert.ok(pos.includes(800))
    assert.ok(pos[pos.length - 1] >= 2500 - 800)
  })

  it('caps chunk count', () => {
    const pos = computeScrollPositions(1_000_000, 100)
    assert.ok(pos.length <= 50)
  })
})

describe('computeCropTopPx', () => {
  it('has no crop on first chunk', () => {
    assert.equal(computeCropTopPx(0, null, 800, 2), 0)
  })

  it('has no crop when scroll steps match viewport', () => {
    assert.equal(computeCropTopPx(800, 0, 800, 1), 0)
  })

  it('crops overlap when scroll step is smaller than viewport', () => {
    assert.equal(computeCropTopPx(500, 0, 800, 1), 300)
  })
})

describe('computeDrawRect', () => {
  it('places first chunk at origin', () => {
    const r = computeDrawRect(0, 2000, 800, 1600, 2, 0)
    assert.equal(r.destY, 0)
    assert.equal(r.sourceY, 0)
    assert.ok(r.drawHeight > 0)
  })

  it('limits final tile to page bottom', () => {
    const page = 2400
    const vh = 800
    const dpr = 1
    const scrollY = 1600
    const crop = computeCropTopPx(scrollY, 800, vh, dpr)
    const r = computeDrawRect(scrollY, page, vh, 800, dpr, crop)
    assert.equal(r.destY + r.drawHeight, page)
  })
})

describe('computeCanvasHeightPx', () => {
  it('matches page height for exact tiles', () => {
    const page = 2400
    const vh = 800
    const dpr = 1
    const positions = computeScrollPositions(page, vh)
    const h = computeCanvasHeightPx(positions, vh, page, vh, dpr)
    assert.equal(h, page)
  })
})
