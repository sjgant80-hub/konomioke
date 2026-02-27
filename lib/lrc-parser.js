/**
 * LRC lyrics parser — extracted from TrackEngine.parseLRC for testability.
 */

export function parseLRC(text) {
  const lines = text.split('\n');
  const lyrics = [];
  for (const line of lines) {
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, '0'));
      const time = min * 60 + sec + ms / 1000;
      const text = match[4].trim();
      if (text) lyrics.push({ time, text });
    }
  }
  lyrics.sort((a, b) => a.time - b.time);
  return lyrics;
}
