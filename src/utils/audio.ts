// utils/audio.ts
import type React from "react";

/**
 * Shared tuning constants & helpers
 */
export const START_NOTE = 25; // inclusive
export const END_NOTE = 72; // inclusive

export function getFrequency(keyNumber: number): number {
  // A4 = key 49 = 440 Hz (same formula you used)
  const frequency = 440 * Math.pow(2, (keyNumber - 49) / 12);
  return parseFloat(frequency.toFixed(6));
}

/**
 * Map an X coordinate (0..width) to a frequency across [START_NOTE..END_NOTE]
 * Uses exponential interpolation between semitones so pitch is musically correct.
 */
export function mapXToFreq(x: number, width: number): number {
  const numKeys = END_NOTE - START_NOTE + 1;
  const keyWidth = width / numKeys;

  // clamp
  let relativeX = x;
  if (relativeX < 0) relativeX = 0;
  if (relativeX > width) relativeX = width;

  const keyIndex = Math.floor(
    Math.min(Math.floor(relativeX / keyWidth), numKeys - 1)
  );
  const note = START_NOTE + keyIndex;

  const xInKey = (relativeX - keyIndex * keyWidth) / keyWidth; // 0..1 inside key

  const baseFreq = getFrequency(note);
  const nextFreq = getFrequency(note + 1);
  const freq = baseFreq * Math.pow(nextFreq / baseFreq, xInKey);

  return freq;
}

/**
 * Audio helpers used by App
 */
export async function initAudioContext(
  ctxRef: React.MutableRefObject<AudioContext | null>
): Promise<void> {
  if (!ctxRef.current) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    ctxRef.current = new AudioCtx();
  }
  if (ctxRef.current.state === "suspended") {
    await ctxRef.current.resume();
  }
}

export function startOscillator(
  ctx: AudioContext,
  oscRef: React.MutableRefObject<OscillatorNode | null>,
  gainRef: React.MutableRefObject<GainNode | null>,
  initialFreq: number
): void {
  if (oscRef.current) {
    // update frequency if already exists
    oscRef.current.frequency.setValueAtTime(initialFreq, ctx.currentTime);
    return;
  }
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = "sine";
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.08);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.frequency.setValueAtTime(initialFreq, ctx.currentTime);
  osc.start();

  oscRef.current = osc;
  gainRef.current = gainNode;
}

export function stopOscillator(
  ctx: AudioContext,
  oscRef: React.MutableRefObject<OscillatorNode | null>,
  gainRef: React.MutableRefObject<GainNode | null>
): void {
  if (!oscRef.current || !gainRef.current) return;

  const now = ctx.currentTime;
  const gainNode = gainRef.current.gain;
  gainNode.cancelScheduledValues(now);
  gainNode.linearRampToValueAtTime(0, now + 0.12);

  oscRef.current.stop(now + 0.14);

  // disconnect after a small timeout to allow ramp to finish
  setTimeout(() => {
    try {
      oscRef.current?.disconnect();
      gainRef.current?.disconnect();
    } catch (e) {
      // ignore
    }
    oscRef.current = null;
    gainRef.current = null;
  }, 200);
}
