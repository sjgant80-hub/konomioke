/**
 * CRDTQueue — Conflict-free Replicated Data Type for track queue ordering.
 * Extracted from index.html for testability.
 */

import { randomUUID } from 'node:crypto';

export class CRDTQueue {
  constructor() {
    this.items = new Map();
  }

  add(data) {
    const id = randomUUID();
    const maxPos = this.getOrdered().reduce((m, i) => Math.max(m, i.position), 0);
    const entry = { id, data, position: maxPos + 1, timestamp: Date.now(), deleted: false };
    this.items.set(id, entry);
    return entry;
  }

  remove(id) {
    const item = this.items.get(id);
    if (item) { item.deleted = true; item.timestamp = Date.now(); }
  }

  merge(remote) {
    for (const [id, rEntry] of Object.entries(remote)) {
      const local = this.items.get(id);
      if (!local || rEntry.timestamp > local.timestamp) {
        this.items.set(id, rEntry);
      }
    }
  }

  getOrdered() {
    return [...this.items.values()].filter(i => !i.deleted).sort((a, b) => a.position - b.position);
  }

  serialize() {
    return Object.fromEntries(this.items);
  }
}
