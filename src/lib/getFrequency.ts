export default function getFrequency(keyNumber: number): number {
  const frequency = 440 * Math.pow(2, (keyNumber - 49) / 12);
  return parseFloat(frequency.toFixed(3));
}
