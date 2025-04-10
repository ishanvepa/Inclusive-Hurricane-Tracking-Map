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
    res.push({
      time: cols[1],
      lat: parseFloat(cols[5]),
      lon: parseFloat(cols[6]),
      vmax: parseInt(cols[7]),
      mslp: parseInt(cols[8]),
    });
  }
  return res;
}

;(async () => {
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
        text: "US hurricane map",
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
          name: "Markers",
          type: "mappoint",
          color: "#000",
          marker: {
            symbol: "mapmarker",
            radius: 6
          },
          dataLabels: {
            format: "{point.name}",
          },
          keys: ["name", "lat", "lon"],
          data: [
            ["Tues 10:00am", 24.34, -87.57],
            ["H", 28.0, -88.07],
          ],
        },
        {
          name: "Hurricane Path Markers",
          type: "mappoint",
          color: "#FF0000",
          marker: {
            symbol: "mapmarker",
            radius: 6
          },
          dataLabels: {
            format: "{point.name}",
          },
          keys: ["name", "lat", "lon"],
          data: hurricane_path.map(point => [point.time, point.lon, point.lat]), //not working
          // [
          //   ["Tues 10:00am", 24.34, -87.57],
          //   ["H", 28.0, -88.07],
          // ],
        },
        // Cone
        // {
        //   name: "Cone of uncertainty",
        //   type: "map",
        //   color: '#ffafafa7',
        //   borderColor: '#f88',
        //   dashStyle: 'dot',
        //   data: [
        //     {
        //         // SVG path - using absolute SVG coordinate values (not lat/lon).
        //       /* 
        //           You can also define map data here, using GeoJSON or TopoJSON,
        //           which will let you use lat/lon coordinates. Beware that you also
        //           then need to deal with map projections. GeoJSON must be
        //           preprojected, while with TopoJSON you (probably) should copy the
        //           projection information from the base map TopoJSON.
        //       */
        //         path: "M8,30L4,37L1,40L15,40L12,38L9,30Z"
        //     }
        //   ],
        // },
      ],
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
        const popup = document.getElementById(`popup-${layerName}`);
        if (e.target.checked) {
          popup.style.display = 'block';
        } else {
          popup.style.display = 'none';
        }
        updatePopupPositions();
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
