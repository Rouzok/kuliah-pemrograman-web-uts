import { mergeAircraftStates } from './mapBounds.js';

/**
 * Controller for the 30-second live map update loop (Task-12).
 * Fulfills requirements:
 * - F-03: Fetch on entry, every 30s while eligible, pause on hidden/offline/navigation,
 *   prevent overlaps, failure retains stale records and pauses until explicit retry.
 * - NF-05: Prevents unnecessary requests, uses latest viewport bounds on ticks.
 */
export function createFlightUpdateController({
  getBounds,
  getFlights,
  onData,
  onError,
  onPending = () => {},
  now = Date.now,
  setTimer = setInterval,
  clearTimer = clearInterval,
  intervalMs = 30000,
}) {
  let eligible = false;
  let disposed = false;
  let failed = false;
  let retryAt = 0;
  let active = null;
  let timer = null;

  function stopTimer() {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  }

  function startTimer() {
    if (timer === null && eligible && !failed && !disposed) {
      timer = setTimer(() => {
        update(false);
      }, intervalMs);
    }
  }

  async function update(explicitRetry = false) {
    if (disposed) return false;
    // Automatic update while ineligible or failed is prevented
    if (!eligible && !explicitRetry) return false;
    if (failed && !explicitRetry) return false;
    // Prevent overlapping concurrent requests (F-03)
    if (active !== null) return false;

    const controller = new AbortController();
    active = controller;
    onPending(true);

    try {
      const boxes = getBounds();
      if (!Array.isArray(boxes) || boxes.length < 1 || boxes.length > 2) {
        throw new Error('Viewport bounds are unavailable.');
      }

      // Fetch all bounding boxes (1 or 2 if antimeridian crossed)
      const responses = await Promise.all(
        boxes.map((bbox) => getFlights({ bbox }, { signal: controller.signal }))
      );

      // Check if aborted or disposed while waiting for response
      if (active !== controller || disposed) {
        return false;
      }

      const snapshots = responses.map((r) => r.meta);
      const mergedData = mergeAircraftStates(responses.map((r) => r.data));

      const oldestFetchedAt = snapshots.reduce(
        (oldest, meta) => (Date.parse(meta.fetchedAt) < Date.parse(oldest) ? meta.fetchedAt : oldest),
        snapshots[0]?.fetchedAt || new Date().toISOString()
      );
      const minSnapshotTime = Math.min(...snapshots.map((meta) => meta.snapshotTime));

      onData({
        data: mergedData,
        snapshots,
        meta: {
          source: 'opensky',
          fetchedAt: oldestFetchedAt,
          snapshotTime: minSnapshotTime,
        },
      });

      failed = false;
      retryAt = 0;

      // Ensure timer is running for subsequent ticks
      if (eligible) {
        startTimer();
      }

      return true;
    } catch (error) {
      if (active !== controller || disposed) {
        return false;
      }
      controller.abort();
      failed = true;
      retryAt = Number.isFinite(error?.retryAt) ? error.retryAt : 0;
      stopTimer(); // Failure pauses automatic updates until explicit retry (F-03)
      onError(error);
      return false;
    } finally {
      if (active === controller) {
        active = null;
        onPending(false);
      }
    }
  }

  function setEligibility(isEligible) {
    eligible = Boolean(isEligible);
    if (!eligible) {
      stopTimer();
    } else if (!failed) {
      startTimer();
    }
  }

  function dispose() {
    disposed = true;
    stopTimer();
    if (active) {
      active.abort();
      active = null;
    }
  }

  return {
    update,
    setEligibility,
    dispose,
    isFailed: () => failed,
    getRetryAt: () => retryAt,
  };
}

