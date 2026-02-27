/**
 * DSP utility functions — extracted from AudioFabricEngine for testability.
 */

export function calcAmplitude(timeData) {
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
  return Math.min(1, Math.sqrt(sum / timeData.length) * 4);
}

export function detectPitch(timeData, sampleRate) {
  const SIZE = timeData.length;
  const MAX = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let found = false;

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += timeData[i] * timeData[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  for (let offset = 40; offset < MAX; offset++) {
    let correlation = 0;
    for (let i = 0; i < MAX; i++) {
      correlation += Math.abs(timeData[i] - timeData[i + offset]);
    }
    correlation = 1 - (correlation / MAX);

    if (correlation > 0.9 && correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
      found = true;
    } else if (found && correlation < bestCorrelation * 0.8) {
      break;
    }
  }

  return (bestCorrelation > 0.01 && bestOffset > 0) ? sampleRate / bestOffset : -1;
}

export function calcFricativeEnergy(freqData, sampleRate, fftSize) {
  const binSize = sampleRate / fftSize;
  const startBin = Math.floor(4000 / binSize);
  let sum = 0;
  let count = 0;
  for (let i = startBin; i < freqData.length; i++) {
    const val = Math.pow(10, freqData[i] / 20);
    sum += val;
    count++;
  }
  return count > 0 ? Math.min(1, (sum / count) * 10) : 0;
}

export function calcBandEnergy(freqData, lowHz, highHz, sampleRate, fftSize) {
  const binSize = sampleRate / fftSize;
  const lo = Math.floor(lowHz / binSize);
  const hi = Math.min(Math.floor(highHz / binSize), freqData.length - 1);
  let sum = 0;
  let count = 0;
  for (let i = lo; i <= hi; i++) {
    const val = Math.pow(10, freqData[i] / 20);
    sum += val;
    count++;
  }
  return count > 0 ? Math.min(1, (sum / count) * 8) : 0;
}

export function calcSilence(amplitude, silenceFrames) {
  if (amplitude < 0.02) {
    silenceFrames = Math.min(120, silenceFrames + 1);
  } else {
    silenceFrames = Math.max(0, silenceFrames - 2);
  }
  return { value: Math.min(1, silenceFrames / 60), silenceFrames };
}

export function calcVagalTone(compositeRings) {
  const weights = [0.2, 0.25, 0.1, 0.15, 0.1, 0.1, 0.1];
  let vagalTone = 0;
  for (let i = 0; i < 7; i++) vagalTone += compositeRings[i] * weights[i];
  return vagalTone;
}

export function calcCoherence(compositeRings) {
  const PHI = (1 + Math.sqrt(5)) / 2;
  let phiSum = 0;
  for (let i = 0; i < 6; i++) {
    const a = compositeRings[i];
    const b = compositeRings[i + 1];
    if (a > 0.01 && b > 0.01) {
      const ratio = Math.max(a, b) / Math.min(a, b);
      phiSum += 1 - Math.abs(ratio - PHI) / PHI;
    }
  }
  return Math.max(0, Math.min(1, phiSum / 6));
}
