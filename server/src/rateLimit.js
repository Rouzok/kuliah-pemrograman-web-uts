// Fixed windows start at the first request. No timers or external services.
export function createRateLimiter({ now = Date.now, maxEntries = 10000 } = {}) {
  const clients = new Map();
  return {
    limit({ key }) {
      const time = now();
      let entry = clients.get(key);
      if (!entry || entry.expiresAt <= time) {
        if (clients.size >= maxEntries) {
          for (const [ip, client] of clients) if (client.expiresAt <= time) clients.delete(ip);
          // Do not evict active limits and let rejected clients start over.
          if (!clients.has(key) && clients.size >= maxEntries) throw new Error('Limiter capacity reached.');
        }
        entry = { count: 0, expiresAt: time + 60000 };
        clients.set(key, entry);
      }
      if (entry.count >= 60) return { success: false };
      entry.count++;
      return { success: true };
    },
  };
}
