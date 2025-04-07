;(async () => {
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
          name: "Coastline",
          type: "mapline",
          lineWidth: 6,
          color: "#d22",
          legendSymbolColor: "#d22",
          data: [
            {
              geometry: {
                type: "LineString",
                coordinates: [
                  [-88.57, 30.34],
                  [-87.18, 30.37],
                  [-85.65, 30.12],
                ],
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
        // Cone
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
        updateUIForPopups(true); // Update the map UI when a popup is shown
      });

      closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
        button.style.display = 'inline-block';
        updateUIForPopups(false); // Update the map UI when a popup is closed
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

    // Adjust the legend and map navigation buttons when popups are visible
    function updateUIForPopups(isPopupVisible) {
      const chart = Highcharts.charts[0]; // Get the current map chart instance

      // Adjust the legend's position
      const legend = chart.legend;
      if (isPopupVisible) {
        legend.update({
          x: -250,  // Move legend to the left when popups are visible
        });

        // Adjust the map navigation buttons
        chart.update({
          mapNavigation: {
            buttonOptions: {
              x: -100,  // Shift the buttons left when popups are visible
            },
          },
        });
      } else {
        legend.update({
          x: -20, // Move legend back to its original position when no popups are visible
        });

        // Reset the map navigation buttons position
        chart.update({
          mapNavigation: {
            buttonOptions: {
              x: -10,  // Move buttons back to the original position
            },
          },
        });
      }
    }

})();
