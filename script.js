// Keep simulation state private while coordinating all experiment screens in the page.
(function () {
  "use strict";

  const data = window.LabData;
  const storageKey = "physicsVirtualLabScrewGauge.v1";
  const travelStepsPerMillimetre = 100;
  const screenPixelsPerMillimetre = 12;
  const state = {
    page: "home",
    specimen: null,
    zeroErrorSteps: 0,
    positionSteps: 0,
    trials: [],
    completedSteps: new Set(),
    locked: false,
    soundEnabled: true,
    instrumentDrag: null
  };
  const nodes = {};
  let toastTimeout = 0;
  let quiz = [];
  let quizPosition = 0;
  let quizSelection = -1;
  let quizScore = 0;
  let quizAnswered = false;
  let vivaExpanded = false;

  /**
   * Retrieve and validate required elements once so a broken experiment surface fails explicitly.
   */
  function collectNodes() {
    const requiredIds = [
      "loading-screen", "theme-toggle", "breadcrumb-current", "toast", "object-select",
      "insert-object", "remove-object", "selection-note", "zero-status", "zero-sign-note",
      "rotation-slider", "rotation-turns", "rotation-hint", "rotate-backward", "rotate-forward",
      "click-sound-toggle", "instrument-card", "instrument-canvas", "screw-gauge-svg",
      "instrument-tooltip", "spindle-group", "thimble-assembly", "thimble-ticks", "ratchet-face", "object-holder",
      "object-circle", "object-rect", "object-glint", "object-svg-label", "object-badge",
      "object-badge-label", "main-scale-reading", "circular-scale-reading", "least-count-reading",
      "zero-error-reading", "corrected-reading", "final-diameter", "ground-truth-note",
      "add-trial", "delete-trial", "reset-trials", "download-csv", "print-observations",
      "observation-tbody", "table-trial-count", "table-trial-count-full", "observation-tbody-full",
      "average-result", "maximum-result", "minimum-result", "error-result", "result-footnote",
      "average-result-full", "maximum-result-full", "minimum-result-full", "error-result-full",
      "result-footnote-full", "experiment-progress-label", "chart-placeholder",
      "chart-placeholder-full", "quiz-counter", "quiz-progress-fill", "quiz-question-area",
      "quiz-feedback", "quiz-next", "procedure-steps", "steps-progress-fill",
      "procedure-progress-label", "fullscreen-toggle", "zoom-toggle", "screenshot-button",
      "viva-grid", "viva-expand-all", "reset-experiment", "procedure-reset"
    ];

    for (const id of requiredIds) {
      const element = document.getElementById(id);
      if (!element) {
        throw new Error("A required experiment element is missing: #" + id);
      }
      const nodeProperty = id.replace(/-([a-z])/g, upperCaseHyphenatedLetter);
      nodes[nodeProperty] = element;
    }
  }

  /**
   * Convert one hyphenated DOM identifier segment into its camel-case property name.
   */
  function upperCaseHyphenatedLetter(match, letter) {
    return letter.toUpperCase();
  }

  /**
   * Safely display a brief notification when the interface needs the learner's attention.
   */
  function showToast(message) {
    nodes.toast.textContent = message;
    nodes.toast.classList.add("show");
    window.clearTimeout(toastTimeout);

    // Hide the notification after its message has been visible long enough to read.
    toastTimeout = window.setTimeout(function dismissToast() {
      nodes.toast.classList.remove("show");
    }, 3200);
  }

  /**
   * Read and validate previously saved trial observations from local browser storage.
   */
  function loadTrials() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.some(invalidSavedTrial)) {
        throw new Error("The saved experiment observations are malformed.");
      }
      return parsed;
    } catch (error) {
      console.error("Unable to load the saved screw-gauge experiment.", error);
      showToast("Saved experiment data could not be loaded. You can continue with a new experiment.");
      return [];
    }
  }

  /**
   * Reject a persisted observation if it cannot represent one valid screw-gauge measurement.
   */
  function invalidSavedTrial(trial) {
    return !trial
      || !data.objects.some(
        /** Check whether a recorded specimen belongs to the supported instrument set. */
        function existingSpecimen(specimen) { return specimen.name === trial.object; }
      )
      || !Number.isInteger(trial.mainScaleSteps)
      || trial.mainScaleSteps < 0
      || !Number.isInteger(trial.circularDivision)
      || trial.circularDivision < 0
      || trial.circularDivision >= data.circularDivisions
      || !Number.isInteger(trial.zeroErrorSteps)
      || !data.zeroErrors.some(
        /** Check that the saved zero correction matches a supported calibration option. */
        function allowedZeroError(error) { return toSteps(error) === trial.zeroErrorSteps; }
      )
      || !Number.isFinite(trial.finalReading)
      || trial.finalReading < 0
      || trial.finalReading > data.maximumTravel
      || !Number.isFinite(trial.trueDiameter)
      || trial.trueDiameter <= 0
      || !data.objects.some(
        /** Compare the saved private reference diameter with its specimen definition. */
        function matchesReferenceDiameter(specimen) {
          return specimen.name === trial.object && specimen.diameter === trial.trueDiameter;
        }
      );
  }

  /**
   * Save the current observation history between visits without blocking this lab session.
   */
  function saveTrials() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state.trials));
      return true;
    } catch (error) {
      console.error("Unable to save the screw-gauge observations.", error);
      showToast("Your reading is available for this visit, but browser storage could not save it.");
      return false;
    }
  }

  /**
   * Return the number of full hundredths of a millimetre in a floating-point value.
   */
  function toSteps(value) {
    return Math.round(value * travelStepsPerMillimetre);
  }

  /**
   * Format a measurement consistently with the least count of this experiment.
   */
  function formatReading(steps) {
    return (steps / travelStepsPerMillimetre).toFixed(2);
  }

  /**
   * Display a signed calibration error or correction without hiding its direction.
   */
  function formatSignedReading(steps) {
    if (steps === 0) return "0.00";
    return (steps > 0 ? "+" : "−") + formatReading(Math.abs(steps));
  }

  /**
   * Translate the experiment page, breadcrumb, navigation highlight, and browser hash together.
   */
  function navigateToPage(pageName, updateAddress) {
    const destination = document.getElementById("page-" + pageName);
    if (!destination) {
      showToast("That experiment page could not be found.");
      return;
    }
    state.page = pageName;
    document.querySelectorAll(".page").forEach(
      /** Show the destination page while preserving all other page content. */
      function updatePageVisibility(page) { page.classList.toggle("active", page === destination); }
    );
    document.querySelectorAll(".side-nav [data-page-link]").forEach(
      /** Keep the accessible current-page indicator consistent with the sidebar selection. */
      function updateNavigation(button) {
        const isCurrent = button.dataset.pageLink === pageName;
        button.classList.toggle("active", isCurrent);
        if (isCurrent) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    );

    const pageLabel = pageName === "home" ? "OVERVIEW" : pageName.toUpperCase().replace(/-/g, " ");
    nodes.breadcrumbCurrent.textContent = pageLabel;
    if (updateAddress) {
      const newHash = pageName === "home" ? "home" : pageName;
      window.history.replaceState(null, "", "#" + newHash);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pageName === "observation") {
      renderTrials();
    }
    if (pageName === "simulation" || pageName === "observation") {
      window.LabChart.render(state.trials);
    }
  }

  /**
   * Route clicks on the shared navigation links without requesting a browser page reload.
   */
  function onPageLinkClick(event) {
    const link = event.target.closest("[data-page-link]");
    if (!link) return;
    event.preventDefault();
    navigateToPage(link.dataset.pageLink, true);
  }

  /**
   * Pick up a direct page hash while treating unknown hash values as the home page.
   */
  function initializeNavigation() {
    document.addEventListener("click", onPageLinkClick);
    const requestedPage = window.location.hash.slice(1);
    const validPage = document.getElementById("page-" + requestedPage) ? requestedPage : "home";
    navigateToPage(validPage, false);
  }

  /**
   * Restore the user's last light or dark appearance preference.
   */
  function initializeTheme() {
    let preferredTheme = "light";
    try {
      const storedTheme = window.localStorage.getItem("physicsVirtualLab.theme");
      const systemPrefersDark = window.matchMedia
        && window.matchMedia("(prefers-color-scheme: dark)").matches;
      preferredTheme = storedTheme || (systemPrefersDark ? "dark" : "light");
    } catch (error) {
      console.warn("The theme preference cannot be read from browser storage.", error);
    }
    applyTheme(preferredTheme, false);
  }

  /**
   * Set the page's color scheme and save the change when the user requests it.
   */
  function applyTheme(theme, persist) {
    const selectedTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = selectedTheme;
    nodes.themeToggle.textContent = selectedTheme === "dark" ? "☀" : "☾";
    nodes.themeToggle.setAttribute("aria-label", "Switch to " + (selectedTheme === "dark" ? "light" : "dark") + " mode");
    nodes.themeToggle.title = "Switch to " + (selectedTheme === "dark" ? "light" : "dark") + " mode";
    if (!persist) return;
    try {
      window.localStorage.setItem("physicsVirtualLab.theme", selectedTheme);
    } catch (error) {
      console.error("Unable to save the selected color theme.", error);
      showToast("The selected theme will apply until you close this tab.");
    }
  }

  /**
   * Invert the current theme in response to the header's accessible theme button.
   */
  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  }

  /**
   * Populate the specimen list from the experiment data rather than duplicating object definitions.
   */
  function populateSpecimens() {
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Choose an object…";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    nodes.objectSelect.appendChild(defaultOption);

    data.objects.forEach(
      /** Create one correctly labeled dropdown option for each defined specimen. */
      function addSpecimen(specimen) {
        const option = document.createElement("option");
        option.value = specimen.name;
        option.textContent = specimen.name;
        nodes.objectSelect.appendChild(option);
      }
    );
  }

  /**
   * Draw all 50 engraved circular-scale divisions and their numbered thimble labels.
   */
  function renderThimbleScale() {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const fragment = document.createDocumentFragment();
    const scaleGroup = nodes.thimbleTicks;

    for (let division = 0; division < data.circularDivisions; division += 1) {
      const xPosition = 593 + division * 3.15;
      const tick = document.createElementNS(svgNamespace, "line");
      tick.setAttribute("x1", String(xPosition));
      tick.setAttribute("x2", String(xPosition));
      tick.setAttribute("y1", division % 5 === 0 ? "183" : "190");
      tick.setAttribute("y2", division % 5 === 0 ? "230" : "218");
      tick.setAttribute("stroke-width", division % 5 === 0 ? "1.2" : "0.8");
      fragment.appendChild(tick);

      if (division % 10 === 0) {
        const label = document.createElementNS(svgNamespace, "text");
        label.setAttribute("x", String(xPosition));
        label.setAttribute("y", "231");
        label.setAttribute("text-anchor", "middle");
        label.textContent = String(division);
        fragment.appendChild(label);
      }
    }

    scaleGroup.replaceChildren(fragment);
  }

  /**
   * Convert a signed numeric zero-error option into hundredths for exact scale arithmetic.
   */
  function selectZeroError(event) {
    const option = event.target.closest("[data-zero]");
    if (!option) return;
    state.zeroErrorSteps = toSteps(Number(option.dataset.zero));
    document.querySelectorAll(".zero-option").forEach(
      /** Select the same calibration across every synchronized reading control. */
      function updateZeroOption(button) {
        const isSelected = button === option;
        button.classList.toggle("selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
      }
    );
    updateMeasurement();
    recordProcedureStep(2);
  }

  /**
   * Find the selected specimen, place it between the jaws, and close the spindle to gentle contact.
   */
  function insertSpecimen() {
    const specimen = data.objects.find(
      /** Resolve the exact specimen selected in the measurement dropdown. */
      function findSpecimen(item) { return item.name === nodes.objectSelect.value; }
    );
    if (!specimen) {
      showToast("Choose a specimen before inserting it into the screw gauge.");
      nodes.objectSelect.focus();
      return;
    }
    state.specimen = specimen;
    state.positionSteps = Math.max(0, toSteps(data.maximumTravel) - toSteps(specimen.diameter));
    state.locked = false;
    updateSpecimenDisplay();
    updateMeasurement();
    playRatchetSound(3);
    recordProcedureStep(3);
  }

  /**
   * Remove the selected specimen and reopen the instrument for its next measurement.
   */
  function removeSpecimen() {
    if (!state.specimen) {
      showToast("There is no specimen to remove.");
      return;
    }
    state.specimen = null;
    state.locked = false;
    state.positionSteps = 0;
    updateSpecimenDisplay();
    updateMeasurement();
  }

  /**
   * Show the chosen specimen at its true contact width without revealing its reference diameter.
   */
  function updateSpecimenDisplay() {
    const holder = nodes.objectHolder;
    const circle = nodes.objectCircle;
    const rectangle = nodes.objectRect;
    const glint = nodes.objectGlint;
    const lockControl = document.getElementById("lock-control");
    const badge = nodes.objectBadge;
    const specimen = state.specimen;
    const objectName = specimen ? specimen.name.toUpperCase() : "";

    holder.classList.toggle("is-visible", Boolean(specimen));
    holder.setAttribute("aria-hidden", String(!specimen));
    badge.classList.toggle("has-object", Boolean(specimen));
    nodes.objectBadgeLabel.textContent = specimen ? objectName + " · IN PLACE" : "NO OBJECT INSERTED";
    nodes.removeObject.classList.toggle("is-visible", Boolean(specimen));
    nodes.selectionNote.textContent = specimen
      ? "A gentle ratchet stop secures the " + specimen.name.toLowerCase() + " at its surface."
      : "A specimen will gently stop the spindle at its surface.";
    lockControl.classList.toggle("is-locked", state.locked);
    lockControl.setAttribute("aria-pressed", String(state.locked));

    if (specimen) {
      const diameterInPixels = specimen.diameter * screenPixelsPerMillimetre;
      const centreX = 165 + diameterInPixels / 2;
      const centreY = 213;
      circle.setAttribute("fill", specimen.color);
      circle.setAttribute("cx", String(centreX));
      circle.setAttribute("cy", String(centreY));
      circle.setAttribute("r", specimen.shape === "sheet" || specimen.shape === "stack" ? "0" : String(diameterInPixels / 2));
      circle.style.display = specimen.shape === "sheet" || specimen.shape === "stack" ? "none" : "";
      rectangle.setAttribute("fill", specimen.color);
      rectangle.setAttribute("width", String(diameterInPixels));
      rectangle.setAttribute("y", specimen.shape === "needle" ? "210" : "196");
      rectangle.setAttribute("height", specimen.shape === "needle" ? "6" : "34");
      rectangle.style.display = specimen.shape === "sheet" || specimen.shape === "stack" ? "" : "none";
      rectangle.setAttribute("stroke", specimen.shape === "sheet" ? "#618e94" : "#a69a79");
      glint.setAttribute("d", "M" + (centreX - 2) + " " + (centreY - diameterInPixels / 2 + 2)
        + "l2 3l2-3");
      nodes.objectSvgLabel.setAttribute("x", String(centreX));
      nodes.objectSvgLabel.textContent = objectName;
    } else {
      circle.style.display = "none";
      rectangle.style.display = "none";
      glint.setAttribute("d", "");
      nodes.objectSvgLabel.setAttribute("x", "185");
      nodes.objectSvgLabel.textContent = "YOUR OBJECT";
    }
  }

  /**
   * Determine the maximum spindle closure that still exactly respects a specimen's hidden diameter.
   */
  function getContactPositionSteps() {
    if (!state.specimen) return toSteps(data.maximumTravel);
    return Math.max(0, toSteps(data.maximumTravel) - toSteps(state.specimen.diameter));
  }

  /**
   * Update spindle, thimble, turning dial, and the slider from the same precise travel position.
   */
  function updateInstrumentPosition() {
    const safeTravelSteps = Math.min(
      Math.max(state.positionSteps, 0),
      getContactPositionSteps()
    );
    state.positionSteps = safeTravelSteps;
    const closedMillimetres = safeTravelSteps / travelStepsPerMillimetre;
    const spindleOffset = closedMillimetres * screenPixelsPerMillimetre;
    nodes.rotationSlider.value = String(safeTravelSteps);
    nodes.rotationSlider.setAttribute("aria-valuetext", formatReading(safeTravelSteps) + " millimetres closed");
    nodes.rotationTurns.textContent = formatReading(safeTravelSteps);
    nodes.spindleGroup.setAttribute("transform", "translate(" + (-spindleOffset).toFixed(2) + " 0)");
    nodes.thimbleAssembly.setAttribute("transform", "translate(" + (-spindleOffset).toFixed(2) + " 0)");
    nodes.ratchetFace.setAttribute("transform", "rotate(" + ((safeTravelSteps / 50) * 360).toFixed(1) + " 956 199)");
    nodes.rotationHint.textContent = state.locked
      ? "THE LOCK NUT IS SECURING THIS POSITION"
      : state.specimen
        ? (safeTravelSteps >= getContactPositionSteps() ? "SPECIMEN GENTLY IN CONTACT" : "TURN CLOCKWISE TO TOUCH THE SPECIMEN")
        : "DRAG TO ROTATE THE THIMBLE";
  }

  /**
   * Calculate live main-scale, circular-scale, zero-corrected, and specimen-contact readings.
   */
  function updateMeasurement() {
    updateInstrumentPosition();
    const maximumSteps = toSteps(data.maximumTravel);
    const specimenIsContacting = Boolean(
      state.specimen && state.positionSteps >= getContactPositionSteps()
    );
    const apertureSteps = Math.max(0, maximumSteps - state.positionSteps);
    const observedSteps = Math.min(maximumSteps, Math.max(0, apertureSteps + state.zeroErrorSteps));
    const mainScaleStepInterval = toSteps(data.pitch);
    const mainScaleSteps = Math.floor(observedSteps / mainScaleStepInterval) * mainScaleStepInterval;
    const circularDivision = Math.round(
      (observedSteps - mainScaleSteps) / toSteps(data.leastCount)
    );
    const correctedSteps = observedSteps - state.zeroErrorSteps;
    nodes.thimbleTicks.setAttribute(
      "transform",
      "rotate(" + (circularDivision * 360 / data.circularDivisions).toFixed(1) + " 670 205)"
    );

    nodes.mainScaleReading.textContent = formatReading(mainScaleSteps);
    nodes.circularScaleReading.textContent = String(circularDivision).padStart(2, "0");
    nodes.leastCountReading.textContent = data.leastCount.toFixed(2);
    nodes.zeroErrorReading.textContent = formatSignedReading(state.zeroErrorSteps);
    nodes.correctedReading.innerHTML = specimenIsContacting
      ? formatReading(correctedSteps) + " <small>mm</small>"
      : "— <small>mm</small>";
    nodes.finalDiameter.innerHTML = specimenIsContacting
      ? formatReading(correctedSteps) + " <small>mm</small>"
      : "— <small>mm</small>";

    if (specimenIsContacting) {
      nodes.groundTruthNote.textContent = "Specimen gently in contact · " + state.specimen.name;
    } else if (state.specimen) {
      nodes.groundTruthNote.textContent = "Loosened · gently close the ratchet until the specimen is touched.";
    } else {
      nodes.groundTruthNote.textContent = "Insert an object to begin.";
    }

    nodes.zeroStatus.classList.toggle("is-corrected", state.zeroErrorSteps !== 0);
    nodes.zeroStatus.innerHTML = state.zeroErrorSteps === 0
      ? "<span></span> CALIBRATED"
      : "<span></span> CORRECTION APPLIED";
    nodes.zeroSignNote.textContent = state.zeroErrorSteps > 0
      ? "A positive error is subtracted from your observed reading."
      : state.zeroErrorSteps < 0
        ? "A negative error is corrected by adding its magnitude."
        : "The instrument is calibrated; no zero correction is needed.";
  }

  /**
   * Change spindle closure in exact hundredths, stopping automatically at specimen contact.
   */
  function moveSpindle(positionSteps, playSound) {
    if (state.locked && positionSteps !== state.positionSteps) {
      nodes.rotationSlider.value = String(state.positionSteps);
      showToast("The lock nut is securing your reading. Unlock it before turning the ratchet.");
      return;
    }

    const previousPosition = state.positionSteps;
    state.positionSteps = Math.min(
      Math.max(Math.round(positionSteps), 0),
      getContactPositionSteps()
    );
    updateMeasurement();

    if (playSound && state.positionSteps !== previousPosition) {
      playRatchetSound(Math.min(6, Math.max(1, Math.abs(state.positionSteps - previousPosition))));
    }
  }

  /**
   * Turn the thimble by a small repeatable amount with either rotation button.
   */
  function turnRatchet(direction) {
    if (state.locked) {
      showToast("The lock nut is securing your reading. Unlock it before turning the ratchet.");
      return;
    }
    if (!state.specimen) {
      showToast("Insert a specimen before taking a laboratory measurement.");
      return;
    }
    const incrementSteps = 5;
    moveSpindle(state.positionSteps + direction * incrementSteps, true);
  }

  /**
   * Handle opening, closing, and pointer dragging with the fine-adjustment slider.
   */
  function onRotationSliderInput() {
    moveSpindle(Number(nodes.rotationSlider.value), false);
  }

  /**
   * Generate an audible laboratory ratchet click for each small clockwise turn.
   */
  function playRatchetSound(clickCount) {
    if (!state.soundEnabled || !window.RatchetAudio) return;
    for (let clickIndex = 0; clickIndex < clickCount; clickIndex += 1) {
      window.RatchetAudio.play();
    }
  }

  /**
   * Toggle synthesized ratchet clicks and synchronize the accessible sound control.
   */
  function toggleRatchetSound() {
    state.soundEnabled = !state.soundEnabled;
    nodes.clickSoundToggle.classList.toggle("active", state.soundEnabled);
    nodes.clickSoundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
    window.RatchetAudio.setEnabled(state.soundEnabled);
  }

  /**
   * Let learners turn the spindle by dragging its illustrated ratchet or thimble directly.
   */
  function startInstrumentDrag(event) {
    if (event.button !== 0 || event.target.closest("#lock-control")) return;
    if (state.locked) {
      showToast("Unlock the screw gauge before turning the instrument.");
      return;
    }
    if (!state.specimen) {
      showToast("Insert a specimen before taking a laboratory measurement.");
      return;
    }
    state.instrumentDrag = { pointerId: event.pointerId, clientX: event.clientX };
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  }

  /**
   * Convert horizontal instrument dragging into animated screw movement and audible clicks.
   */
  function continueInstrumentDrag(event) {
    if (!state.instrumentDrag || event.pointerId !== state.instrumentDrag.pointerId) return;
    const pixelDelta = event.clientX - state.instrumentDrag.clientX;
    const stepDelta = Math.round(-pixelDelta / 2);
    if (stepDelta !== 0) {
      state.instrumentDrag.clientX = event.clientX;
      moveSpindle(state.positionSteps + stepDelta, true);
    }
  }

  /**
   * Stop tracking a ratchet drag when its pointer is released or leaves the instrument.
   */
  function endInstrumentDrag(event) {
    if (!state.instrumentDrag) return;
    if (event.pointerId !== undefined && event.pointerId !== state.instrumentDrag.pointerId) return;
    state.instrumentDrag = null;
  }

  /**
   * Turn the ratchet by scrolling directly on the illustrated micrometer.
   */
  function onInstrumentWheel(event) {
    if (!state.specimen) return;
    if (state.locked) {
      showToast("Unlock the screw gauge before turning the instrument.");
      return;
    }
    event.preventDefault();
    moveSpindle(state.positionSteps + (event.deltaY > 0 ? 2 : -2), true);
  }

  /**
   * Lock or unlock the instrument with its illustrated lock nut or keyboard controls.
   */
  function toggleLockNut(event) {
    const isKeyboard = event.type === "keydown";
    if (isKeyboard && event.key !== "Enter" && event.key !== " ") return;
    if (isKeyboard) event.preventDefault();
    if (isKeyboard && state.locked) {
      state.locked = false;
    } else if (isKeyboard) {
      state.locked = true;
    } else {
      state.locked = !state.locked;
    }
    updateSpecimenDisplay();
    updateInstrumentPosition();
    showToast(state.locked ? "Lock nut engaged. Your current reading is secured." : "Lock nut released. The ratchet is ready.");
  }

  /**
   * Explain instrument components while hovering, tapping, or moving keyboard focus over them.
   */
  function onInstrumentPartFocus(event) {
    const part = event.target.closest("[data-part]");
    if (!part || !nodes.screwGaugeSvg.contains(part)) return;
    const rectangle = nodes.instrumentCanvas.getBoundingClientRect();
    const partRectangle = part.getBoundingClientRect();
    nodes.instrumentTooltip.textContent = part.getAttribute("aria-label");
    nodes.instrumentTooltip.style.left = Math.min(
      Math.max(partRectangle.left - rectangle.left + partRectangle.width / 2, 8),
      rectangle.width - 205
    ) + "px";
    nodes.instrumentTooltip.style.top = Math.max(partRectangle.top - rectangle.top - 31, 8) + "px";
    nodes.instrumentTooltip.style.display = "block";
  }

  /**
   * Dismiss the instrument tooltip after its labeled component is no longer active.
   */
  function onInstrumentPartBlur(event) {
    if (event.relatedTarget && event.relatedTarget.closest("[data-part]")) return;
    nodes.instrumentTooltip.style.display = "none";
  }

  /**
   * Change the instrument's zoom level without altering the measurement or experiment state.
   */
  function toggleInstrumentZoom() {
    const isZoomed = nodes.instrumentCanvas.classList.toggle("is-zoomed");
    nodes.zoomToggle.setAttribute("aria-label", isZoomed ? "Restore instrument size" : "Zoom instrument");
    nodes.zoomToggle.title = isZoomed ? "Restore instrument size" : "Zoom instrument";
    nodes.zoomToggle.textContent = isZoomed ? "↙" : "⌕";
  }

  /**
   * Convert an inline screw-gauge SVG into a downloadable high-resolution PNG screenshot.
   */
  function downloadScreenshot() {
    try {
      const svgCopy = nodes.screwGaugeSvg.cloneNode(true);
      svgCopy.querySelectorAll(".svg-labels").forEach(
        /** Restore informative instrument part labels in the downloaded screenshot. */
        function showSnapshotLabel(labelGroup) { labelGroup.removeAttribute("aria-hidden"); }
      );
      svgCopy.setAttribute("width", "2100");
      svgCopy.setAttribute("height", "790");
      const serializedSvg = new XMLSerializer().serializeToString(svgCopy);
      const svgBlob = new Blob([serializedSvg], { type: "image/svg+xml;charset=utf-8" });
      const imageUrl = URL.createObjectURL(svgBlob);
      const image = new Image();

      // Render the SVG snapshot once the browser has decoded the downloadable image.
      image.onload = function onScreenshotImageLoad() {
        const canvas = document.createElement("canvas");
        canvas.width = 2100;
        canvas.height = 790;
        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(imageUrl);
          showToast("This browser could not create a screenshot image.");
          return;
        }
        context.fillStyle = document.documentElement.dataset.theme === "dark" ? "#20232f" : "#f8f9fc";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(imageUrl);
        canvas.toBlob(
          /** Save the image only after the browser has produced a nonempty PNG blob. */
          function finishScreenshot(blob) {
            if (!blob) {
              showToast("Your screenshot could not be exported as a PNG.");
              return;
            }
            downloadBlob(blob, "screw-gauge-instrument.png");
            showToast("Your high-resolution instrument screenshot has been saved.");
          },
          "image/png"
        );
      };

      // Report decoding failures rather than silently generating an empty screenshot.
      image.onerror = function onScreenshotImageError(event) {
        URL.revokeObjectURL(imageUrl);
        console.error("Unable to render the instrument screenshot.", event);
        showToast("The instrument screenshot could not be rendered.");
      };
      image.src = imageUrl;
    } catch (error) {
      console.error("Unable to prepare the instrument screenshot.", error);
      showToast("The instrument screenshot could not be created in this browser.");
    }
  }

  /**
   * Initiate an accessible browser download for generated CSV and screenshot files.
   */
  function downloadBlob(blob, filename) {
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = filename;
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    // Release the temporary browser download URL after the browser has started the download.
    window.setTimeout(
      /** Release the temporary browser download URL after its download has started. */
      function releaseDownloadUrl() { URL.revokeObjectURL(downloadUrl); },
      1200
    );
  }

  /**
   * Escape CSV field characters while preserving decimal precision and object names.
   */
  function escapeCsvCell(value) {
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  /**
   * Generate a standards-compliant CSV of all saved laboratory observations.
   */
  function downloadCsv() {
    if (state.trials.length === 0) {
      showToast("Record at least one measurement before downloading the CSV.");
      return;
    }
    const headings = ["Trial", "Object", "MSR (mm)", "CSR (div)", "Zero Error (mm)", "Correction (mm)", "Final Reading (mm)"];
    const rows = state.trials.map(
      /** Keep each exported column consistent with the visible laboratory observation table. */
      function convertTrialToCsv(trial, index) {
        return [
          index + 1,
          trial.object,
          formatReading(trial.mainScaleSteps),
          trial.circularDivision,
          formatSignedReading(trial.zeroErrorSteps),
          formatSignedReading(-trial.zeroErrorSteps),
          formatReading(toSteps(trial.finalReading))
        ];
      }
    );
    const csvContent = "\ufeff" + [headings].concat(rows)
      .map(
        /** Apply CSV escaping consistently before joining each row's fields. */
        function encodeCsvRow(row) { return row.map(escapeCsvCell).join(","); }
      )
      .join("\r\n");
    downloadBlob(new Blob([csvContent], { type: "text/csv;charset=utf-8" }), "screw-gauge-observations.csv");
    showToast("Your " + state.trials.length + " observation" + (state.trials.length === 1 ? "" : "s") + " are ready in the downloaded CSV.");
  }

  /**
   * Build an observation-table cell using text content so specimen names remain safe.
   */
  function createTableCell(value, emphasized) {
    const cell = document.createElement("td");
    cell.textContent = value;
    if (emphasized) {
      cell.style.color = "var(--purple-dark)";
      cell.style.fontWeight = "700";
    }
    return cell;
  }

  /**
   * Render the current measurement history in both the simulation and notebook tables.
   */
  function renderTrials() {
    const tableBodyIds = ["observation-tbody", "observation-tbody-full"];
    tableBodyIds.forEach(
      /** Refresh the compact simulation table and the full laboratory notebook in one pass. */
      function updateObservationBody(tableId) {
        const tableBody = document.getElementById(tableId);
        const fragment = document.createDocumentFragment();
        if (state.trials.length === 0) {
          const row = document.createElement("tr");
          row.className = "empty-table-row";
          const cell = document.createElement("td");
          const icon = document.createElement("span");
          icon.textContent = "◎";
          cell.colSpan = 7;
          cell.appendChild(icon);
          cell.appendChild(document.createTextNode("Your first measurement is waiting to happen."));
          cell.appendChild(document.createElement("br"));
          const small = document.createElement("small");
          small.textContent = "Insert an object and add your reading to begin.";
          cell.appendChild(small);
          row.appendChild(cell);
          fragment.appendChild(row);
        } else {
          state.trials.forEach(
            /** Add all seven recorded measurement and zero-correction columns for a trial. */
            function addObservationRow(trial, index) {
              const row = document.createElement("tr");
              row.appendChild(createTableCell(String(index + 1)));
              row.appendChild(createTableCell(trial.object));
              row.appendChild(createTableCell(formatReading(trial.mainScaleSteps)));
              row.appendChild(createTableCell(String(trial.circularDivision).padStart(2, "0")));
              row.appendChild(createTableCell(formatSignedReading(trial.zeroErrorSteps)));
              row.appendChild(createTableCell(formatSignedReading(-trial.zeroErrorSteps)));
              row.appendChild(createTableCell(formatReading(toSteps(trial.finalReading)), true));
              fragment.appendChild(row);
            }
          );
        }
        tableBody.replaceChildren(fragment);
      }
    );

    const historyLabel = state.trials.length === 0
      ? "No readings recorded yet"
      : state.trials.length + " recorded trial" + (state.trials.length === 1 ? "" : "s");
    nodes.tableTrialCount.textContent = historyLabel;
    nodes.tableTrialCountFull.textContent = historyLabel;
    updateExperimentResults();
    window.LabChart.render(state.trials);
  }

  /**
   * Calculate and display the summary values and average absolute percentage error for all trials.
   */
  function updateExperimentResults() {
    const readings = state.trials.map(
      /** Extract corrected final readings before calculating the experiment summary. */
      function getReading(trial) { return trial.finalReading; }
    );
    const average = readings.length
      ? readings.reduce(
        /** Add every individual trial reading to the arithmetic mean. */
        function addReading(total, reading) { return total + reading; },
        0
      ) / readings.length
      : null;
    const highest = readings.length ? Math.max.apply(null, readings) : null;
    const lowest = readings.length ? Math.min.apply(null, readings) : null;
    const averagePercentageError = readings.length
      ? state.trials.reduce(
        /** Aggregate absolute percentage error against each specimen's hidden reference value. */
        function addPercentageError(total, trial) {
          return total + Math.abs(trial.finalReading - trial.trueDiameter) / trial.trueDiameter * 100;
        },
        0
      ) / readings.length
      : null;
    const targets = [
      {
        average: nodes.averageResult,
        maximum: nodes.maximumResult,
        minimum: nodes.minimumResult,
        error: nodes.errorResult,
        note: nodes.resultFootnote
      },
      {
        average: nodes.averageResultFull,
        maximum: nodes.maximumResultFull,
        minimum: nodes.minimumResultFull,
        error: nodes.errorResultFull,
        note: nodes.resultFootnoteFull
      }
    ];

    targets.forEach(
      /** Keep both visible average-diameter, maximum, minimum, and error summaries synchronized. */
      function updateSummary(target) {
        target.average.innerHTML = average === null ? "—<small> mm</small>" : average.toFixed(3) + "<small> mm</small>";
        target.maximum.innerHTML = highest === null ? "— <small>mm</small>" : highest.toFixed(2) + " <small>mm</small>";
        target.minimum.innerHTML = lowest === null ? "— <small>mm</small>" : lowest.toFixed(2) + " <small>mm</small>";
        target.error.innerHTML = averagePercentageError === null
          ? "— <small>%</small>"
          : averagePercentageError.toFixed(2) + " <small>%</small>";
        target.note.textContent = readings.length
          ? readings.length + " trial" + (readings.length === 1 ? "" : "s") + " · Mean absolute percentage error versus each specimen’s unrounded reference."
          : "Add your first trial to unlock experiment insights.";
      }
    );

    const completedSpecimens = new Set(state.trials.map(
      /** Count each measured specimen only once in the experiment progress indicator. */
      function getSpecimenName(trial) { return trial.object; }
    ));
    nodes.experimentProgressLabel.innerHTML = "YOUR PROGRESS&nbsp; " + completedSpecimens.size + " / " + data.objects.length;
  }

  /**
   * Save a contact-confirmed reading and its zero correction as a new experiment trial.
   */
  function addTrial() {
    if (!state.specimen) {
      showToast("Choose and insert a specimen before recording a trial.");
      return;
    }
    if (state.positionSteps < getContactPositionSteps()) {
      showToast("Gently close the ratchet until it touches the specimen before recording the trial.");
      nodes.rotationHint.textContent = "CLOSE THE RATCHET TO CONTACT";
      return;
    }

    const rawSteps = Math.min(
      toSteps(data.maximumTravel),
      Math.max(0, toSteps(state.specimen.diameter) + state.zeroErrorSteps)
    );
    const mainScaleStepInterval = toSteps(data.pitch);
    const mainScaleSteps = Math.floor(rawSteps / mainScaleStepInterval) * mainScaleStepInterval;
    const circularDivision = Math.round((rawSteps - mainScaleSteps) / toSteps(data.leastCount));
    const correctedSteps = rawSteps - state.zeroErrorSteps;
    const newTrial = {
      object: state.specimen.name,
      mainScaleSteps,
      circularDivision,
      zeroErrorSteps: state.zeroErrorSteps,
      finalReading: correctedSteps / travelStepsPerMillimetre,
      trueDiameter: state.specimen.diameter,
      timestamp: new Date().toISOString()
    };

    state.trials.push(newTrial);
    const historySaved = saveTrials();
    renderTrials();
    recordProcedureStep(5);
    showToast("Trial " + state.trials.length + " recorded · " + state.specimen.name + " · "
      + formatReading(correctedSteps) + " mm" + (historySaved ? "." : " (this session only)."));
  }

  /**
   * Remove only the last recorded trial so experiment history stays in its original order.
   */
  function deleteLastTrial() {
    if (state.trials.length === 0) {
      showToast("There are no recorded trials to delete.");
      return;
    }
    state.trials.pop();
    const historySaved = saveTrials();
    renderTrials();
    showToast(historySaved ? "The most recent observation has been removed."
      : "The most recent observation was removed for this session, but browser storage could not be updated.");
  }

  /**
   * Ask before clearing recorded observations and refresh every linked summary and chart.
   */
  function resetTrials() {
    if (state.trials.length > 0 && !window.confirm("Clear all saved observation trials for this experiment?")) return;
    state.trials = [];
    const historySaved = saveTrials();
    renderTrials();
    showToast(historySaved ? "Observation table reset. Your instrument is ready for another reading."
      : "The table was cleared for this session, but browser storage could not be updated.");
  }

  /**
   * Prompt the browser's accessible print dialog for a clean, PDF-ready lab report.
   */
  function printObservations() {
    const pageClass = state.page === "observation" ? "print-notebook" : "print-simulation";
    document.body.classList.add(pageClass);
    window.setTimeout(
      /** Open the native print dialog after the browser applies the report-only layout. */
      function openPrintDialog() {
        try {
          window.print();
        } catch (error) {
          document.body.classList.remove(pageClass);
          console.error("Unable to open the printable experiment report.", error);
          showToast("The browser could not open the print or PDF dialog.");
        }
      },
      80
    );
  }

  /**
   * Remove print-only page overrides after the browser completes or cancels the print dialog.
   */
  function finishPrinting() {
    document.body.classList.remove("print-notebook", "print-simulation");
  }

  /**
   * Add a PDF-export control beside the existing observation-table print and CSV buttons.
   */
  function addPdfDownloadButtons() {
    document.querySelectorAll(".observation-actions").forEach(
        /** Add a correctly scoped PDF-export action to both observation-table toolbars. */
        function addPdfButton(toolbar) {
          const printButton = toolbar.querySelector("[id^='print-observations']");
          if (!printButton) return;
          const button = document.createElement("button");
          button.className = "button-outline";
          button.type = "button";
          button.id = toolbar.closest("#page-observation") ? "download-pdf-full" : "download-pdf";
          button.title = "Open the print dialog and choose Save as PDF";
          const glyph = document.createTextNode("↓ ");
          const label = document.createElement("span");
          label.textContent = "Download PDF";
          button.append(glyph, label);
          button.addEventListener("click", printObservations);
          toolbar.insertBefore(button, printButton);
        }
    );
  }

  /**
   * Mark the corresponding procedure as explored when the learner completes an experiment action.
   */
  function recordProcedureStep(index) {
    state.completedSteps.add(index);
    renderProcedureSteps();
  }

  /**
   * Display the seven interactive lab steps and the learner's step-by-step procedure progress.
   */
  function renderProcedureSteps() {
    const fragment = document.createDocumentFragment();
    data.procedure.forEach(
      /** Build one accessible, independently selectable row for each laboratory instruction. */
      function createProcedureStep(step, index) {
        const item = document.createElement("div");
        const isDone = state.completedSteps.has(index);
        item.className = "procedure-step" + (isDone ? " done" : "");
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.setAttribute("aria-pressed", String(isDone));
        item.dataset.stepIndex = String(index);

        const icon = document.createElement("span");
        icon.className = "procedure-icon";
        icon.textContent = isDone ? "✓" : step.icon;
        const content = document.createElement("span");
        const title = document.createElement("strong");
        title.textContent = (index + 1).toString().padStart(2, "0") + " · " + step.title;
        const description = document.createElement("p");
        description.textContent = step.body;
        content.append(title, description);
        const check = document.createElement("span");
        check.className = "procedure-check";
        check.textContent = "✓";
        item.append(icon, content, check);
        fragment.appendChild(item);
      }
    );

    nodes.procedureSteps.replaceChildren(fragment);
    const doneCount = state.completedSteps.size;
    nodes.stepsProgressFill.style.width = (doneCount / data.procedure.length * 100) + "%";
    nodes.procedureProgressLabel.textContent = doneCount + " of " + data.procedure.length + " steps explored";
  }

  /**
   * Toggle a single procedure step when it receives a pointer or keyboard activation.
   */
  function onProcedureStepClick(event) {
    const step = event.target.closest("[data-step-index]");
    if (!step || !nodes.procedureSteps.contains(step)) return;
    const stepIndex = Number(step.dataset.stepIndex);
    if (state.completedSteps.has(stepIndex)) state.completedSteps.delete(stepIndex);
    else state.completedSteps.add(stepIndex);
    renderProcedureSteps();
  }

  /**
   * Support Enter and Space as equivalent to selecting a step in the interactive procedure.
   */
  function onProcedureStepKeydown(event) {
    if ((event.key === "Enter" || event.key === " ") && event.target.closest("[data-step-index]")) {
      event.preventDefault();
      onProcedureStepClick(event);
    }
  }

  /**
   * Reset the learner's completed-procedure progress without changing any recorded measurement.
   */
  function resetProcedureProgress() {
    state.completedSteps.clear();
    renderProcedureSteps();
  }

  /**
   * Construct an unbiased, new randomized 15-question quiz for each attempt.
   */
  function shuffleQuiz() {
    const questions = window.QuizData.slice();
    for (let index = questions.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      const temporary = questions[index];
      questions[index] = questions[randomIndex];
      questions[randomIndex] = temporary;
    }
    quiz = questions;
  }

  /**
   * Render the current randomized multiple-choice question or the finished quiz scorecard.
   */
  function renderQuizQuestion() {
    nodes.quizCounter.textContent = quizPosition >= quiz.length
      ? "QUIZ COMPLETE"
      : "QUESTION " + String(quizPosition + 1).padStart(2, "0") + " OF " + quiz.length;
    nodes.quizProgressFill.style.width = (quizPosition / quiz.length * 100) + "%";
    nodes.quizFeedback.textContent = "";
    nodes.quizNext.disabled = true;

    if (quizPosition >= quiz.length) {
      nodes.quizQuestionArea.replaceChildren();
      nodes.quizQuestionArea.classList.add("quiz-results");
      const symbol = document.createElement("div");
      symbol.className = "quiz-result-icon";
      symbol.textContent = "✳";
      const heading = document.createElement("h2");
      heading.textContent = "That's a wrap.";
      const score = document.createElement("strong");
      score.textContent = quizScore + " / " + quiz.length;
      const feedback = document.createElement("p");
      feedback.textContent = quizScore === quiz.length
        ? "A flawless result. Your understanding is every bit as precise as your measurements."
        : quizScore >= 10
          ? "A lovely result. Revisit the questions you missed and you’ll have this experiment down beautifully."
          : "Every question is another chance to learn. Revisit the theory and give it another go.";
      const restart = document.createElement("button");
      restart.className = "button-primary";
      restart.textContent = "Try a new quiz";
      restart.addEventListener("click", startQuiz);
      nodes.quizQuestionArea.append(symbol, heading, score, feedback, restart);
      nodes.quizNext.textContent = "Quiz complete";
      nodes.quizNext.disabled = true;
      return;
    }

    nodes.quizQuestionArea.classList.remove("quiz-results");
    const question = quiz[quizPosition];
    const fragment = document.createDocumentFragment();
    const questionNumber = document.createElement("span");
    questionNumber.className = "quiz-number";
    questionNumber.textContent = "QUESTION " + String(quizPosition + 1).padStart(2, "0");
    const title = document.createElement("h2");
    title.className = "quiz-question";
    title.textContent = question.q;
    const choices = document.createElement("div");
    choices.className = "quiz-choices";
    question.options.forEach(
      /** Create one keyboard- and screen-reader-friendly choice for every possible answer. */
      function makeQuizOption(answer, index) {
        const button = document.createElement("button");
        button.className = "quiz-option";
        button.type = "button";
        button.dataset.answerIndex = String(index);
        const letter = document.createElement("span");
        letter.className = "quiz-option-key";
        letter.textContent = String.fromCharCode(65 + index);
        const text = document.createElement("span");
        text.textContent = answer;
        button.append(letter, text);
        choices.appendChild(button);
      }
    );
    fragment.append(questionNumber, title, choices);
    nodes.quizQuestionArea.replaceChildren(fragment);
    nodes.quizNext.textContent = "Check answer";
  }

  /**
   * Start a fresh randomized quiz and clear only the score and selections from the previous attempt.
   */
  function startQuiz() {
    quizPosition = 0;
    quizSelection = -1;
    quizScore = 0;
    quizAnswered = false;
    shuffleQuiz();
    renderQuizQuestion();
  }

  /**
   * Record the learner's selected answer and prevent accidental multiple selections.
   */
  function onQuizOptionClick(event) {
    const option = event.target.closest("[data-answer-index]");
    if (!option || quizAnswered) return;
    quizSelection = Number(option.dataset.answerIndex);
    nodes.quizQuestionArea.querySelectorAll(".quiz-option").forEach(
      /** Visually distinguish the selected answer and announce its selection accessibly. */
      function markSelectedOption(button) {
        const selected = button === option;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
    );
    nodes.quizNext.disabled = false;
  }

  /**
   * Check the selected answer, explain the reasoning, and advance to the randomized next question.
   */
  function advanceQuiz() {
    if (quizSelection < 0 || quizAnswered || quizPosition >= quiz.length) return;
    quizAnswered = true;
    const question = quiz[quizPosition];
    const options = Array.from(nodes.quizQuestionArea.querySelectorAll(".quiz-option"));
    options.forEach(
      /** Freeze answer choices and highlight the correct answer after each quiz question. */
      function showCorrectAnswer(option, index) {
        option.disabled = true;
        if (index === question.answer) option.classList.add("correct");
        else if (index === quizSelection) option.classList.add("incorrect");
      }
    );
    const isCorrect = quizSelection === question.answer;
    if (isCorrect) {
      quizScore += 1;
      nodes.quizFeedback.textContent = "Exactly right · nicely done.";
    } else {
      nodes.quizFeedback.textContent = "Not quite this time · here’s why.";
    }

    const explanation = document.createElement("div");
    explanation.className = "quiz-explanation";
    explanation.textContent = question.explanation;
    nodes.quizQuestionArea.appendChild(explanation);
    nodes.quizNext.disabled = false;
    nodes.quizNext.textContent = quizPosition === quiz.length - 1 ? "See your results" : "Next question";
  }

  /**
   * Advance the quiz after a checked answer, leaving answer-checking available until then.
   */
  function onQuizNextClick() {
    if (quizPosition >= quiz.length) return;
    if (!quizAnswered) {
      advanceQuiz();
      return;
    }
    quizPosition += 1;
    quizSelection = -1;
    quizAnswered = false;
    renderQuizQuestion();
  }

  /**
   * Create the complete set of 20 keyboard-accessible, click-to-reveal viva questions and answers.
   */
  function renderVivaQuestions() {
    const fragment = document.createDocumentFragment();
    data.viva.forEach(
      /** Assemble each labeled viva question with its initially concealed answer. */
      function makeVivaQuestion(item, index) {
        const card = document.createElement("article");
        card.className = "viva-item";
        const button = document.createElement("button");
        button.className = "viva-question-button";
        button.type = "button";
        button.setAttribute("aria-expanded", "false");
        const number = document.createElement("span");
        number.className = "viva-number";
        number.textContent = String(index + 1).padStart(2, "0");
        const question = document.createElement("span");
        question.className = "viva-question-text";
        question.textContent = item.q;
        const disclosure = document.createElement("span");
        disclosure.className = "viva-toggle";
        disclosure.textContent = "+";
        button.append(number, question, disclosure);
        const answer = document.createElement("div");
        answer.className = "viva-answer";
        answer.setAttribute("aria-hidden", "true");
        const answerText = document.createElement("div");
        answerText.className = "viva-answer-inner";
        const paragraph = document.createElement("p");
        paragraph.textContent = item.a;
        answerText.appendChild(paragraph);
        answer.appendChild(answerText);
        card.append(button, answer);
        fragment.appendChild(card);
      }
    );
    nodes.vivaGrid.replaceChildren(fragment);
  }

  /**
   * Expand or collapse one viva answer and keep its screen-reader state synchronized.
   */
  function onVivaQuestionClick(event) {
    const button = event.target.closest(".viva-question-button");
    if (!button) return;
    const card = button.closest(".viva-item");
    const willOpen = !card.classList.contains("open");
    card.classList.toggle("open", willOpen);
    button.setAttribute("aria-expanded", String(willOpen));
    card.querySelector(".viva-answer").setAttribute("aria-hidden", String(!willOpen));
  }

  /**
   * Reveal all twenty answers at once or return the viva list to its original collapsed state.
   */
  function toggleAllVivaAnswers() {
    vivaExpanded = !vivaExpanded;
    nodes.vivaGrid.querySelectorAll(".viva-item").forEach(
      /** Synchronize every disclosure icon and answer when expanding or collapsing the full viva. */
      function setVivaAnswer(card) {
        card.classList.toggle("open", vivaExpanded);
        card.querySelector(".viva-question-button").setAttribute("aria-expanded", String(vivaExpanded));
        card.querySelector(".viva-answer").setAttribute("aria-hidden", String(!vivaExpanded));
      }
    );
    nodes.vivaExpandAll.innerHTML = vivaExpanded ? "Collapse all −" : "Expand all <span>＋</span>";
  }

  /**
   * Toggle real fullscreen mode without losing the experiment when browser permissions prevent it.
   */
  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          return;
        }
        showToast("Fullscreen mode is not supported by this browser.");
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Unable to change simulation fullscreen mode.", error);
      showToast("The browser could not change its fullscreen setting.");
    }
  }

  /**
   * Update the fullscreen control's label whenever the browser enters or exits fullscreen.
   */
  function updateFullscreenButton() {
    const isFullscreen = Boolean(document.fullscreenElement);
    nodes.fullscreenToggle.textContent = isFullscreen ? "↙" : "⛶";
    nodes.fullscreenToggle.title = isFullscreen ? "Exit fullscreen" : "Fullscreen simulation";
    nodes.fullscreenToggle.setAttribute("aria-label", isFullscreen ? "Exit fullscreen simulation" : "Enter fullscreen simulation");
  }

  /**
   * Start the short laboratory intro animation, and always make the workspace accessible afterward.
   */
  function dismissLoadingScreen() {
    window.setTimeout(function finishLoadingAnimation() {
      nodes.loadingScreen.classList.add("is-done");
    }, 640);
  }

  /**
   * Reset the specimen, instrument, zero adjustment, trial history, and all summary values together.
   */
  function resetExperiment() {
    if (!window.confirm("Reset the entire experiment? This clears its saved observation table.")) return;
    state.specimen = null;
    state.positionSteps = 0;
    state.zeroErrorSteps = 0;
    state.locked = false;
    state.trials = [];
    state.completedSteps.clear();
    nodes.objectSelect.value = "";
    document.querySelectorAll(".zero-option").forEach(
      /** Restore the no-error selection across every available calibration control. */
      function resetZeroOption(button) {
        const isSelected = button.dataset.zero === "0";
        button.classList.toggle("selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
      }
    );
    const historySaved = saveTrials();
    updateSpecimenDisplay();
    updateMeasurement();
    renderTrials();
    renderProcedureSteps();
    showToast(historySaved ? "Experiment reset. Your laboratory bench is ready."
      : "Experiment reset for this session, but browser storage could not be updated.");
  }

  /**
   * Show saved experiment changes from another lab tab without interrupting the active specimen.
   */
  function onStorageChange(event) {
    if (event.key !== storageKey || !event.newValue) return;
    try {
      const updatedTrials = JSON.parse(event.newValue);
      if (!Array.isArray(updatedTrials) || updatedTrials.some(invalidSavedTrial)) {
        throw new Error("The other tab stored an invalid trial list.");
      }
      state.trials = updatedTrials;
      renderTrials();
      showToast("Your observation history was updated in another laboratory tab.");
    } catch (error) {
      console.error("Unable to read observations saved by another experiment tab.", error);
      showToast("Another tab saved unreadable data. Your current observations were left unchanged.");
    }
  }

  /**
   * Connect all interactive experiment controls and matching notebook actions.
   */
  function bindEvents() {
    const ratchetGroup = document.querySelector('[data-part="Ratchet"]');
    if (!ratchetGroup) throw new Error("The illustrated ratchet is missing from the screw-gauge instrument.");
    nodes.themeToggle.addEventListener("click", toggleTheme);
    nodes.objectSelect.addEventListener(
      "change",
      /** Gently seat a specimen in the micrometer immediately after its selection. */
      function selectSpecimenForInsertion() {
        if (nodes.objectSelect.value) insertSpecimen();
      }
    );
    nodes.insertObject.addEventListener("click", insertSpecimen);
    nodes.removeObject.addEventListener("click", removeSpecimen);
    document.querySelectorAll(".zero-options").forEach(
      /** Apply zero-error selection changes in both the reading and correction controls. */
      function connectZeroOptions(group) { group.addEventListener("click", selectZeroError); }
    );
    nodes.rotateBackward.addEventListener(
      "click",
      /** Advance the spindle by one small anticlockwise ratchet adjustment. */
      function rotateCounterclockwise() { turnRatchet(-1); }
    );
    nodes.rotateForward.addEventListener(
      "click",
      /** Advance the spindle by one small clockwise ratchet adjustment. */
      function rotateClockwise() { turnRatchet(1); }
    );
    nodes.rotationSlider.addEventListener("input", onRotationSliderInput);
    nodes.rotationSlider.addEventListener(
      "change",
      /** Reconcile the final pointer-adjusted slider position with the instrument reading. */
      function confirmSliderPosition() { updateMeasurement(); }
    );
    nodes.clickSoundToggle.addEventListener("click", toggleRatchetSound);
    nodes.instrumentCanvas.addEventListener("wheel", onInstrumentWheel, { passive: false });
    nodes.spindleGroup.addEventListener("pointerdown", startInstrumentDrag);
    nodes.thimbleAssembly.addEventListener("pointerdown", startInstrumentDrag);
    ratchetGroup.addEventListener("pointerdown", startInstrumentDrag);
    nodes.spindleGroup.addEventListener("pointermove", continueInstrumentDrag);
    nodes.thimbleAssembly.addEventListener("pointermove", continueInstrumentDrag);
    ratchetGroup.addEventListener("pointermove", continueInstrumentDrag);
    document.addEventListener("pointerup", endInstrumentDrag);
    document.addEventListener("pointercancel", endInstrumentDrag);
    nodes.instrumentCanvas.addEventListener("focusin", onInstrumentPartFocus);
    nodes.instrumentCanvas.addEventListener("pointerover", onInstrumentPartFocus);
    nodes.instrumentCanvas.addEventListener("focusout", onInstrumentPartBlur);
    nodes.instrumentCanvas.addEventListener(
      "pointerleave",
      /** Hide a component description as the pointer leaves the instrument. */
      function hidePartTooltip() { nodes.instrumentTooltip.style.display = "none"; }
    );
    const lockControl = document.getElementById("lock-control");
    lockControl.addEventListener("click", toggleLockNut);
    lockControl.addEventListener("keydown", toggleLockNut);
    nodes.zoomToggle.addEventListener("click", toggleInstrumentZoom);
    nodes.screenshotButton.addEventListener("click", downloadScreenshot);
    nodes.fullscreenToggle.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", updateFullscreenButton);
    nodes.addTrial.addEventListener("click", addTrial);
    nodes.deleteTrial.addEventListener("click", deleteLastTrial);
    document.getElementById("delete-trial-full").addEventListener("click", deleteLastTrial);
    nodes.resetTrials.addEventListener("click", resetTrials);
    document.getElementById("reset-trials-full").addEventListener("click", resetTrials);
    nodes.downloadCsv.addEventListener("click", downloadCsv);
    document.getElementById("download-csv-full").addEventListener("click", downloadCsv);
    document.querySelectorAll("[id^='print-observations']").forEach(
      /** Connect both report toolbars to the same print-optimized laboratory report. */
      function connectPrintButton(button) { button.addEventListener("click", printObservations); }
    );
    window.addEventListener("afterprint", finishPrinting);
    nodes.quizQuestionArea.addEventListener("click", onQuizOptionClick);
    nodes.quizNext.addEventListener("click", onQuizNextClick);
    nodes.vivaGrid.addEventListener("click", onVivaQuestionClick);
    nodes.vivaExpandAll.addEventListener("click", toggleAllVivaAnswers);
    nodes.resetExperiment.addEventListener("click", resetExperiment);
    nodes.procedureSteps.addEventListener("click", onProcedureStepClick);
    nodes.procedureSteps.addEventListener("keydown", onProcedureStepKeydown);
    nodes.procedureReset.addEventListener("click", resetProcedureProgress);
    window.addEventListener("storage", onStorageChange);
  }

  /**
   * Launch the full laboratory after checking its required screens and browser-side data modules.
   */
  function initializeExperiment() {
    if (!data || !window.QuizData || !window.LabChart || !window.RatchetAudio) {
      throw new Error("A required experiment data, chart, quiz, or audio module failed to load.");
    }
    collectNodes();
    populateSpecimens();
    renderThimbleScale();
    initializeNavigation();
    initializeTheme();
    addPdfDownloadButtons();
    renderProcedureSteps();
    renderVivaQuestions();
    startQuiz();
    state.trials = loadTrials();
    renderTrials();
    updateSpecimenDisplay();
    updateMeasurement();
    bindEvents();
    dismissLoadingScreen();
  }

  /**
   * Surface startup problems explicitly while avoiding an unfinished, misleading laboratory interface.
   */
  function reportInitializationError(error) {
    console.error("The Virtual Physics Laboratory could not initialize.", error);
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) loadingScreen.remove();
    const startupMessage = document.createElement("div");
    startupMessage.setAttribute("role", "alert");
    startupMessage.style.cssText = "position:fixed;inset:0;display:grid;place-content:center;gap:10px;padding:24px;background:#f5f6f9;color:#23293a;font:15px 'DM Sans',sans-serif;text-align:center";
    const heading = document.createElement("strong");
    heading.textContent = "The laboratory could not load.";
    const details = document.createElement("span");
    details.textContent = error.message;
    startupMessage.append(heading, details);
    document.body.appendChild(startupMessage);
  }

  try {
    initializeExperiment();
  } catch (error) {
    reportInitializationError(error);
  }
})();
