import { describe, expect, test, tier } from 'claude-code/testing'

import { addTurn, emptyBook, KEEP_DAYS, missReason, report, shortModel, sumDay } from '../hooks/ledger'

tier('user')

const U = (write: number, read: number, input = 5) => ({
  input_tokens: input,
  output_tokens: 300,
  cache_read_input_tokens: read,
  cache_creation_input_tokens: write,
})
const CTX = {
  prevEndMs: 0,
  startMs: 60_000,
  prevModel: 'claude-opus-5-5',
  model: 'claude-opus-5-5',
  compactedSince: false,
  isSubagent: false,
  ttlMs: 300_000,
}

describe('ledger', () => {
  test('a turn that mostly read the cache is no miss', async () => {
    expect(missReason(U(20_000, 150_000), CTX)).toBe(null)
    expect(missReason(U(9_000, 0), CTX)).toBe(null)
  })

  test('a miss names the idle gap past the TTL before a generic prefix change', async () => {
    expect(missReason(U(140_000, 0), { ...CTX, startMs: 7 * 60_000 })).toBe('idle 7m > 5m ttl')
    expect(missReason(U(140_000, 0), { ...CTX, startMs: 320_000 })).toBe('idle 5m20s > 5m ttl')
    expect(missReason(U(140_000, 0), CTX)).toBe('prefix changed')
  })

  test('a model switch and a compaction are named', async () => {
    expect(missReason(U(140_000, 0), { ...CTX, prevModel: 'claude-sonnet-5' })).toBe('model sonnet 5→opus 5.5')
    expect(missReason(U(140_000, 0), { ...CTX, compactedSince: true })).toBe('after compact')
    expect(missReason(U(140_000, 0), { ...CTX, prevEndMs: null })).toBe('first turn')
  })

  test('turns add up per day, project and model, and old days drop off', async () => {
    const book = emptyBook()
    addTurn(book, '2026-09-23', '/a', 'm', U(10, 90), 0.5)
    addTurn(book, '2026-09-23', '/a', 'm', U(10, 90), 0.25)
    addTurn(book, '2026-09-23', '/b', 'm', U(10, 90), 1)
    expect(sumDay(book, '2026-09-23', '/a').usd).toBe(0.75)
    expect(sumDay(book, '2026-09-23').turns).toBe(3)
    for (let i = 1; i <= KEEP_DAYS + 5; i++) addTurn(book, `2026-06-${String(i).padStart(3, '0')}`, '/a', 'm', U(1, 1), 0)
    expect(Object.keys(book.days).length).toBe(KEEP_DAYS)
  })

  test('the report shows this project by day and every project today', async () => {
    const book = emptyBook()
    addTurn(book, '2026-09-22', '/w/rove', 'm', U(1000, 9000, 0), 2)
    addTurn(book, '2026-09-23', '/w/rove', 'm', U(1000, 9000, 0), 3)
    addTurn(book, '2026-09-23', '/w/wisp', 'm', U(1000, 9000, 0), 1)
    const text = report(book, '/w/rove', '2026-09-23')
    expect(text).toContain('2d total')
    expect(text).toContain('$5.00')
    expect(text).toContain('wisp')
    expect(text).toContain('90%')
  })

  test('model ids read short', async () => {
    expect(shortModel('claude-opus-5-5')).toBe('opus 5.5')
    expect(shortModel('claude-sonnet-5')).toBe('sonnet 5')
    expect(shortModel('claude-haiku-4-5-20251001')).toBe('haiku 4.5')
    expect(shortModel('gpt-5')).toBe('gpt-5')
  })
})
