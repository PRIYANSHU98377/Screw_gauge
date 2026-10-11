// Keep all independently randomized multiple-choice questions in a reusable data module.
(function () {
  "use strict";

  window.QuizData = [
    { q: "A screw advances 0.5 mm in one turn. Its thimble has 50 divisions. What is its least count?", options: ["0.1 mm", "0.01 mm", "0.05 mm", "0.001 mm"], answer: 1, explanation: "Least count = pitch ÷ divisions = 0.5 ÷ 50 = 0.01 mm." },
    { q: "What is the pitch of a screw gauge?", options: ["The total length of its sleeve", "One thimble-scale division", "The spindle advance per complete turn", "The diameter of its ratchet"], answer: 2, explanation: "Pitch measures how far the spindle advances in a single full rotation." },
    { q: "The main scale reads 2.5 mm and the circular scale reads 18 divisions. LC = 0.01 mm. What is the observed reading?", options: ["2.68 mm", "2.518 mm", "2.63 mm", "2.32 mm"], answer: 0, explanation: "2.5 + (18 × 0.01) = 2.68 mm." },
    { q: "A gauge has +0.02 mm zero error. What correction must be applied?", options: ["Add 0.02 mm", "Subtract 0.02 mm", "Multiply by 0.02", "No correction is needed"], answer: 1, explanation: "Zero correction is the negative of zero error. Subtract a positive zero error." },
    { q: "A gauge has a zero error of −0.02 mm. What is its zero correction?", options: ["−0.02 mm", "+0.02 mm", "−0.04 mm", "0 mm"], answer: 1, explanation: "Correction is the negative of the zero error, so a −0.02 mm error gives a +0.02 mm correction." },
    { q: "Which part of the instrument contains the circular scale?", options: ["Anvil", "Frame", "Sleeve", "Thimble"], answer: 3, explanation: "The circular (or thimble) scale rotates together with the thimble." },
    { q: "When should you read the main scale?", options: ["At the mark just right of the thimble", "At the last visible mark to the left of the thimble edge", "At the first visible sleeve mark", "At the mark aligned with the ratchet"], answer: 1, explanation: "Read the last main-scale division that remains visible to the left of the thimble edge." },
    { q: "Why is the ratchet used?", options: ["To change the pitch", "To release the lock nut", "To apply gentle, consistent contact pressure", "To zero the circular scale"], answer: 2, explanation: "The ratchet limits excess force and helps avoid squeezing or damaging the specimen." },
    { q: "Which equation gives the observed reading?", options: ["MSR − (CSR × LC)", "CSR + (MSR × LC)", "MSR + (CSR × LC)", "MSR × CSR × LC"], answer: 2, explanation: "Add the main-scale reading to the circular-scale divisions multiplied by the least count." },
    { q: "For a 0.5 mm pitch and 25 circular-scale divisions, what is the least count?", options: ["0.002 mm", "0.02 mm", "0.2 mm", "12.5 mm"], answer: 1, explanation: "LC = 0.5 ÷ 25 = 0.02 mm." },
    { q: "How can you reduce parallax error?", options: ["Look at the scale from above", "Look straight at the scale datum", "Turn the instrument quickly", "Read the thimble while rotating"], answer: 1, explanation: "View a scale perpendicularly to its face so your eye is in line with the reading." },
    { q: "When do you check a screw gauge's zero error?", options: ["Only after measuring", "Before taking readings with its measuring faces gently closed", "With the spindle fully open", "Only when changing a specimen"], answer: 1, explanation: "Close the measuring faces gently before measurement to check whether the closed gauge reads zero." },
    { q: "Which part stays stationary while the spindle advances?", options: ["The anvil", "The thimble", "The ratchet", "The circular scale"], answer: 0, explanation: "The anvil is the fixed measuring face; the spindle advances toward it." },
    { q: "A 20-division CSR is read using a 0.01 mm least count. What is its CSR contribution?", options: ["0.02 mm", "0.2 mm", "2 mm", "20.01 mm"], answer: 1, explanation: "20 × 0.01 mm = 0.20 mm." },
    { q: "Why repeat a measurement several times?", options: ["To change the object's actual diameter", "To reduce the instrument's least count", "To reveal variation and calculate a more representative mean", "To eliminate the need to check zero error"], answer: 2, explanation: "Multiple independent measurements help you assess variation and estimate a representative average." }
  ];
})();
