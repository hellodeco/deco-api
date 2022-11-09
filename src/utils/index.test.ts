import { chunkStr, chunkArr } from './index'

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

describe('chunkArr', () => {
  it('creates chunks', () => {
    let input = new Array(300).fill(null)
    let chunks = chunkArr(input)

    expect(chunks.length).toEqual(3)

    for (let chunk of chunks) {
      expect(chunk.length).toEqual(100)
    }

    input = [1, 2, 3, 4, 5]
    chunks = chunkArr(input, 2)

    expect(chunks.length).toEqual(3)
    expect(chunks[0]).toEqual([1, 2])
    expect(chunks[1]).toEqual([3, 4])
    expect(chunks[2]).toEqual([5])
  })
})
