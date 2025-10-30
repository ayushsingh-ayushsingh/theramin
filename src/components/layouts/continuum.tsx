import React, { useRef, useCallback, useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";

interface KeyProps {
  className?: string;
  orientation?: "default" | "flipped" | "plain";
  onMouseEnter?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function NoteKey({
  orientation = "default",
  className = "h-screen bg-red-950",
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
  onClick,
}: KeyProps) {
  return (
    <div
      className={className}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      onClick={onClick}
    >
      {orientation === "default" && (
        <div className="h-screen grid grid-cols-2">
          <div className="bg-red-600"></div>
          <div className="bg-red-600"></div>
        </div>
      )}
      {orientation === "flipped" && (
        <div className="h-screen grid grid-cols-2">
          <div className="bg-red-950"></div>
          <div className="bg-red-950"></div>
        </div>
      )}
      {orientation === "plain" && (
        <div className="h-screen grid grid-cols-2">
          <div className="bg-red-600"></div>
          <div className="bg-red-600 border-r border-red-950/50"></div>
        </div>
      )}
    </div>
  );
}

// Standard equal temperament tuning
function getFrequency(keyNumber: number): number {
  const frequency = 440 * Math.pow(2, (keyNumber - 49) / 12);
  return parseFloat(frequency.toFixed(3));
}

export default function KeyboardContinuum() {
  const keyboardRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [_isPlaying, setIsPlaying] = useState(false);

  const [cursorX, setCursorX] = useState(0);
  const [cursorY, setCursorY] = useState(0);

  const START_NOTE = 25;
  const END_NOTE = 72;

  // Get frequency from mouse X across the entire keyboard width
  // Actual piano note, but with smooth interpolation
  const getFrequencyFromX = useCallback(
    (x: number) => {
      if (!keyboardRef.current) return getFrequency(START_NOTE);

      const rect = keyboardRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const numKeys = END_NOTE - START_NOTE + 1;
      const keyWidth = totalWidth / numKeys;

      const relativeX = x - rect.left;
      const keyIndex = Math.floor(relativeX / keyWidth);
      const note = START_NOTE + keyIndex;
      const xInKey = (relativeX % keyWidth) / keyWidth;

      const baseFreq = getFrequency(note);
      const nextFreq = getFrequency(note + 1);
      const freq = baseFreq * Math.pow(nextFreq / baseFreq, xInKey); // exponential interpolation

      return freq;
    },
    [START_NOTE, END_NOTE]
  );

  // Initialize audio
  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    setIsReady(true);
  }, []);

  // Start tone (once) — continuous sound field
  const startTone = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isReady) return;

      const audioCtx = audioContextRef.current!;
      let oscillator = oscillatorRef.current;
      let gainNode = gainRef.current;

      if (!oscillator) {
        oscillator = audioCtx.createOscillator();
        gainNode = audioCtx.createGain();

        oscillator.type = "sine";
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        const freq = getFrequencyFromX(event.clientX);
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
        oscillator.start();

        oscillatorRef.current = oscillator;
        gainRef.current = gainNode;
        setIsPlaying(true);
      }
    },
    [isReady, getFrequencyFromX]
  );

  const stopTone = useCallback(() => {
    if (!oscillatorRef.current || !gainRef.current) return;
    const audioCtx = audioContextRef.current!;
    const now = audioCtx.currentTime;

    const gain = gainRef.current.gain;
    gain.cancelScheduledValues(now);
    gain.linearRampToValueAtTime(0, now + 0.15);

    oscillatorRef.current.stop(now + 0.2);
    oscillatorRef.current.disconnect();
    gainRef.current.disconnect();

    oscillatorRef.current = null;
    gainRef.current = null;
    setIsPlaying(false);
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!oscillatorRef.current || !gainRef.current || !keyboardRef.current)
        return;

      const freq = getFrequencyFromX(event.clientX);

      setCursorX(event.clientX);

      oscillatorRef.current.frequency.exponentialRampToValueAtTime(
        freq,
        audioContextRef.current!.currentTime + 0.02
      );

      const rect = keyboardRef.current.getBoundingClientRect();
      const relativeY = (event.clientY - rect.top) / rect.height;

      setCursorY(event.clientY);

      const clamped = Math.min(Math.max(relativeY, 0), 1);
      const volume = (1 - clamped) * 0.25;
      gainRef.current.gain.linearRampToValueAtTime(
        volume,
        audioContextRef.current!.currentTime + 0.01
      );
    },
    [getFrequencyFromX]
  );

  const handleClick = useCallback(() => {
    initAudioContext();
  }, [initAudioContext]);

  // Clean up
  useEffect(() => {
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      }
      if (gainRef.current) gainRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  return (
    <div>
      {!isReady && (
        <div className="fixed h-screen w-screen flex items-center justify-center z-10">
          <Button onClick={initAudioContext}>
            {!isReady && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Click to Start
          </Button>
        </div>
      )}

      <Button className="z-10 fixed bottom-4 right-4">
        X: {cursorX}, Y: {cursorY}
      </Button>

      <div className="w-screen h-screen fixed left-0 top-0">
        <div
          ref={keyboardRef}
          className="w-screen h-screen overflow-hidden grid grid-cols-4"
          onMouseLeave={stopTone}
          onClick={handleClick}
          onMouseEnter={startTone}
          onMouseMove={handleMouseMove}
        >
          {Array(4)
            .fill(null)
            .map((_item, index) => (
              <div className="grid grid-cols-12" key={index}>
                <NoteKey />
                <NoteKey orientation="flipped" />
                <NoteKey />
                <NoteKey orientation="flipped" />
                <NoteKey orientation="plain" />
                <NoteKey />
                <NoteKey orientation="flipped" />
                <NoteKey />
                <NoteKey orientation="flipped" />
                <NoteKey />
                <NoteKey orientation="flipped" />
                <NoteKey orientation="plain" />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
