import { describe, expect, it } from 'vitest'
import { parseContentPreview } from './contentPreview'

describe('parseContentPreview', () => {
  it('extracts readable fields from generated JSON content', () => {
    expect(parseContentPreview('{"body":"姝ｆ枃鍐呭","hashtags":["闃叉檼","鎶よ偆"],"summary":"鍐呭鎽樿"}')).toEqual({
      body: '姝ｆ枃鍐呭',
      hashtags: ['闃叉檼', '鎶よ偆'],
      summary: '鍐呭鎽樿',
    })
  })

  it('falls back to plain text when body is not valid JSON', () => {
    expect(parseContentPreview('鏅€氭鏂?')).toEqual({ body: '鏅€氭鏂?', hashtags: [], summary: '' })
  })

  it('turns a string hashtag into one readable tag', () => {
    expect(parseContentPreview('{"body":"姝ｆ枃","hashtags":"闃叉檼"}')).toEqual({ body: '姝ｆ枃', hashtags: ['闃叉檼'], summary: '' })
  })
})
