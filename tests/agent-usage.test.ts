import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addTokenUsage, hasCompleteUsage, summarizeTokenUsage, totalTokens } from '../shared/agent/usage'

test('run usage includes the full input and output of every model call', () => {
  const first = addTokenUsage(null, { inputTokens: 1000, outputTokens: 40 })
  const second = addTokenUsage(first, { inputTokens: 1500, outputTokens: 120 })
  assert.deepEqual(second, { inputTokens: 2500, outputTokens: 160, steps: 2, reportedSteps: 2 })
  assert.equal(totalTokens(second), 2660)
  assert.equal(hasCompleteUsage({ id: 'run-1', status: 'completed', usage: second }), true)
  assert.equal(hasCompleteUsage({ id: 'run-1', status: 'failed', usage: second }), false)
  assert.equal(hasCompleteUsage({ id: 'run-1', status: 'running', usage: second }), false)
})

test('missing usage remains unknown and zero is a valid reported count', () => {
  const unavailable = addTokenUsage(null, {})
  assert.equal(unavailable.inputTokens, null)
  assert.equal(unavailable.outputTokens, null)
  assert.equal(totalTokens(unavailable), null)
  const partial = addTokenUsage(unavailable, { inputTokens: 50, outputTokens: 0 })
  assert.equal(partial.reportedSteps, 1)
  assert.equal(hasCompleteUsage({ id: 'partial', status: 'completed', usage: partial }), false)
  assert.equal(totalTokens(partial), 50)
  assert.deepEqual(addTokenUsage(null, { inputTokens: NaN, outputTokens: -1 }), unavailable)
  assert.equal(hasCompleteUsage({ id: 'zero', status: 'completed', usage: addTokenUsage(null, { inputTokens: 0, outputTokens: 0 }) }), true)
})

test('conversation totals include failed attempts and retries, with missing history marked incomplete', () => {
  const failed = { id: 'first', status: 'failed' as const, usage: addTokenUsage(null, { inputTokens: 100, outputTokens: 20 }) }
  const retried = { id: 'retry', status: 'completed' as const, usage: addTokenUsage(null, { inputTokens: 150, outputTokens: 30 }) }
  const old = { id: 'old', status: 'completed' as const, usage: null }
  assert.deepEqual(summarizeTokenUsage([failed, retried, old]), { inputTokens: 250, outputTokens: 50, recordedRuns: 2, complete: false })
  assert.deepEqual(summarizeTokenUsage([old]), { inputTokens: null, outputTokens: null, recordedRuns: 0, complete: false })
  assert.equal(summarizeTokenUsage([retried]).complete, true)
  assert.equal(summarizeTokenUsage([]).complete, false)
})
