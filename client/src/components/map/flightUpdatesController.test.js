import { describe, expect, test, mock } from 'bun:test';
import { createFlightUpdateController } from './flightUpdatesController.js';

describe('Flight updates controller (Task-12)', () => {
  test('ineligible transitions cancel pending work and ignore its late result', async () => {
    let finish;
    let signal;
    const onData = mock(() => {});
    const controller = createFlightUpdateController({
      getBounds: () => [[0, 0, 1, 1]],
      getFlights: (_, options) => { signal = options.signal; return new Promise((resolve) => { finish = resolve; }); },
      onData,
      onError: () => {},
      setTimer: () => 1,
      clearTimer: () => {},
    });
    controller.setEligibility(true);
    const pending = controller.update();
    controller.setEligibility(false);
    expect(signal.aborted).toBe(true);
    expect(await controller.update(true)).toBe(false);
    finish({ data: [], meta: { fetchedAt: new Date().toISOString(), snapshotTime: 1 } });
    expect(await pending).toBe(false);
    expect(onData).not.toHaveBeenCalled();
    controller.dispose();
  });
  test('fetches flights and invokes onData when eligible', async () => {
    const mockFlightsData = [{ icao24: 'abc123', callsign: 'TEST1', time_position: 1000 }];
    const getFlights = mock(async () => ({
      data: mockFlightsData,
      meta: { fetchedAt: '2026-11-02T16:00:00.000Z', snapshotTime: 1000, source: 'opensky' },
    }));

    let receivedData = null;
    const controller = createFlightUpdateController({
      getBounds: () => [[-10, 95, 6, 141]],
      getFlights,
      onData: (payload) => {
        receivedData = payload;
      },
      onError: () => {},
    });

    controller.setEligibility(true);
    const updated = await controller.update();

    expect(updated).toBe(true);
    expect(getFlights).toHaveBeenCalled();
    expect(receivedData).toBeDefined();
    expect(receivedData.data.length).toBe(1);
    expect(receivedData.data[0].icao24).toBe('abc123');
  });

  test('prevents overlapping requests when another request is in flight', async () => {
    let resolveFirst;
    const slowGetFlights = mock(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );

    const controller = createFlightUpdateController({
      getBounds: () => [[-10, 95, 6, 141]],
      getFlights: slowGetFlights,
      onData: () => {},
      onError: () => {},
    });

    controller.setEligibility(true);
    const firstCallPromise = controller.update();
    const secondCallResult = await controller.update(); // Called while first is in flight

    expect(secondCallResult).toBe(false); // Second call rejected due to overlap

    resolveFirst({
      data: [],
      meta: { fetchedAt: '2026-11-02T16:00:00.000Z', snapshotTime: 1000, source: 'opensky' },
    });
    await firstCallPromise;
  });

  test('on failure, stops timer, reports error, and pauses until explicit retry', async () => {
    const errorToThrow = new Error('Upstream failed');
    let now = Date.now();
    errorToThrow.retryAt = now + 60000;

    const failingGetFlights = mock(async () => {
      throw errorToThrow;
    });

    let reportedError = null;
    let timerStopped = false;

    const controller = createFlightUpdateController({
      getBounds: () => [[-10, 95, 6, 141]],
      getFlights: failingGetFlights,
      now: () => now,
      onData: () => {},
      onError: (err) => {
        reportedError = err;
      },
      clearTimer: () => {
        timerStopped = true;
      },
    });

    controller.setEligibility(true);
    const success = await controller.update();

    expect(success).toBe(false);
    expect(reportedError).toBe(errorToThrow);
    expect(timerStopped).toBe(true);

    // Automatic update while failed without explicit retry should be rejected
    const autoRetryResult = await controller.update(false);
    expect(autoRetryResult).toBe(false);

    expect(await controller.update(true)).toBe(false);
    now = errorToThrow.retryAt;
    // Explicit retry may proceed once the cooldown expires.
    let explicitAttempted = false;
    failingGetFlights.mockImplementationOnce(async () => {
      explicitAttempted = true;
      return {
        data: [],
        meta: { fetchedAt: '2026-11-02T16:05:00.000Z', snapshotTime: 1050, source: 'opensky' },
      };
    });

    const explicitSuccess = await controller.update(true);
    expect(explicitAttempted).toBe(true);
    expect(explicitSuccess).toBe(true);
  });
});

