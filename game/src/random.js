// A small seeded random source (mulberry32) so a screenshot scene can be
// staged exactly the same way every time from one seed.
export function makeRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an integer in [min, max] from a random source.
export function intBetween(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

// Pick one item from an array.
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
