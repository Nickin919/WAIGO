const { describe, it } = require('node:test');
const assert = require('node:assert');
const { shuffleWithSeed } = require('./shuffle');

describe('shuffleWithSeed', () => {
  it('returns same order for same seed and array', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const seed = 12345;
    const one = shuffleWithSeed(arr, seed);
    const two = shuffleWithSeed(arr, seed);
    assert.deepStrictEqual(one, two);
  });

  it('returns different order for different seed', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const one = shuffleWithSeed(arr, 1);
    const two = shuffleWithSeed(arr, 999999);
    assert.notDeepStrictEqual(one, two);
  });

  it('contains all and only original elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleWithSeed(arr, 999);
    assert.strictEqual(shuffled.length, arr.length);
    assert.deepStrictEqual([...shuffled].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  });

  it('does not mutate original array', () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    shuffleWithSeed(arr, 42);
    assert.deepStrictEqual(arr, copy);
  });
});
