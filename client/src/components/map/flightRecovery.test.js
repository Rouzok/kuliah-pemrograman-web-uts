import { describe, expect, test, mock } from 'bun:test';
import { createFlightUpdateController } from './flightUpdatesController.js';

describe('Flight Recovery and Error Handling (Task-21 / F-03, F-15, F-16)', () => {
  const dummyBbox = [-10, 105, 5, 120];

  test('retains previous records when an update fails, pauses automatic ticks, and enters failed state', async () => {
    let callCount = 0;
    const onData = mock(() => {});
    const onError = mock(() => {});
    const onPending = mock(() => {});

    const mockGetFlights = mock(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          data: [{ icao24: 'abc123', callsign: 'GARUDA1', longitude: 106.8, latitude: -6.2, on_ground: false }],
          meta: { fetchedAt: '2026-11-07T12:00:00Z', snapshotTime: 1794050000, source: 'opensky' },
        };
      }
      const err = new Error('Upstream provider timed out');
      err.status = 504;
      err.code = 'GATEWAY_TIMEOUT';
      throw err;
    });

    const controller = createFlightUpdateController({
      getBounds: () => [dummyBbox],
      getFlights: mockGetFlights,
      onData,
      onError,
      onPending,
      intervalMs: 1000,
    });

    controller.setEligibility(true);

    // 1st call: Initial successful update
    const firstSuccess = await controller.update(false);
    expect(firstSuccess).toBe(true);
    expect(onData).toHaveBeenCalledTimes(1);
    expect(controller.isFailed()).toBe(false);

    // 2nd call: Failure occurs
    const secondResult = await controller.update(false);
    expect(secondResult).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(controller.isFailed()).toBe(true);

    // Automatic update while in failed state is blocked without explicit retry (F-03)
    const blockedAuto = await controller.update(false);
    expect(blockedAuto).toBe(false);
    expect(mockGetFlights).toHaveBeenCalledTimes(2); // No 3rd call made automatically

    controller.dispose();
  });

  test('explicit retry recovers controller from failure when network succeeds', async () => {
    let failNow = true;
    const onData = mock(() => {});
    const onError = mock(() => {});

    const mockGetFlights = mock(async () => {
      if (failNow) {
        const err = new Error('Network failure');
        err.status = 500;
        throw err;
      }
      return {
        data: [{ icao24: 'def456', callsign: 'LION2', longitude: 107.1, latitude: -6.5, on_ground: false }],
        meta: { fetchedAt: '2026-11-07T12:05:00Z', snapshotTime: 1794050300, source: 'opensky' },
      };
    });

    const controller = createFlightUpdateController({
      getBounds: () => [dummyBbox],
      getFlights: mockGetFlights,
      onData,
      onError,
    });

    controller.setEligibility(true);

    // First attempt fails
    await controller.update(true);
    expect(controller.isFailed()).toBe(true);

    // Network recovers
    failNow = false;

    // Explicit retry (explicitRetry = true) succeeds
    const recovered = await controller.update(true);
    expect(recovered).toBe(true);
    expect(controller.isFailed()).toBe(false);
    expect(onData).toHaveBeenCalledTimes(1);

    controller.dispose();
  });

  test('preserves error retryAt cooldown timestamp', async () => {
    const cooldownTimestamp = Date.now() + 60000;
    const onError = mock(() => {});

    const mockGetFlights = mock(async () => {
      const err = new Error('Rate limit exceeded');
      err.status = 429;
      err.retryAt = cooldownTimestamp;
      throw err;
    });

    const controller = createFlightUpdateController({
      getBounds: () => [dummyBbox],
      getFlights: mockGetFlights,
      onData: () => {},
      onError,
    });

    await controller.update(true);
    expect(controller.isFailed()).toBe(true);
    expect(controller.getRetryAt()).toBe(cooldownTimestamp);

    controller.dispose();
  });

  test('empty array response is treated as valid zero-aircraft coverage rather than error', async () => {
    const onData = mock(() => {});
    const onError = mock(() => {});

    const mockGetFlights = mock(async () => ({
      data: [],
      meta: { fetchedAt: '2026-11-07T12:10:00Z', snapshotTime: 1794050600, source: 'opensky' },
    }));

    const controller = createFlightUpdateController({
      getBounds: () => [dummyBbox],
      getFlights: mockGetFlights,
      onData,
      onError,
    });

    const result = await controller.update(true);
    expect(result).toBe(true);
    expect(controller.isFailed()).toBe(false);
    expect(onError).toHaveBeenCalledTimes(0);
    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData.mock.calls[0][0].data).toEqual([]);

    controller.dispose();
  });
});
