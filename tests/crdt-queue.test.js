import { describe, it, expect, beforeEach } from 'vitest';
import { CRDTQueue } from '../lib/crdt-queue.js';

describe('CRDTQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new CRDTQueue();
  });

  describe('add', () => {
    it('adds an item with auto-incrementing position', () => {
      const entry = queue.add({ name: 'track-1' });
      expect(entry.id).toBeDefined();
      expect(entry.position).toBe(1);
      expect(entry.data.name).toBe('track-1');
      expect(entry.deleted).toBe(false);
    });

    it('assigns incrementing positions to subsequent items', () => {
      queue.add({ name: 'a' });
      queue.add({ name: 'b' });
      const c = queue.add({ name: 'c' });
      expect(c.position).toBe(3);
    });

    it('returns unique ids', () => {
      const a = queue.add({ name: 'a' });
      const b = queue.add({ name: 'b' });
      expect(a.id).not.toBe(b.id);
    });

    it('includes a timestamp', () => {
      const before = Date.now();
      const entry = queue.add({ name: 'x' });
      expect(entry.timestamp).toBeGreaterThanOrEqual(before);
      expect(entry.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('remove', () => {
    it('marks an item as deleted', () => {
      const entry = queue.add({ name: 'doomed' });
      queue.remove(entry.id);
      expect(queue.items.get(entry.id).deleted).toBe(true);
    });

    it('does nothing for non-existent id', () => {
      queue.remove('no-such-id');
      expect(queue.getOrdered()).toHaveLength(0);
    });

    it('excludes deleted items from getOrdered', () => {
      const a = queue.add({ name: 'a' });
      queue.add({ name: 'b' });
      queue.remove(a.id);
      const ordered = queue.getOrdered();
      expect(ordered).toHaveLength(1);
      expect(ordered[0].data.name).toBe('b');
    });
  });

  describe('getOrdered', () => {
    it('returns empty array for new queue', () => {
      expect(queue.getOrdered()).toEqual([]);
    });

    it('returns items sorted by position', () => {
      queue.add({ name: 'first' });
      queue.add({ name: 'second' });
      queue.add({ name: 'third' });
      const ordered = queue.getOrdered();
      expect(ordered.map(i => i.data.name)).toEqual(['first', 'second', 'third']);
    });

    it('correctly orders after position gaps from deletions', () => {
      const a = queue.add({ name: 'a' });
      queue.add({ name: 'b' });
      queue.add({ name: 'c' });
      queue.remove(a.id);
      const ordered = queue.getOrdered();
      expect(ordered.map(i => i.data.name)).toEqual(['b', 'c']);
      expect(ordered[0].position).toBe(2);
    });
  });

  describe('serialize / merge', () => {
    it('serializes to plain object keyed by id', () => {
      const entry = queue.add({ name: 'x' });
      const serialized = queue.serialize();
      expect(serialized[entry.id]).toBeDefined();
      expect(serialized[entry.id].data.name).toBe('x');
    });

    it('merges remote items into local queue', () => {
      const local = new CRDTQueue();
      local.add({ name: 'local-track' });

      const remote = new CRDTQueue();
      remote.add({ name: 'remote-track' });

      local.merge(remote.serialize());
      const ordered = local.getOrdered();
      expect(ordered).toHaveLength(2);
      const names = ordered.map(i => i.data.name);
      expect(names).toContain('local-track');
      expect(names).toContain('remote-track');
    });

    it('remote wins when timestamp is newer', async () => {
      const a = queue.add({ name: 'original' });

      // Simulate remote with newer timestamp
      const remote = {};
      remote[a.id] = { ...a, data: { name: 'updated' }, timestamp: a.timestamp + 1000 };

      queue.merge(remote);
      expect(queue.items.get(a.id).data.name).toBe('updated');
    });

    it('local wins when local timestamp is newer', () => {
      const a = queue.add({ name: 'local-version' });

      const remote = {};
      remote[a.id] = { ...a, data: { name: 'old-remote' }, timestamp: a.timestamp - 1000 };

      queue.merge(remote);
      expect(queue.items.get(a.id).data.name).toBe('local-version');
    });

    it('merges deletion from remote', () => {
      const a = queue.add({ name: 'will-be-deleted' });

      const remote = {};
      remote[a.id] = { ...a, deleted: true, timestamp: a.timestamp + 1000 };

      queue.merge(remote);
      expect(queue.getOrdered()).toHaveLength(0);
    });
  });

  describe('positions after add following removal', () => {
    it('new items after deletion get position based on remaining items', () => {
      queue.add({ name: 'a' });
      const b = queue.add({ name: 'b' });
      queue.add({ name: 'c' });
      queue.remove(b.id);

      // Next item position should be max(1,3) + 1 = 4
      const d = queue.add({ name: 'd' });
      expect(d.position).toBe(4);
    });
  });
});
