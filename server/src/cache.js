// Successful, sanitized responses only. Each caller receives an independent body.
export function createResponseCache({ now = Date.now, maxEntries = 100 } = {}) {
  const records = new Map();
  return {
    get(key) {
      const entry = records.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= now()) {
        records.delete(key);
        return null;
      }
      return Response.json(structuredClone(entry.body));
    },
    async set(key, response) {
      if (!response.ok) return;
      const body = await response.clone().json();
      const expiresAt = Date.parse(body.meta?.fetchedAt) + 30000;
      if (!(expiresAt > now())) return;
      for (const [storedKey, entry] of records) if (entry.expiresAt <= now()) records.delete(storedKey);
      records.delete(key);
      if (records.size >= maxEntries) records.delete(records.keys().next().value);
      records.set(key, { body, expiresAt });
    },
  };
}
