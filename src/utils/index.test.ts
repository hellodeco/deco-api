import { chunkStr } from './index'

describe('chunkStr', () => {
  it('creates chunks', () => {
    let str = '123456789'
    let chunks = chunkStr(str, 3)
    expect(chunks).toEqual(['123', '456', '789'])

    // array with 10000 elements
    str = new Array(10001).join('a')
    chunks = chunkStr(str, 2000)
    expect(chunks.length).toBe(5)
    chunks.forEach((chunk) => {
      expect(chunk.length).toBe(2000)
    })

    // array with 3290 elements
    str = new Array(3291).join('a')
    chunks = chunkStr(str, 1000)
    expect(chunks.length).toBe(4)
    chunks.forEach((chunk, i) => {
      if (i === 3) {
        expect(chunk.length).toBe(290)
        return
      }

      expect(chunk.length).toBe(1000)
    })
  })

  it('handles empty string', () => {
    let str = ''
    let chunks = chunkStr(str)
    expect(chunks).toEqual([''])
  })
})
