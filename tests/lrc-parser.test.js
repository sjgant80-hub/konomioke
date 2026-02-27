import { describe, it, expect } from 'vitest';
import { parseLRC } from '../lib/lrc-parser.js';

describe('parseLRC', () => {
  it('parses a simple LRC line', () => {
    const result = parseLRC('[00:12.34]Hello world');
    expect(result).toEqual([{ time: 12.340, text: 'Hello world' }]);
  });

  it('parses multiple lines', () => {
    const lrc = `[00:05.00]First line
[00:10.50]Second line
[00:15.75]Third line`;
    const result = parseLRC(lrc);
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe('First line');
    expect(result[1].text).toBe('Second line');
    expect(result[2].text).toBe('Third line');
  });

  it('calculates time correctly', () => {
    const result = parseLRC('[02:30.500]Test');
    // 2*60 + 30 + 0.5 = 150.5
    expect(result[0].time).toBeCloseTo(150.5, 3);
  });

  it('handles 2-digit milliseconds by padding to 3', () => {
    const result = parseLRC('[00:00.05]Padded');
    // "05" padded to "050" → 50ms → 0.05
    expect(result[0].time).toBeCloseTo(0.05, 3);
  });

  it('handles 3-digit milliseconds', () => {
    const result = parseLRC('[00:00.123]Three digits');
    expect(result[0].time).toBeCloseTo(0.123, 3);
  });

  it('skips lines without timestamps', () => {
    const lrc = `[ti:Song Title]
[ar:Artist]
[00:05.00]Actual lyric`;
    const result = parseLRC(lrc);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Actual lyric');
  });

  it('skips lines with empty text after timestamp', () => {
    const lrc = `[00:05.00]
[00:10.00]Real text`;
    const result = parseLRC(lrc);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Real text');
  });

  it('trims whitespace from text', () => {
    const result = parseLRC('[00:01.00]  padded text  ');
    expect(result[0].text).toBe('padded text');
  });

  it('sorts lines by time even if out of order', () => {
    const lrc = `[00:20.00]Late
[00:05.00]Early
[00:10.00]Middle`;
    const result = parseLRC(lrc);
    expect(result.map(l => l.text)).toEqual(['Early', 'Middle', 'Late']);
  });

  it('returns empty array for empty string', () => {
    expect(parseLRC('')).toEqual([]);
  });

  it('returns empty array for non-LRC text', () => {
    expect(parseLRC('just some random text\nwith lines')).toEqual([]);
  });

  it('handles zero time', () => {
    const result = parseLRC('[00:00.00]Start');
    expect(result[0].time).toBe(0);
    expect(result[0].text).toBe('Start');
  });

  it('handles large timestamps', () => {
    const result = parseLRC('[99:59.99]End');
    // 99*60 + 59 + 0.99 = 5999.99
    expect(result[0].time).toBeCloseTo(5999.99, 2);
  });
});
