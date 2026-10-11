// Expose a small Chart.js rendering surface for both experiment and notebook views.
(function () {
  "use strict";

  let charts = [];

  /**
   * Draw a synchronized, accessible Chart.js graph in every visible experiment view.
   */
  function renderCharts(readings) {
    const canvases = [
      { canvas: document.getElementById("diameter-chart"), placeholder: document.getElementById("chart-placeholder") },
      { canvas: document.getElementById("diameter-chart-full"), placeholder: document.getElementById("chart-placeholder-full") }
    ];

    // Update each graph canvas independently so both pages always show the same trials.
    canvases.forEach(function renderOneChart(item) {
      if (!item.canvas || !item.placeholder) return;
      item.placeholder.hidden = readings.length > 0;

      if (typeof window.Chart !== "function") {
        item.canvas.hidden = true;
        item.placeholder.textContent = readings.length ? "Chart.js could not be loaded. Your observations are safe; check your internet connection to view the graph." : "Your measurements will appear here.";
        return;
      }

      item.canvas.hidden = false;
      if (typeof window.Chart.getChart === "function") {
        const existingChart = window.Chart.getChart(item.canvas);
        if (existingChart) existingChart.destroy();
      }

      // Destroy an existing graph before replacing it with the current experiment results.
      charts = charts.filter(function removeReplacedChart(chart) {
        if (chart.canvas === item.canvas) {
          chart.destroy();
          return false;
        }
        return true;
      });

      const context = item.canvas.getContext("2d");
      if (!context) throw new Error("The experiment graph could not access its canvas.");

      const chart = new window.Chart(context, {
        type: "bar",
        data: {
          // Pair each displayed specimen label with its measurement-table trial number.
          labels: readings.map(function createChartLabel(reading, index) { return "T" + (index + 1) + " · " + reading.object; }),
          datasets: [{
            label: "Corrected diameter (mm)",
            // Plot the zero-corrected readings recorded in the experiment table.
            data: readings.map(function getCorrectedDiameter(reading) { return reading.finalReading; }),
            backgroundColor: "rgba(116, 101, 204, 0.76)",
            hoverBackgroundColor: "#7163c7",
            borderColor: "#7064bd",
            borderWidth: 1,
            borderRadius: 6,
            maxBarThickness: 34
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 300 },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                // Show each individual bar's diameter with the instrument's millimetre unit.
                label: function formatChartTooltip(context) { return " " + Number(context.parsed.y).toFixed(2) + " mm"; }
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: "#848a9b", maxRotation: 30, minRotation: 0, font: { family: "DM Sans", size: 9 } } },
            y: {
              beginAtZero: true,
              grid: { color: "rgba(122, 132, 158, 0.13)", drawBorder: false },
              // Label every vertical-axis tick with the unit used by the micrometer.
              ticks: { color: "#848a9b", font: { family: "DM Sans", size: 9 }, callback: function formatAxisTick(value) { return value + " mm"; } }
            }
          }
        }
      });
      charts.push(chart);
    });
  }

  window.LabChart = { render: renderCharts };
})();
