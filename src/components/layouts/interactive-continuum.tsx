import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-wasm";
import {
  createDetector,
  type HandDetector,
  type Keypoint,
  SupportedModels,
} from "@tensorflow-models/hand-pose-detection";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { NoteKey } from "./noteKey";
import getFrequency from "@/lib/getFrequency";

interface HandPoint {
  x: number;
  y: number;
}

const CONFIG = {
  showWebcam: false,
  showModelOutput: true,
  maxHands: 2,
  transpose: 36,
  videoWidth: 1920,
  videoHeight: 1080,
};

function App() {
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [tfBackend, setTfBackend] = useState("webgl");

  const [leftHands, setLeftHands] = useState<HandPoint[]>([]);
  const [rightHands, setRightHands] = useState<HandPoint[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const detectorRef = useRef<HandDetector | null>(null);

  const keyboardRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const mouseOscillatorRef = useRef<OscillatorNode | null>(null);
  const mouseGainRef = useRef<GainNode | null>(null);

  const rightHandOscillatorRefs = [
    useRef<OscillatorNode | null>(null),
    useRef<OscillatorNode | null>(null),
    useRef<OscillatorNode | null>(null),
  ];
  const rightHandGainRefs = [
    useRef<GainNode | null>(null),
    useRef<GainNode | null>(null),
    useRef<GainNode | null>(null),
  ];
  const leftHandOscillatorRefs = [
    useRef<OscillatorNode | null>(null),
    useRef<OscillatorNode | null>(null),
    useRef<OscillatorNode | null>(null),
  ];
  const leftHandGainRefs = [
    useRef<GainNode | null>(null),
    useRef<GainNode | null>(null),
    useRef<GainNode | null>(null),
  ];

  const START_NOTE = 1 + CONFIG.transpose;
  const END_NOTE = 36 + CONFIG.transpose;

  useEffect(() => {
    async function setupTf() {
      await tf.setBackend("webgl");
      await tf.ready();
      setTfBackend(tf.getBackend());
    }

    async function setupCamera() {
      if (!videoRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        });
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          videoRef.current!.onloadedmetadata = () => resolve(videoRef.current);
        });
        videoRef.current.play();
        return videoRef.current;
      } catch (error) {
        console.error("Error setting up camera:", error);
        return null;
      }
    }

    async function setupDetector() {
      const model = SupportedModels.MediaPipeHands;
      const detector = await createDetector(model, {
        runtime: "mediapipe",
        maxHands: CONFIG.maxHands,
        solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands",
      });
      return detector;
    }

    async function initialize() {
      setIsModelLoading(true);
      await setupTf();
      const video = await setupCamera();
      if (video && canvasRef.current) {
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
        canvasContextRef.current = canvasRef.current.getContext("2d");
      }
      detectorRef.current = await setupDetector();
      setIsModelLoading(false);
    }

    initialize();
  }, []);

  const drawHands = (hands: Keypoint[][], ctx: CanvasRenderingContext2D) => {
    hands.forEach((hand) => {
      // Skeleton
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      const connections = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4], // Thumb
        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8], // Index
        [5, 9],
        [9, 10],
        [10, 11],
        [11, 12], // Middle
        [9, 13],
        [13, 14],
        [14, 15],
        [15, 16], // Ring
        [13, 17],
        [0, 17],
        [17, 18],
        [18, 19],
        [19, 20], // Pinky
      ];
      connections.forEach(([start, end]) => {
        ctx.beginPath();
        ctx.moveTo(hand[start].x, hand[start].y);
        ctx.lineTo(hand[end].x, hand[end].y);
        ctx.stroke();
      });

      // Draw keypoints
      hand.forEach((keypoint, i) => {
        ctx.fillStyle = i === 12 ? "orange" : "yellow";
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
  };

  const runDetection = useCallback(async () => {
    if (
      !detectorRef.current ||
      !videoRef.current ||
      !canvasContextRef.current ||
      videoRef.current.readyState < 3 // Wait for video
    ) {
      return;
    }

    const video = videoRef.current;
    const ctx = canvasContextRef.current;

    // Estimate hands
    const hands = await detectorRef.current.estimateHands(video, {
      flipHorizontal: false, // Flip the canvas, not the detection
    });

    // Clear and draw webcam
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (CONFIG.showWebcam) {
      ctx.drawImage(video, 0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    // Process hand data
    const newLeftHands: HandPoint[] = [];
    const newRightHands: HandPoint[] = [];
    const allKeypoints: Keypoint[][] = [];

    for (const hand of hands) {
      if (hand.keypoints && hand.keypoints.length > 12) {
        const middleFingerTip = hand.keypoints[12];
        allKeypoints.push(hand.keypoints);

        // Mirrored camera: model's "Right" is user's "Left"
        if (hand.handedness === "Right") {
          newLeftHands.push({ x: middleFingerTip.x, y: middleFingerTip.y });
        }
        // Mirrored camera again
        else if (hand.handedness === "Left") {
          newRightHands.push({ x: middleFingerTip.x, y: middleFingerTip.y });
        }
      }
    }

    // Update state
    setLeftHands(newLeftHands.slice(0, 3)); // Max 3 left hands
    setRightHands(newRightHands.slice(0, 3)); // Max 3 right hands

    // Draw output
    if (CONFIG.showModelOutput) {
      drawHands(allKeypoints, ctx);
    }
  }, []);

  useAnimationFrame(runDetection, !isModelLoading && isReady);

  const getFrequencyFromX = useCallback(
    (x: number) => {
      if (!keyboardRef.current || !canvasRef.current)
        return getFrequency(START_NOTE);

      // Map canvas X to keyboard X
      const canvasWidth = canvasRef.current.clientWidth;
      const keyboardRect = keyboardRef.current.getBoundingClientRect();
      // Flip X because the canvas is mirrored (scaleX(-1))
      const relativeX = (canvasWidth - x) / canvasWidth;
      const clientX = keyboardRect.left + relativeX * keyboardRect.width;

      const totalWidth = keyboardRect.width;
      const numKeys = END_NOTE - START_NOTE + 1;
      const keyWidth = totalWidth / numKeys;

      const keyIndex = Math.floor(relativeX * numKeys);
      const note = START_NOTE + keyIndex;

      const xInKey = (clientX % keyWidth) / keyWidth;
      const baseFreq = getFrequency(note);
      const nextFreq = getFrequency(note + 1);
      const freq = baseFreq * Math.pow(nextFreq / baseFreq, xInKey);
      return freq;
    },
    [START_NOTE, END_NOTE]
  );

  const getVolumeFromY = useCallback((clientY: number): number => {
    if (!keyboardRef.current || !canvasRef.current) return 0.15;

    // Map canvas Y to keyboard Y
    const canvasHeight = canvasRef.current.clientHeight;
    const relativeY = clientY / canvasHeight;

    const clamped = Math.min(Math.max(relativeY, 0), 1);
    return (1 - clamped) * 0.25;
  }, []);

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

  const startAudioNode = useCallback(
    (
      oscRef: React.MutableRefObject<OscillatorNode | null>,
      gainRef: React.MutableRefObject<GainNode | null>,
      freq: number,
      volume: number
    ) => {
      if (!audioContextRef.current || oscRef.current) return;
      const audioCtx = audioContextRef.current;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.1);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscRef.current = oscillator;
      gainRef.current = gainNode;
    },
    []
  );

  const stopAudioNode = useCallback(
    (
      oscRef: React.MutableRefObject<OscillatorNode | null>,
      gainRef: React.MutableRefObject<GainNode | null>
    ) => {
      if (!oscRef.current || !gainRef.current || !audioContextRef.current)
        return;
      const audioCtx = audioContextRef.current;
      const now = audioCtx.currentTime;
      const gain = gainRef.current.gain;
      gain.cancelScheduledValues(now);
      gain.linearRampToValueAtTime(0, now + 0.15);
      oscRef.current.stop(now + 0.2);
      oscRef.current.disconnect();
      gainRef.current.disconnect();
      oscRef.current = null;
      gainRef.current = null;
    },
    []
  );

  const updateAudioNode = useCallback(
    (
      oscRef: React.MutableRefObject<OscillatorNode | null>,
      gainRef: React.MutableRefObject<GainNode | null>,
      freq: number,
      volume: number
    ) => {
      if (!oscRef.current || !gainRef.current || !audioContextRef.current)
        return;
      const audioCtx = audioContextRef.current;
      oscRef.current.frequency.exponentialRampToValueAtTime(
        freq,
        audioCtx.currentTime + 0.02
      );
      gainRef.current.gain.linearRampToValueAtTime(
        volume,
        audioCtx.currentTime + 0.01
      );
    },
    []
  );

  const handleMouseEnter = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isReady) return;
      const freq = getFrequencyFromX(event.clientX);
      const volume = getVolumeFromY(event.clientY);
      startAudioNode(mouseOscillatorRef, mouseGainRef, freq, volume);
    },
    [isReady, getFrequencyFromX, getVolumeFromY, startAudioNode]
  );

  const handleMouseLeave = useCallback(() => {
    stopAudioNode(mouseOscillatorRef, mouseGainRef);
  }, [stopAudioNode]);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isReady || !keyboardRef.current) return;

      const rect = keyboardRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const numKeys = END_NOTE - START_NOTE + 1;
      const keyWidth = totalWidth / numKeys;

      const relativeX = event.clientX - rect.left;

      const keyIndex = Math.floor(relativeX / keyWidth);
      const note = START_NOTE + keyIndex;

      const xInKey = (relativeX % keyWidth) / keyWidth;

      const baseFreq = getFrequency(note);
      const nextFreq = getFrequency(note + 1);

      const freq = baseFreq * Math.pow(nextFreq / baseFreq, xInKey);

      const volume = getVolumeFromY(event.clientY);
      updateAudioNode(mouseOscillatorRef, mouseGainRef, freq, volume);
    },
    [isReady, getVolumeFromY, updateAudioNode, START_NOTE, END_NOTE]
  );

  useEffect(() => {
    if (!isReady || !canvasRef.current) return;

    for (let i = 0; i < 3; i++) {
      const handData = rightHands[i];
      const oscRef = rightHandOscillatorRefs[i];
      const gainRef = rightHandGainRefs[i];

      if (handData) {
        const freq = getFrequencyFromX(handData.x);
        const volume = getVolumeFromY(handData.y);

        if (!oscRef.current) {
          startAudioNode(oscRef, gainRef, freq, volume);
        } else {
          updateAudioNode(oscRef, gainRef, freq, volume);
        }
      } else {
        stopAudioNode(oscRef, gainRef);
      }
    }
  }, [
    isReady,
    rightHands,
    getFrequencyFromX,
    getVolumeFromY,
    startAudioNode,
    stopAudioNode,
    updateAudioNode,
  ]);

  useEffect(() => {
    if (!isReady || !canvasRef.current) return;

    for (let i = 0; i < 3; i++) {
      const handData = leftHands[i];
      const oscRef = leftHandOscillatorRefs[i];
      const gainRef = leftHandGainRefs[i];

      if (handData) {
        const freq = getFrequencyFromX(handData.x);
        const volume = getVolumeFromY(handData.y);

        if (!oscRef.current) {
          startAudioNode(oscRef, gainRef, freq, volume);
        } else {
          updateAudioNode(oscRef, gainRef, freq, volume);
        }
      } else {
        stopAudioNode(oscRef, gainRef);
      }
    }
  }, [
    isReady,
    leftHands,
    getFrequencyFromX,
    getVolumeFromY,
    startAudioNode,
    stopAudioNode,
    updateAudioNode,
  ]);

  const handleClick = useCallback(() => {
    initAudioContext();
  }, [initAudioContext]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopAudioNode(mouseOscillatorRef, mouseGainRef);
      for (let i = 0; i < 3; i++) {
        stopAudioNode(rightHandOscillatorRefs[i], rightHandGainRefs[i]);
        stopAudioNode(leftHandOscillatorRefs[i], leftHandGainRefs[i]);
      }

      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }

      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
    };
  }, [stopAudioNode]);

  return (
    <div>
      <div className="fixed top-4 left-4 z-10">
        {isModelLoading && (
          <Button>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading Model ({tfBackend})
          </Button>
        )}
      </div>

      {!isReady && (
        <div className="fixed h-screen w-screen flex items-center justify-center z-10">
          <Button onClick={initAudioContext}>Start Audio</Button>
        </div>
      )}

      <Button className="z-10 fixed bottom-4 right-4">
        L: {leftHands.length} | R: {rightHands.length}
      </Button>

      <div className="fixed flex gap-4 bottom-4 left-4 z-10">
        {rightHands.length > 0 && (
          <Button>R1 X: {rightHands[0].x.toFixed(0)}</Button>
        )}
        {leftHands.length > 0 && (
          <Button>L1 X: {leftHands[0].x.toFixed(0)}</Button>
        )}
      </div>

      <video
        ref={videoRef}
        className="w-full h-full absolute top-0 left-0 overflow-hidden z-1 opacity-0 pointer-events-none"
        playsInline
        style={{
          transform: "scaleX(-1)",
        }}
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full absolute top-0 left-0 overflow-hidden z-1 pointer-events-none"
        style={{
          transform: "scaleX(-1)",
          objectFit: "cover",
          opacity: CONFIG.showWebcam || CONFIG.showModelOutput ? 1 : 0,
        }}
      />

      <div
        ref={keyboardRef}
        className="w-screen h-screen overflow-hidden fixed left-0 top-0 grid grid-cols-3"
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
      >
        {Array(3)
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
  );
}

export default App;
