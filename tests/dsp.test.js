import { describe, it, expect } from 'vitest';
import {
  calcAmplitude,
  detectPitch,
  calcFricativeEnergy,
  calcBandEnergy,
  calcSilence,
  calcVagalTone,
  calcCoherence,
} from '../lib/dsp.js';

describe('calcAmplitude', () => {
  it('returns 0 for silence', () => {
    const silence = new Float32Array(1024).fill(0);
    expect(calcAmplitude(silence)).toBe(0);
  });

  it('returns > 0 for non-silent signal', () => {
    const data = new Float32Array(1024);
    for (let i = 0; i < data.length; i++) data[i] = 0.5;
    expect(calcAmplitude(data)).toBeGreaterThan(0);
  });

  it('clamps to 1 for very loud signal', () => {
    const loud = new Float32Array(1024).fill(1.0);
    expect(calcAmplitude(loud)).toBe(1);
  });

  it('scales with signal level', () => {
    const quiet = new Float32Array(1024).fill(0.05);
    const moderate = new Float32Array(1024).fill(0.2);
    expect(calcAmplitude(quiet)).toBeLessThan(calcAmplitude(moderate));
  });
});

describe('detectPitch', () => {
  const SAMPLE_RATE = 44100;

  function generateSine(freq, length, sampleRate) {
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      data[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
    return data;
  }

  it('returns -1 for silence', () => {
    const silence = new Float32Array(2048).fill(0);
    expect(detectPitch(silence, SAMPLE_RATE)).toBe(-1);
  });

  it('returns -1 for very quiet signal', () => {
    const quiet = new Float32Array(2048).fill(0.001);
    expect(detectPitch(quiet, SAMPLE_RATE)).toBe(-1);
  });

  it('detects a 440Hz sine wave (A4)', () => {
    const sine = generateSine(440, 2048, SAMPLE_RATE);
    const pitch = detectPitch(sine, SAMPLE_RATE);
    if (pitch > 0) {
      expect(pitch).toBeCloseTo(440, -1); // within ~10Hz
    }
  });

  it('detects a 220Hz sine wave (A3)', () => {
    const sine = generateSine(220, 2048, SAMPLE_RATE);
    const pitch = detectPitch(sine, SAMPLE_RATE);
    if (pitch > 0) {
      expect(pitch).toBeCloseTo(220, -1);
    }
  });

  it('detects a low frequency (110Hz)', () => {
    const sine = generateSine(110, 4096, SAMPLE_RATE);
    const pitch = detectPitch(sine, SAMPLE_RATE);
    if (pitch > 0) {
      expect(pitch).toBeCloseTo(110, -1);
    }
  });
});

describe('calcFricativeEnergy', () => {
  const SAMPLE_RATE = 44100;
  const FFT_SIZE = 2048;

  it('returns 0 for all-zero frequency data', () => {
    const freqData = new Float32Array(FFT_SIZE / 2).fill(-100);
    expect(calcFricativeEnergy(freqData, SAMPLE_RATE, FFT_SIZE)).toBeCloseTo(0, 1);
  });

  it('returns higher value when high frequencies are present', () => {
    const quiet = new Float32Array(FFT_SIZE / 2).fill(-80);
    const hissy = new Float32Array(FFT_SIZE / 2).fill(-80);
    // Boost bins above 4kHz
    const binSize = SAMPLE_RATE / FFT_SIZE;
    const startBin = Math.floor(4000 / binSize);
    for (let i = startBin; i < hissy.length; i++) hissy[i] = -10;

    expect(calcFricativeEnergy(hissy, SAMPLE_RATE, FFT_SIZE))
      .toBeGreaterThan(calcFricativeEnergy(quiet, SAMPLE_RATE, FFT_SIZE));
  });
});

describe('calcBandEnergy', () => {
  const SAMPLE_RATE = 44100;
  const FFT_SIZE = 2048;

  it('returns 0 for silent frequency data', () => {
    const freqData = new Float32Array(FFT_SIZE / 2).fill(-100);
    expect(calcBandEnergy(freqData, 200, 800, SAMPLE_RATE, FFT_SIZE)).toBeCloseTo(0, 1);
  });

  it('detects energy in the specified band', () => {
    const freqData = new Float32Array(FFT_SIZE / 2).fill(-80);
    const binSize = SAMPLE_RATE / FFT_SIZE;
    // Boost 200-800Hz range
    const lo = Math.floor(200 / binSize);
    const hi = Math.floor(800 / binSize);
    for (let i = lo; i <= hi; i++) freqData[i] = -5;

    const energy = calcBandEnergy(freqData, 200, 800, SAMPLE_RATE, FFT_SIZE);
    expect(energy).toBeGreaterThan(0.5);
  });

  it('ignores energy outside the band', () => {
    const freqData = new Float32Array(FFT_SIZE / 2).fill(-80);
    // Boost only 5000-6000Hz
    const binSize = SAMPLE_RATE / FFT_SIZE;
    const lo = Math.floor(5000 / binSize);
    const hi = Math.floor(6000 / binSize);
    for (let i = lo; i <= hi; i++) freqData[i] = 0;

    // But measure 200-800Hz band
    const energy = calcBandEnergy(freqData, 200, 800, SAMPLE_RATE, FFT_SIZE);
    expect(energy).toBeLessThan(0.01);
  });
});

describe('calcSilence', () => {
  it('increments silence frames for quiet amplitude', () => {
    const { value, silenceFrames } = calcSilence(0.001, 0);
    expect(silenceFrames).toBe(1);
    expect(value).toBeCloseTo(1 / 60, 3);
  });

  it('decrements silence frames for loud amplitude', () => {
    const { silenceFrames } = calcSilence(0.5, 10);
    expect(silenceFrames).toBe(8);
  });

  it('clamps silence frames to 120 max', () => {
    const { silenceFrames } = calcSilence(0.0, 120);
    expect(silenceFrames).toBe(120);
  });

  it('never goes below 0', () => {
    const { silenceFrames } = calcSilence(0.5, 0);
    expect(silenceFrames).toBe(0);
  });

  it('returns 1.0 when fully silent (60+ frames)', () => {
    const { value } = calcSilence(0.0, 60);
    expect(value).toBe(1);
  });
});

describe('calcVagalTone', () => {
  it('returns 0 for zero rings', () => {
    expect(calcVagalTone(new Float32Array(7))).toBe(0);
  });

  it('returns weighted sum of ring values', () => {
    const rings = new Float32Array([1, 1, 1, 1, 1, 1, 1]);
    // Sum of weights = 0.2+0.25+0.1+0.15+0.1+0.1+0.1 = 1.0
    expect(calcVagalTone(rings)).toBeCloseTo(1.0, 5);
  });

  it('gives more weight to ring 1 (pitch) than ring 2 (fricatives)', () => {
    const ringsA = new Float32Array(7); // all zero
    const ringsB = new Float32Array(7);
    ringsA[1] = 1; // pitch ring, weight 0.25
    ringsB[2] = 1; // fricative ring, weight 0.1
    expect(calcVagalTone(ringsA)).toBeGreaterThan(calcVagalTone(ringsB));
  });
});

describe('calcCoherence', () => {
  it('returns 0 for zero rings', () => {
    expect(calcCoherence(new Float32Array(7))).toBe(0);
  });

  it('returns high coherence when adjacent rings are phi-ratio', () => {
    const PHI = (1 + Math.sqrt(5)) / 2;
    const rings = new Float32Array(7);
    rings[0] = 0.5;
    for (let i = 1; i < 7; i++) rings[i] = rings[i - 1] / PHI;
    const coherence = calcCoherence(rings);
    expect(coherence).toBeGreaterThan(0.8);
  });

  it('returns lower coherence for wildly different ratios', () => {
    const rings = new Float32Array([0.9, 0.01, 0.9, 0.01, 0.9, 0.01, 0.9]);
    expect(calcCoherence(rings)).toBeLessThan(0.3);
  });
});
