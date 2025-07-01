// Load and parse hurricane CSV data
async function loadCSV(path) {
  const response = await fetch(path);
  const csvText = await response.text();
  return parseCSV(csvText);
}

function parseCSV(csvText, delimiter = ',') {
  const rows = csvText.trim().split('\n').slice(1); // skip header row
  const res = [];

  for (let r = 0; r < rows.length; r++) {
    const cols = rows[r].split(',');
    let cat = "";

    // Determine hurricane category based on wind speed
    if (cols[7] >= 137) cat = "Category 5";
    else if (cols[7] >= 113) cat = "Category 4";
    else if (cols[7] >= 96) cat = "Category 3";
    else if (cols[7] >= 83) cat = "Category 2";
    else if (cols[7] >= 64) cat = "Category 1";
    else cat = "Tropical Storm/Depression";

    res.push({
      time: cols[1],
      lat: parseFloat(cols[5]),
      lon: parseFloat(cols[6]),
      vmax: parseInt(cols[7]),
      mslp: parseInt(cols[8]),
      category: cat,
    });
  }
  return res;
}

// Custom symbol for Category 5 hurricane marker
Highcharts.SVGRenderer.prototype.symbols.pentagon = function (x, y, w, h) {
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  const scale = 1.25;
  const r = Math.min(w, h) / 2 * scale;
  const angle = Math.PI * 2 / 5;
  const path = [];

  for (let i = 0; i < 5; i++) {
    const theta = i * angle - Math.PI / 2;
    const px = centerX + r * Math.cos(theta);
    const py = centerY + r * Math.sin(theta);
    path.push(i === 0 ? 'M' : 'L', px, py);
  }
  path.push('Z');
  return path;
};

