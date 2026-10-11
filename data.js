// Keep the shared instrument, specimen, and procedure data namespaced for the simulation.
(function () {
  "use strict";

  window.LabData = {
    leastCount: 0.01,
    pitch: 0.5,
    circularDivisions: 50,
    maximumTravel: 5,
    objects: [
      { name: "Copper Wire", diameter: 0.826, color: "#d89057", shape: "wire" },
      { name: "Aluminium Wire", diameter: 0.644, color: "#a9b7c9", shape: "wire" },
      { name: "Steel Wire", diameter: 0.955, color: "#8396ac", shape: "wire" },
      { name: "Needle", diameter: 0.717, color: "#d8dde6", shape: "needle" },
      { name: "Coin", diameter: 1.756, color: "#d8ae65", shape: "disc" },
      { name: "Glass Sheet", diameter: 1.104, color: "#7ac6ce", shape: "sheet" },
      { name: "Plastic Sheet", diameter: 1.296, color: "#ba8cdf", shape: "sheet" },
      { name: "Paper Stack", diameter: 2.403, color: "#e5dcbd", shape: "stack" },
      { name: "Metal Ball", diameter: 4.004, color: "#94a5be", shape: "ball" },
      { name: "Small Rod", diameter: 3.204, color: "#cf8e72", shape: "rod" },
      { name: "Screw", diameter: 2.856, color: "#8190a7", shape: "rod" },
      { name: "Pin", diameter: 0.554, color: "#cf7777", shape: "needle" },
      { name: "Sphere", diameter: 4.796, color: "#75a9a4", shape: "ball" },
      { name: "Plastic Bead", diameter: 2.154, color: "#8ba8de", shape: "ball" }
    ],
    zeroErrors: [0, 0.01, 0.02, -0.01, -0.02],
    procedure: [
      { title: "Clean before you measure.", body: "Wipe the anvil and spindle faces with a soft, clean cloth. Even a tiny speck can change a precision reading.", icon: "✳" },
      { title: "Find your zero.", body: "Bring the clean measuring faces together using the ratchet. Notice whether the zero on the circular scale aligns with the datum line.", icon: "◎" },
      { title: "Account for zero error.", body: "Record any zero error before inserting your specimen. Subtract positive error or add the magnitude of negative error to each observation.", icon: "±" },
      { title: "Place the specimen.", body: "Rest the object between the anvil and spindle faces. Hold thin specimens carefully so that the measured diameter is perpendicular to the faces.", icon: "⌖" },
      { title: "Turn the ratchet gently.", body: "Advance the spindle with the ratchet, never by forcing the thimble. Stop as soon as the spindle just touches the specimen.", icon: "↻" },
      { title: "Read both scales.", body: "Note the last main-scale mark visible to the left of the thimble and the circular division aligned with the sleeve's datum line.", icon: "▤" },
      { title: "Correct, record, repeat.", body: "Calculate MSR + (CSR × least count), apply the zero correction, and record several independent readings. Take their average.", icon: "✓" }
    ],
    viva: [
      { q: "What is a screw gauge?", a: "A precision instrument that measures small lengths, especially wire diameters and sheet thicknesses, using a finely threaded screw." },
      { q: "What is another name for a screw gauge?", a: "A micrometer." },
      { q: "What is the pitch of a screw gauge?", a: "The distance its spindle advances along the screw's axis in one complete rotation of the thimble." },
      { q: "How do you calculate its least count?", a: "Divide the pitch by the total number of equally spaced divisions on the circular scale." },
      { q: "What is the least count in this simulation?", a: "0.01 mm: the 0.5 mm pitch divided by 50 circular-scale divisions." },
      { q: "What does MSR stand for?", a: "Main Scale Reading: the last visible main-scale mark before the edge of the thimble." },
      { q: "What does CSR stand for?", a: "Circular Scale Reading: the number of the circular-scale division that aligns with the datum line." },
      { q: "How do you calculate an observed measurement?", a: "Observed reading = MSR + (CSR × least count)." },
      { q: "What is zero error?", a: "A nonzero reading shown by the instrument when its measuring faces are gently closed without an object." },
      { q: "What is a positive zero error?", a: "The instrument reads a positive value when fully closed. Subtract that error from the observed measurement." },
      { q: "What is a negative zero error?", a: "The instrument reads below zero when fully closed. Add the magnitude of that negative error to the observed measurement." },
      { q: "What is a zero correction?", a: "The opposite of zero error: it is subtracted from the observed reading to give a corrected measurement." },
      { q: "Why should we use the ratchet?", a: "It provides gentle, approximately consistent contact and prevents excessive tightening that could damage the specimen or bias the measurement." },
      { q: "What is parallax error?", a: "An error caused by viewing a scale from an angle rather than straight on. Read the scale with your eye perpendicular to it." },
      { q: "How is the thimble scale related to spindle movement?", a: "A full rotation moves the spindle by one pitch; a fraction of a rotation moves it by the corresponding fraction of the pitch." },
      { q: "What instrument part carries the main scale?", a: "The sleeve (also called the barrel)." },
      { q: "What instrument part carries the circular scale?", a: "The rotating thimble." },
      { q: "Why take repeated measurements?", a: "Repeated independent measurements help reveal variation and random error, and their mean gives a more representative result." },
      { q: "How do you calculate percentage error?", a: "For a measurement with a known reference value: absolute difference between the measured and reference values divided by the reference value, multiplied by 100%." },
      { q: "What is the unit of the reading in this experiment?", a: "Millimetres (mm)." }
    ]
  };
})();
