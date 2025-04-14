async function loadCSV(path){
  const response = await fetch(path);
  const csvText = await response.text();
  return parseCSV(csvText);
}

function parseCSV(csvText, delimiter = ',') {
  const rows = csvText.trim().split('\n').slice(1); // remove header
  var res = [];

  for(var r = 0; r < rows.length; r++){
    const cols = rows[r].split(',');
    var cat = "";

    //assign category based on wind speed
    if (cols[7] >= 137) {
      cat = "Category 5";
    } else if (cols[7] >= 113) {
      cat = "Category 4";
    } else if (cols[7] >= 96) {
      cat = "Category 3";
    } else if (cols[7] >= 83) {
      cat = "Category 2";
    } else if (cols[7] >= 64) {
      cat = "Category 1";
    } else {
      cat = "Tropical Storm/Depression";
    }

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

//for category 5 marker symbol
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

;(async () => {

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
  
  function updateGlossary() {
    const container = document.getElementById("glossary-content");
    // Always display a sticky header "Glossary"
    let html = "<h2>Glossary</h2>";
    
    // Loop through each layer checkbox in the layers popup
    const checkboxes = document.querySelectorAll('.layer-checkbox');
    checkboxes.forEach(cb => {
      const layer = cb.dataset.layer;  // e.g., "cone", "path", etc.
      if (cb.checked && glossaryTerms[layer]) {
        const data = glossaryTerms[layer];
        html += `<h3>${data.header}</h3>`;
        html += `<ul>`;
        data.terms.forEach(item => {
          html += `<li><strong>${item.term}:</strong> ${item.definition}</li>`;
        });
        html += `</ul>`;
      }
    });
    container.innerHTML = html;
  }
  
  

    var hurricane_path = await loadCSV("hurricane_michael_data.csv");
    console.log(hurricane_path.map(point => [point.time, point.lon, point.lat]));
    const usa = await fetch(
      "https://code.highcharts.com/mapdata/countries/us/us-all.topo.json",
    ).then((response) => response.json())

  Highcharts.setOptions({
    mapNavigation: {
      buttonOptions: {
        theme: {
          symbolStroke: '#ffffff', // this sets the + / - color
          symbolFill: '#ffffff',
          style: {
            color: '#ffffff'
          }
        }
      }
    }
  });

  const chart = Highcharts.mapChart("map-container", {
    chart: {
      reflow: false,  // Prevent resizing when popups show/hide
    },
    title: {
      text: "Hurricane Michael 2018",
    },
    exporting: {
      enabled: false // Disables exporting options, including the hamburger menu
    },

    legend: {
      align: "right",
      layout: "vertical",
      verticalAlign: "bottom",
      x: -20, // Adjust to left when popups are visible
      y: -20,
    },

    mapNavigation: {
      enabled: true,
      enableButtons: true,
      buttonOptions: {
        align: 'right',
        verticalAlign: 'bottom',
        x: -10,
        y: -10,
        theme: {
          fill: 'rgba(0,0,0,0.75)', // semi-transparent background
          stroke: 'rgba(0,0,0,0.75)',
          style: {
            color: '#ffffff', // bright white icon/text
            fontSize: '16px',
            fontWeight: 'bold'
          }
        }
      }
    },

      series: [
        // Base
        {
          name: "Base map",
          nullColor: "#acb",
          legendSymbolColor: "#acb",
          borderColor: "#888",
          mapData: usa,
        },
        // Coastline
        {
          name: "Hurricane Path",
          type: "mapline",
          lineWidth: 3,
          color: "#000000",
          legendSymbolColor: "#d22",
          data: [
            {
              geometry: {
                type: "LineString",
                coordinates: hurricane_path.map(point => [point.lon, point.lat]) 
              },
            },
          ],
        },
        // Markers
        {
          name: "Hurricane Path Markers",
          type: "mappoint",
          visible: false,
          dataLabels: {
            format: "{point.time}",
          }, 
          tooltip: {
            pointFormat: `
              <b>Classification:</b> {point.name}<br/>
              <b>Vmax:</b> {point.vmax} knots<br/>
              <b>MSLP:</b> {point.mslp} mb <br/>
            `
          },
          data: hurricane_path.map(point => {
            var symbol = 'circle';
            var color = '#FFFFFF'; // Default to white
        
            if (point.vmax >= 137) {
              symbol = 'pentagon';
              color = '#8B0000'; // Dark red
            } else if (point.vmax >= 113) {
              symbol = 'square';
              color = '#FF0000'; // Red
            } else if (point.vmax >= 96) {
              symbol = 'triangle';
              color = '#FFA500'; // Orange
            } else if (point.vmax >= 83) {
              symbol = 'circle';
              color = '#FFFF00'; // Yellow
            } else if (point.vmax >= 64) {
              symbol = 'circle';
              color = '#FFFFFF'; // White
            } else {
              symbol = 'circle'; // Not a hurricane
              color = '#888888'; // Optional: grey for non-hurricane
            }
        
            return {
              name: point.category,
              time: point.time,
              lat: point.lat,
              lon: point.lon,
              vmax: point.vmax,
              mslp: point.mslp,
              marker: {
                symbol: symbol,
                fillColor: color,
                lineColor: '#000000',
                lineWidth: 1,
                radius: 10
              }
            };
          }),
        },
        //Cone
        {
          name: "Cone of uncertainty",
          type: "map",
          color: '#ffafafa7',
          borderColor: '#f88',
          dashStyle: 'dot',
          data: [
            {
                // SVG path - using absolute SVG coordinate values (not lat/lon).
              /* 
                  You can also define map data here, using GeoJSON or TopoJSON,
                  which will let you use lat/lon coordinates. Beware that you also
                  then need to deal with map projections. GeoJSON must be
                  preprojected, while with TopoJSON you (probably) should copy the
                  projection information from the base map TopoJSON.
              */
                path: "M8,30L4,37L1,40L15,40L12,38L9,30Z"
            }
          ],
        },
      ],
    }
    
    );

    // hide the forecast path and risk markers so they don't appear on load.
    const forecastPathSeries = chart.series.find(s => s.name === "Hurricane Path");
    const riskMarkersSeries = chart.series.find(s => s.name === "Hurricane Path Markers");
    const coneSeries = chart.series.find(s => s.name === "Cone of uncertainty");


    if (forecastPathSeries) {
      forecastPathSeries.setVisible(false, false);
    }
    if (riskMarkersSeries) {
      riskMarkersSeries.setVisible(false, false);
    }
    if (coneSeries) {
      coneSeries.setVisible(false, false);
    }

    chart.redraw();



    //handle current user location marker
  document.getElementById("current-location").addEventListener("click", async () => {
    const userLocation = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        position => {
          const coords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
          };
          resolve(coords);
        },
        err => {
          console.error("Geolocation error:", err);
          resolve(null); // or reject(err);
        }
      );
    });
  
    if (userLocation) {
      console.log("User location:", userLocation);
  
      chart.addSeries({
        name: "Current User Location",
        type: "mappoint",
        color: "#0384fc",
        marker: {
          enabled: false
        },
        dataLabels: {
          enabled: true,
          useHTML: true,
          formatter: function () {
            return `<div class="pulse-marker"></div>`;
          }
        },
        keys: ["lat", "lon"],
        data: [
          [userLocation.lat, userLocation.lon],
        ],
      });
    } else {
      alert("Unable to retrieve your location.");
    }
  });
  
  //allow for map export
  $("#download_button").click(function(){
    chart.exportChartLocal({
        type: 'image/png',
        filename: 'chart_image'
    });

  });

  // Handle resizing the map manually when the window is resized
  window.addEventListener('resize', () => {
    const container = document.getElementById('map-container');
    const chart = Highcharts.charts[0]; // Get the current map chart instance
    chart.setSize(container.offsetWidth, container.offsetHeight, false); // Set the chart size manually
  });

  // Generic function to toggle buttons and popups
  function setupToggle(buttonId, popupId) {
    const button = document.getElementById(buttonId);
    const popup = document.getElementById(popupId);
    const closeBtn = popup.querySelector('.close-popup');

    button.addEventListener('click', () => {
      button.style.display = 'none';
      popup.style.display = 'block';
    });

    closeBtn.addEventListener('click', () => {
      popup.style.display = 'none';
      button.style.display = 'inline-block';
    });
  }

  // Setup for glossary, POI, and layers buttons
  setupToggle('glossary-button', 'glossary-popup');
  setupToggle('poi-button', 'poi-popup');
  setupToggle('layers-button', 'layers-popup');

    // Handle checkbox changes to show/hide popups based on layers
    document.querySelectorAll('.layer-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const layerName = e.target.dataset.layer;
        
        // Toggle the corresponding series:
        if (layerName === 'cone') {
          const coneSeries = chart.series.find(s => s.name === "Cone of uncertainty");
          if (coneSeries) {
            coneSeries.setVisible(e.target.checked, false);
            chart.redraw();
          }
        }
        if (layerName === 'path') {
          const forecastPathSeries = chart.series.find(s => s.name === "Hurricane Path");
          const riskMarkersSeries = chart.series.find(s => s.name === "Hurricane Path Markers");
          if (forecastPathSeries && riskMarkersSeries) {
            forecastPathSeries.setVisible(e.target.checked, false);
            riskMarkersSeries.setVisible(e.target.checked, false);
            chart.redraw();
          }
        }
        
        // Toggle any associated popup for non-cone layers (if applicable)
        const popup = document.getElementById(`popup-${layerName}`);
        if (popup) {
          popup.style.display = e.target.checked ? 'block' : 'none';
        }
        
        updatePopupPositions();
        updateGlossary();
      });
    });
    
    
    
    
    
    

    // Update popup positions
    function updatePopupPositions() {
      const visiblePopups = Array.from(document.querySelectorAll('.layer-popup'))
        .filter(popup => popup.style.display === 'block');
    
      const popupHeight = 100; // Adjust based on estimated popup height + margin
      visiblePopups.forEach((popup, index) => {
        popup.style.bottom = `${10 + (popupHeight + 10) * index}px`;
      });
    }
    

    // Add functionality for the POI address button
  document.getElementById('add-location').addEventListener('click', async () => {
    const addressInput = document.getElementById('location-input');
    const messageDiv = document.getElementById('message');
    const address = addressInput.value.trim();
    
    if (!address) {
      messageDiv.innerText = "Please enter a valid address.";
      return;
    }
    
    // Use OpenCage Geocoding API to convert the address to lat/lon
    // Replace 'YOUR_API_KEY' with your actual API key.
    try {
      const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=7f3db94804634683a492123ae49bad8b`);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        // Get the latitude and longitude from the first result
        const { lat, lng } = data.results[0].geometry;
        
        // Add a new marker to the map.
        // Here we assume that the "Markers" series is the third series in the chart (index 2).
        chart.series[2].addPoint({
          name: ' ', // you can change how the point is labeled
          lat: lat,
          lon: lng
        });
        
        messageDiv.innerText = `Marker added at (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        // Optionally clear the input after success:
        addressInput.value = "";
      } else {
        messageDiv.innerText = "Address not found. Please try again.";
      }
    } catch (error) {
      messageDiv.innerText = "An error occurred while geocoding.";
      console.error("Geocoding error:", error);
    }
  });
  


})();
