import { mergeStates } from './globeMath.js';

// The consumer combines scene visibility, document visibility and online state.
// Bounds are one or two already-split [south, west, north, east] boxes.
export function createGlobeUpdates({ getBounds, getFlights, onData, onError, onPending = () => {}, now = Date.now, setTimer = setInterval, clearTimer = clearInterval }) {
  let eligible = false;
  let disposed = false;
  let failed = false;
  let retryAt = 0;
  let active = null;
  let timer = null;

  function stopTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  async function update(explicitRetry = false) {
    if (!eligible || disposed || active || (failed && !explicitRetry)) return false;
    const controller = new AbortController();
    active = controller;
    onPending(true);
    try {
      const boxes = getBounds();
      if (!Array.isArray(boxes) || boxes.length < 1 || boxes.length > 2) throw new Error('Globe bounds are unavailable.');
      const responses = await Promise.all(boxes.map((bbox) => getFlights({ bbox }, { signal: controller.signal })));
      if (active !== controller || disposed || !eligible) return false;
      // Combined freshness is the oldest constituent snapshot; retain each original.
      const snapshots = responses.map((response) => response.meta);
      onData({
        data: mergeStates(responses.map((response) => response.data)),
        snapshots,
        meta: {
          source: 'opensky',
          fetchedAt: snapshots.reduce((oldest, meta) => (Date.parse(meta.fetchedAt) < Date.parse(oldest) ? meta.fetchedAt : oldest), snapshots[0].fetchedAt),
          snapshotTime: Math.min(...snapshots.map((meta) => meta.snapshotTime)),
        },
      });
      failed = false;
      retryAt = 0;
      return true;
    } catch (error) {
      if (active !== controller || disposed || !eligible) return false;
      controller.abort();
      failed = true;
      retryAt = Number.isFinite(error.retryAt) ? error.retryAt : 0;
      stopTimer();
      onError(error);
      return false;
    } finally {
      if (active === controller) {
        active = null;
        onPending(false);
      }
    }
  }

  function startTimer() {
    if (timer === null) timer = setTimer(update, 30000);
  }

  return {
    setEligible(value) {
      if (disposed || eligible === Boolean(value)) return;
      eligible = Boolean(value);
      if (!eligible) {
        stopTimer();
        if (active) {
          active.abort();
          active = null;
          onPending(false);
        }
      } else if (!failed) {
        startTimer();
        void update();
      }
    },
    async retry() {
      if (disposed || !eligible || active || now() < retryAt) return false;
      const success = await update(true);
      if (success && eligible && !disposed) startTimer();
      return success;
    },
    dispose() {
      disposed = true;
      eligible = false;
      stopTimer();
      if (active) {
        active.abort();
        active = null;
        onPending(false);
      }
    },
  };
}
