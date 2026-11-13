export interface RunTokenUsage {
  inputTokens: number | null
  outputTokens: number | null
  steps: number
  reportedSteps: number
}

export interface RunUsageRecord {
  id: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  usage: RunTokenUsage | null
}

export function addTokenUsage(previous: RunTokenUsage | null, step: { inputTokens?: number; outputTokens?: number }): RunTokenUsage {
  const count = (value: number | undefined) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
  const input = count(step.inputTokens)
  const output = count(step.outputTokens)
  const add = (before: number | null | undefined, next: number | null) => next === null ? before ?? null : (before ?? 0) + next
  return {
    inputTokens: add(previous?.inputTokens, input),
    outputTokens: add(previous?.outputTokens, output),
    steps: (previous?.steps ?? 0) + 1,
    reportedSteps: (previous?.reportedSteps ?? 0) + (input !== null && output !== null ? 1 : 0),
  }
}

export function hasCompleteUsage(run: RunUsageRecord) {
  return run.status === 'completed' && !!run.usage && run.usage.steps > 0 && run.usage.reportedSteps === run.usage.steps
}

export function totalTokens(usage: Pick<RunTokenUsage, 'inputTokens' | 'outputTokens'> | null | undefined) {
  return usage?.inputTokens != null && usage.outputTokens != null ? usage.inputTokens + usage.outputTokens : null
}

export function summarizeTokenUsage(runs: RunUsageRecord[]) {
  const sum = (key: 'inputTokens' | 'outputTokens') => {
    const values = runs.flatMap(run => run.usage?.[key] == null ? [] : [run.usage[key]])
    return values.length ? values.reduce((a, b) => a + b, 0) : null
  }
  return {
    inputTokens: sum('inputTokens'), outputTokens: sum('outputTokens'),
    recordedRuns: runs.filter(run => run.usage !== null).length,
    complete: runs.length > 0 && runs.every(hasCompleteUsage),
  }
}
