// Build a soft ratchet click on demand without requiring a downloaded audio file.
(function () {
  "use strict";

  let audioContext = null;
  let soundEnabled = true;

  /**
   * Enable or mute synthesized ratchet clicks after the learner changes the sound setting.
   */
  function setEnabled(enabled) {
    soundEnabled = Boolean(enabled);
  }

  /**
   * Play one short, tapered mechanical click through the browser's audio context.
   */
  function play() {
    if (!soundEnabled) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const startTime = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(2050, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(790, startTime + 0.025);
    gain.gain.setValueAtTime(0.11, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.034);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.035);
  }

  window.RatchetAudio = { play, setEnabled };
})();
