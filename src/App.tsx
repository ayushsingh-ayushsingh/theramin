import React, { useEffect } from "react";
import * as Tone from "tone";
import { Button } from "./components/ui/button";

function App() {
  const synth = new Tone.Synth();
  const feedbackDelay = new Tone.FeedbackDelay({
    delayTime: 0.1,
    feedback: 0.9,
    maxDelay: 10,
  });

  useEffect(() => {
    synth.connect(feedbackDelay);
    feedbackDelay.toDestination();

    const resumeAudioContext = async () => {
      if (Tone.context.state === "suspended") {
        await Tone.context.resume();
      }
    };

    window.addEventListener("click", resumeAudioContext);

    return () => {
      window.removeEventListener("click", resumeAudioContext);
    };
  }, [synth, feedbackDelay]);

  const handleKeyDown = async (
    event: React.KeyboardEvent<HTMLInputElement>
  ): Promise<void> => {
    if (event.key === "k") {
      await Tone.start(); // Ensure this is awaited
      synth.triggerAttackRelease(440, 1);
      console.log("K was pressed!");
    }
  };

  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      tabIndex={0} // To enable key events when focusing on the div
      onKeyDown={handleKeyDown} // Attach the event listener to the div
    >
      <Button
        onClick={async () => {
          await Tone.start();
          synth.triggerAttackRelease(440, 1);
        }}
      >
        Play
      </Button>
    </div>
  );
}

export default App;
