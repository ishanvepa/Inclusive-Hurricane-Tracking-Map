;(async () => {
    const usa = await fetch(
      "https://code.highcharts.com/mapdata/countries/us/us-all.topo.json",
    ).then((response) => response.json())
  
    Highcharts.mapChart("container", {
      title: {
        text: "US hurricane map",
      },
  
      legend: {
        align: "right",
        layout: "vertical",
        verticalAlign: "bottom",
      },
      
      mapNavigation: {
          enabled: true
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
    })
  })()
  