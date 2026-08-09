import { describe, expect, it } from 'vitest'
import { formatDuration, getTaskStage, isTaskControllable } from './dashboard'

describe('dashboard presentation rules', () => {
  it('maps runtime nodes to a user-facing quality stage', () => {
    expect(getTaskStage('quality', 'RUNNING')).toBe('质量评估')
    expect(getTaskStage('feedback', 'RUNNING')).toBe('优化迭代')
  })

  it('only allows queued tasks to change priority', () => {
    expect(isTaskControllable('QUEUED', 'priority')).toBe(true)
    expect(isTaskControllable('RUNNING', 'priority')).toBe(false)
    expect(isTaskControllable('RUNNING', 'cancel')).toBe(true)
  })

  it('formats dashboard durations without false precision', () => {
    expect(formatDuration(null)).toBe('暂无数据')
    expect(formatDuration(92_000)).toBe('1分32秒')
  })
})