// Main initialization function
(async () => {
  let glossaryNotification = false;

  // Glossary terms for contextual help
  const glossaryTerms = {
    cone: {
      header: "Cone of Uncertainty",
      terms: [
        { term: "Definition", definition: "An area where the center of the storm may pass, indicating uncertainty in its forecasted track." },
        { term: "Widening", definition: "The increasing uncertainty over time." }
      ]
    },
    path: {
      header: "Forecast Path",
      terms: [
        { term: "Track", definition: "The predicted course of the hurricane." },
        { term: "Intensity", definition: "Estimated strength along the track." }
      ]
    },
    risk: {
      header: "Risk Zones",
      terms: [
        { term: "High Risk", definition: "Locations with the highest threat from hurricane conditions." }
      ]
    },
    wiki: {
      header: "Wiki Maps",
      terms: [
        { term: "Additional Info", definition: "Extra details gathered from community resources." }
      ]
    }
  };

  // Inject glossary terms dynamically
  function updateGlossary() {
    const container = document.getElementById("glossary-content");
    let html = "<h2></h2>";
    let hasDefinitions = false;
    const checkboxes = document.querySelectorAll('.layer-checkbox');
  
    checkboxes.forEach(cb => {
      const layer = cb.dataset.layer;
      if (cb.checked && glossaryTerms[layer]) {
        const data = glossaryTerms[layer];
        html += `<h3>${data.header}</h3><ul>`;
        data.terms.forEach(item => {
          html += `<li><strong>${item.term}:</strong> ${item.definition}</li>`;
        });
        html += `</ul>`;
        hasDefinitions = true;
      }
    });
  
    container.innerHTML = html;
  
    const glossaryPopup = document.getElementById("glossary-popup");
    const notifBadge = document.getElementById("glossary-notification");
  
    // Show red dot only if new layer was toggled AND glossary is closed
    notifBadge.style.display = glossaryNotification && glossaryPopup.style.display !== "block"
      ? "block"
      : "none";
  }
  
  

  // Load hurricane and basemap data
  const hurricane_path = await loadCSV("hurricane_michael_data.csv");
  const usa = await fetch("https://code.highcharts.com/mapdata/countries/us/us-all.topo.json").then(r => r.json());

  // Initialize map chart
  Highcharts.setOptions({
    mapNavigation: { enabled: true, enableButtons: false }
  });

  const chart = Highcharts.mapChart("map-container", {
    chart: {
      reflow: false,
      panning: { enabled: true, type: "xy" },
    },
    title: { text: "Hurricane Michael 2018" },
    exporting: { enabled: false },
    legend: { enabled: false, align: "right", layout: "vertical", verticalAlign: "bottom", x: -20, y: -20 },
    plotOptions: {
      mappoint: {
        point: {
          events: {
            click: function () {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }
        }
      }
    },
    mapNavigation: { enabled: true, enableButtons: false },
    series: [
      { name: "Base map", nullColor: "#acb", legendSymbolColor: "#acb", borderColor: "#888", mapData: usa },
      { type: 'tiledwebmap', name: 'Basemap Tiles', provider: { type: 'OpenStreetMap' }, showInLegend: false },
      { name: "Hurricane Path", type: "mapline", lineWidth: 3, color: "#000000", zIndex: 2, legendSymbolColor: "#d22", enableMouseTracking: false,
        data: [{ geometry: { type: "LineString", coordinates: hurricane_path.map(p => [p.lon, p.lat]) } }] },
      { id: 'user-locations', name: "User Locations", type: "mappoint", zIndex: 5, visible: true,
        tooltip: {
          useHTML: true,
          hideDelay: 500,
          pointFormatter: function() {
            return `<b>Lat:</b> ${this.lat.toFixed(4)}<br/><b>Lon:</b> ${this.lon.toFixed(4)}<br/>`;
          }
        },
        marker: { symbol: "circle", fillColor: "#00008B", lineColor: "#00008B", lineWidth: 1, radius: 4 },
        data: []
      },
      { name: "Hurricane Path Markers", type: "mappoint", visible: false, zIndex: 3, dataLabels: { format: "{point.time}" },
        tooltip: {
          pointFormat: `<b>Classification:</b> {point.name}<br/><b>Vmax:</b> {point.vmax} knots<br/><b>MSLP:</b> {point.mslp} mb <br/>`
        },
        data: hurricane_path.map(point => {
          let symbol = 'circle';
          let color = '#FFFFFF';
          if (point.vmax >= 137) { symbol = 'pentagon'; color = '#8B0000'; }
          else if (point.vmax >= 113) { symbol = 'square'; color = '#FF0000'; }
          else if (point.vmax >= 96) { symbol = 'triangle'; color = '#FFA500'; }
          else if (point.vmax >= 83) { color = '#FFFF00'; }
          else if (point.vmax < 64) { color = '#888888'; }
          return {
            name: point.category, time: point.time, lat: point.lat, lon: point.lon, vmax: point.vmax, mslp: point.mslp,
            marker: { symbol, fillColor: color, lineColor: '#000000', lineWidth: 1, radius: 10 }
          };
        })
      }
    ]
  });

  const addedLocations = new Map(); // key: custom id, value: { name, point }
  let locationIdCounter = 0;


  // Load and add cone of uncertainty
  const coneTopo = await fetch("al142018-010A_5day_pgn.json").then(r => r.json());
  const coneGeo = window.topojson.feature(coneTopo, coneTopo.objects["al142018-010A_5day_pgn"]);
  chart.addSeries({ name: "Cone of Uncertainty", type: "map", lineWidth: 3, tooltip: { enabled: false }, enableMouseTracking: false,
    color: "#cc0000", opacity: 0.5, legendSymbolColor: "#d22", data: coneGeo.features.map(f => ({ geometry: f.geometry, properties: f.properties })),
    mapData: coneGeo, zIndex: 0, joinBy: null });

  // Hide all layers by default
  ["Hurricane Path", "Hurricane Path Markers", "Cone of Uncertainty"].forEach(name => {
    const series = chart.series.find(s => s.name === name);
    if (series) series.setVisible(false, false);
  });
  chart.redraw();

  // Setup interaction handlers
  document.getElementById("current-location").addEventListener("click", async () => {
    const userLocation = await new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        err => {
          console.error("Geolocation error:", err);
          resolve(null);
        }
      );
    });
  
    if (userLocation) {
      const id = locationIdCounter++;
      const userLocationsSeries = chart.series.find(s => s.name === "User Locations");
  
      userLocationsSeries.addPoint({
        name: "Your Location",
        lat: userLocation.lat,
        lon: userLocation.lon,
        custom: { id },
        marker: {
          enabled: false // hide default marker
        },
        dataLabels: {
          enabled: true,
          useHTML: true,
          formatter: function () {
            return `
              <div style="
                font-family: 'Inter', sans-serif;
                font-size: 12px;
                color: white;
                display: flex;
                flex-direction: column;
                align-items: center;
              ">
                <div class="pulse-marker"></div>
              </div>`;
          },
          
          style: {
            textAlign: 'center'
          }
        },
        tooltip: {
          pointFormat: "This is your current location"
        }
      }, true, false);
  
      const point = userLocationsSeries.points[userLocationsSeries.points.length - 1];
  
      addedLocations.set(id, { name: "Your Location", point });
      renderLocationList();
    } else {
      alert("Unable to retrieve your location.");
    }
  });
  
  

  // Map export
  $("#download_button").click(() => {
    chart.exportChartLocal({ type: 'image/png', filename: 'chart_image' });
  });

  // Resize handling
  function resizeChart() {
    const container = document.getElementById('map-container');
    chart.setSize(container.offsetWidth, container.offsetHeight, false);
  }
  window.addEventListener('resize', () => {
    resizeChart();
    positionTaskbarBelowTitle();
  });

  // Adjust taskbar based on chart title position
  function positionTaskbarBelowTitle() {
    const chartContainer = document.getElementById('map-container');
    const taskbar = document.getElementById('taskbar');
    const title = chartContainer.querySelector('.highcharts-title');
    if (title && taskbar) {
      const titleBBox = title.getBBox();
      taskbar.style.top = `${titleBBox.y + titleBBox.height + 20}px`;
    }
  }
  positionTaskbarBelowTitle();

  // Button popup toggle
  function setupToggle(buttonId, popupId) {
    const button = document.getElementById(buttonId);
    const popup = document.getElementById(popupId);
    const closeBtn = popup.querySelector('.close-popup');
  
    button.addEventListener('click', () => {
      const isVisible = popup.style.display === 'block';
  
      // Close all other popups and remove active classes
      document.querySelectorAll('.popup').forEach(p => {
        if (p.id !== 'glossary-popup') {
          p.style.display = 'none';
        }
      });
      document.querySelectorAll('.taskbar-button').forEach(btn => {
        btn.classList.remove('active');
      });
  
      if (buttonId === "glossary-button") {
        document.getElementById("glossary-notification").style.display = "none";
        glossaryNotification = false;
      }
  
      if (isVisible) {
        popup.style.display = 'none';
        button.classList.remove('active');
        button.blur(); // ← removes focus so gray background goes away
      } else {
        popup.style.display = 'block';
        button.classList.add('active');
      }
    });
  
    closeBtn.addEventListener('click', () => {
      popup.style.display = 'none';
      button.classList.remove('active');
      button.blur(); // ← same here, to remove highlight if 'X' was last clicked
    });
  }
  
  
  setupToggle('glossary-button', 'glossary-popup');
  setupToggle('poi-button', 'poi-popup');
  setupToggle('layers-button', 'layers-popup');
  setupToggle('wiki-button', 'wiki-popup');
  
  

  // Layer toggle logic
  document.querySelectorAll('.layer-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', e => {
      const layerName = e.target.dataset.layer;
      if (layerName === 'cone') {
        const coneSeries = chart.series.find(s => s.name === "Cone of Uncertainty");
        if (coneSeries) coneSeries.setVisible(e.target.checked, false);
      }
      if (layerName === 'path') {
        const path = chart.series.find(s => s.name === "Hurricane Path");
        const markers = chart.series.find(s => s.name === "Hurricane Path Markers");
        if (path && markers) {
          path.setVisible(e.target.checked, false);
          markers.setVisible(e.target.checked, false);
        }
      }
      const popup = document.getElementById(`popup-${layerName}`);
      if (popup) popup.style.display = e.target.checked ? 'block' : 'none';
      if (e.target.checked) glossaryNotification = true;
      updatePopupPositions();
      updateGlossary();
    });
  });

  // Reposition layer popups
  function updatePopupPositions() {
    const visiblePopups = Array.from(document.querySelectorAll('.layer-popup')).filter(p => p.style.display === 'block');
    const popupHeight = 100;
    visiblePopups.forEach((popup, index) => {
      popup.style.bottom = `${10 + (popupHeight + 10) * index}px`;
    });
  }

  // Add marker from address lookup
  document.getElementById('add-location').addEventListener('click', async () => {
    
    const addressInput = document.getElementById('location-input');
    const messageDiv = document.getElementById('message');
    const address = addressInput.value.trim();
  
    if (!address) {
      messageDiv.innerText = "Please enter a valid address.";
      return;
    }
  
    try {
      const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=7f3db94804634683a492123ae49bad8b`);
      const data = await response.json();
    
      console.log("Geocoding full response:", data);
    
      if (data && data.results && data.results.length > 0) {
        const geometry = data.results[0].geometry;
    
        if (geometry && typeof geometry.lat === "number" && typeof geometry.lng === "number") {
          const lat = geometry.lat;
          const lng = geometry.lng;
          const id = locationIdCounter++;
          const userLocationsSeries = chart.series.find(s => s.name === "User Locations");
    
          userLocationsSeries.addPoint({
            name: address,
            lat,
            lon: lng,
            custom: { id }
          }, true, false); // redraw = true, shift = false
          
          const point = userLocationsSeries.points[userLocationsSeries.points.length - 1];
          console.log("Manually fetched added point:", point);
              
          addedLocations.set(id, { name: address, point });
          renderLocationList();
    
          //messageDiv.innerText = `Marker added at (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          addressInput.value = "";
        } else {
          console.warn("Missing or invalid geometry:", geometry);
          messageDiv.innerText = "Geocoding failed: coordinates missing.";
        }
      } else {
        console.warn("Geocoding failed: no results found");
        messageDiv.innerText = "Address not found. Please try again.";
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      messageDiv.innerText = "An error occurred while geocoding.";
    }
    

  });

  const addressInput = document.getElementById('location-input');
  const messageDiv = document.getElementById('message');

  addressInput.addEventListener('input', () => {
    messageDiv.innerText = '';
  });


  function renderLocationList() {
    const list = document.getElementById('location-list');
    if (!list) return;
  
    list.innerHTML = '';
  
    addedLocations.forEach((info, id) => {
      const li = document.createElement('li');
      li.classList.add('location-item');
  
      const span = document.createElement('span');
      span.textContent = info.name;
  
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'x';
      removeBtn.setAttribute('aria-label', `Remove ${info.name}`);
      removeBtn.classList.add('remove-location');
  
      removeBtn.addEventListener('click', () => {
        const point = info.point;
      
        if (point && typeof point.remove === 'function') {
          point.remove(); // ✅ this should now actually remove the dot
        } else {
          console.warn("Couldn't find point to remove", point);
        }
      
        addedLocations.delete(id);
        renderLocationList();
      });
      
  
      li.appendChild(span);
      li.appendChild(removeBtn);
      list.appendChild(li);
    });
  }
  

  

  // Zoom controls
  document.getElementById('zoom-in').addEventListener('click', () => chart.mapView.zoomBy(1));
  document.getElementById('zoom-out').addEventListener('click', () => chart.mapView.zoomBy(-1));

})();
