import { test, expect } from 'bun:test';
import { createGlobeUpdates } from './globeUpdates.js';

const envelope = (data = [], snapshotTime = 10) => ({ data, meta: { source: 'opensky', fetchedAt: `2026-11-01T00:00:${snapshotTime}Z`, snapshotTime } });
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
function fixture(options = {}) {
  let tick;
  let clock = 0;
  let calls = 0;
  let bounds = [[0, 0, 1, 1]];
  const data = [];
  const errors = [];
  const pending = [];
  const controller = createGlobeUpdates({
    getBounds: () => bounds,
    getFlights: async () => {
      calls++;
      return envelope();
    },
    onData: (value) => data.push(value),
    onError: (error) => errors.push(error),
    onPending: (value) => pending.push(value),
    now: () => clock,
    setTimer: (callback, delay) => {
      expect(delay).toBe(30000);
      tick = callback;
      return 1;
    },
    clearTimer: () => {
      tick = undefined;
    },
    ...options,
  });
  return {
    controller,
    data,
    errors,
    pending,
    tick: () => tick?.(),
    calls: () => calls,
    hasTimer: () => Boolean(tick),
    bounds: (value) => {
      bounds = value;
    },
    clock: (value) => {
      clock = value;
    },
  };
}

test('entry and scheduled updates use latest bounds; eligibility pauses and resumes', async () => {
  const seen = [];
  const f = fixture({
    getFlights: async ({ bbox }) => {
      seen.push(bbox);
      return envelope();
    },
  });
  expect(seen).toEqual([]);
  f.controller.setEligible(true);
  await settle();
  expect(seen).toEqual([[0, 0, 1, 1]]);
  f.bounds([[2, 2, 3, 3]]);
  expect(seen.length).toBe(1);
  await f.tick();
  expect(seen[1]).toEqual([2, 2, 3, 3]);
  f.controller.setEligible(false);
  expect(f.hasTimer()).toBe(false);
  f.controller.setEligible(true);
  await settle();
  expect(seen.length).toBe(3);
  f.controller.dispose();
});

test('pending requests never overlap and obsolete success is ignored', async () => {
  let resolve;
  let signal;
  let calls = 0;
  const f = fixture({
    getFlights: (_, options) => {
      calls++;
      signal = options.signal;
      return new Promise((done) => {
        resolve = done;
      });
    },
  });
  f.controller.setEligible(true);
  await f.tick();
  await f.tick();
  expect(calls).toBe(1);
  f.controller.setEligible(false);
  expect(signal.aborted).toBe(true);
  resolve(envelope());
  await settle();
  expect(f.data).toEqual([]);
  expect(f.errors).toEqual([]);
  expect(f.pending).toEqual([true, false]);
  f.controller.dispose();
});

test('split antimeridian responses merge by ICAO24 retaining freshest observations', async () => {
  const f = fixture({
    getFlights: async ({ bbox }) =>
      bbox[1] === 170
        ? envelope([
            { icao24: 'abc123', time_position: 1, last_contact: 2 },
            { icao24: 'def456', time_position: 2 },
          ])
        : envelope([{ icao24: 'abc123', time_position: 3, last_contact: 4 }], 11),
  });
  f.bounds([
    [-10, 170, 10, 180],
    [-10, -180, 10, -170],
  ]);
  f.controller.setEligible(true);
  await settle();
  expect(f.data[0].data).toEqual([
    { icao24: 'abc123', time_position: 3, last_contact: 4 },
    { icao24: 'def456', time_position: 2 },
  ]);
  expect(f.data[0].meta.snapshotTime).toBe(10);
  expect(f.data[0].snapshots.map((meta) => meta.snapshotTime)).toEqual([10, 11]);
  f.controller.dispose();
});

test('failure preserves previous data and pauses until explicit retry beyond cooldown', async () => {
  let calls = 0;
  const error = Object.assign(new Error('Quota reached.'), { retryAt: 60000 });
  const f = fixture({
    getFlights: async () => {
      calls++;
      if (calls === 2) throw error;
      return envelope();
    },
  });
  f.controller.setEligible(true);
  await settle();
  await f.tick();
  expect(f.data.length).toBe(1);
  expect(f.errors).toEqual([error]);
  expect(f.hasTimer()).toBe(false);
  f.controller.setEligible(false);
  f.controller.setEligible(true);
  await settle();
  expect(calls).toBe(2);
  expect(await f.controller.retry()).toBe(false);
  f.clock(60000);
  expect(calls).toBe(2);
  expect(await f.controller.retry()).toBe(true);
  expect(calls).toBe(3);
  expect(f.data.length).toBe(2);
  expect(f.hasTimer()).toBe(true);
  f.controller.dispose();
});

test('a failed split publishes no partial data; disposal ignores late failures', async () => {
  let reject;
  let signal;
  const f = fixture({
    getFlights: ({ bbox }, options) => {
      signal = options.signal;
      if (bbox[1] === 170) return Promise.resolve(envelope([{ icao24: 'abc123' }]));
      return new Promise((_, done) => {
        reject = done;
      });
    },
  });
  f.bounds([
    [-10, 170, 10, 180],
    [-10, -180, 10, -170],
  ]);
  f.controller.setEligible(true);
  await settle();
  expect(f.data).toEqual([]);
  f.controller.dispose();
  reject(new Error('Obsolete'));
  await settle();
  expect(signal.aborted).toBe(true);
  expect(f.errors).toEqual([]);
  f.controller.setEligible(true);
  expect(await f.controller.retry()).toBe(false);
  expect(f.hasTimer()).toBe(false);
});

test('interrupted explicit recovery stays paused after eligibility returns', async () => {
  let calls = 0;
  let resolve;
  let signal;
  const error = new Error('Unavailable');
  const f = fixture({
    getFlights: (_, options) => {
      calls++;
      if (calls === 1) return Promise.reject(error);
      if (calls === 2) {
        signal = options.signal;
        return new Promise((done) => {
          resolve = done;
        });
      }
      return Promise.resolve(envelope());
    },
  });
  f.controller.setEligible(true);
  await settle();
  const recovery = f.controller.retry();
  expect(calls).toBe(2);
  f.controller.setEligible(false);
  expect(signal.aborted).toBe(true);
  f.controller.setEligible(true);
  await settle();
  expect(calls).toBe(2);
  expect(f.hasTimer()).toBe(false);
  resolve(envelope());
  expect(await recovery).toBe(false);
  expect(f.data).toEqual([]);
  expect(f.errors).toEqual([error]);
  expect(await f.controller.retry()).toBe(true);
  expect(calls).toBe(3);
  expect(f.hasTimer()).toBe(true);
  f.controller.dispose();
});
