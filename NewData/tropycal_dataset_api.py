import tropycal.tracks as tracks
import pandas as pd
import json
import os

def generate_topojson_cone(storm_name, year, output_folder="cones"):
    # Load dataset
    basin = tracks.TrackDataset(basin='north_atlantic', source='hurdat', include_btk=False)
    storm = basin.get_storm((storm_name.lower(), year))
    df = storm.to_dataframe()

    # Estimate cone width based on timestep (naive fixed radius for demo)
    cone_points = []
    cone_width_deg = 1.0  # about 60 nautical miles on either side

    # Left edge
    for _, row in df.iterrows():
        lat = row['lat']
        lon = row['lon']
        cone_points.append([lon - cone_width_deg, lat])

    # Right edge (reversed)
    for _, row in reversed(list(df.iterrows())):
        lat = row['lat']
        lon = row['lon']
        cone_points.append([lon + cone_width_deg, lat])

    # Close polygon
    cone_points.append(cone_points[0])

    # Prepare transform (TopoJSON requires scale + translate)
    lons = [pt[0] for pt in cone_points]
    lats = [pt[1] for pt in cone_points]
    min_lon, min_lat = min(lons), min(lats)
    max_lon, max_lat = max(lons), max(lats)

    scale_x = (max_lon - min_lon) / 1000 or 1e-6
    scale_y = (max_lat - min_lat) / 1000 or 1e-6

    transform = {
        "scale": [scale_x, scale_y],
        "translate": [min_lon, min_lat]
    }

    # Convert to integer grid coords
    def to_grid_coords(lon, lat):
        x = int(round((lon - min_lon) / scale_x))
        y = int(round((lat - min_lat) / scale_y))
        return x, y

    abs_coords = [to_grid_coords(lon, lat) for lon, lat in cone_points]

    # Convert to delta-encoded arc
    arc = []
    prev_x, prev_y = abs_coords[0]
    arc.append([prev_x, prev_y])
    for x, y in abs_coords[1:]:
        arc.append([x - prev_x, y - prev_y])
        prev_x, prev_y = x, y

    # Construct TopoJSON
    topojson = {
        "type": "Topology",
        "transform": transform,
        "arcs": [arc],
        "objects": {
            f"{storm.id}_cone": {
                "type": "GeometryCollection",
                "geometries": [{
                    "type": "Polygon",
                    "arcs": [[0]]
                }]
            }
        }
    }

    # Output
    os.makedirs(output_folder, exist_ok=True)
    filename = f"{output_folder}/{storm_name.lower()}_{year}_cone_topo.json"
    with open(filename, "w") as f:
        json.dump(topojson, f)

    print(f"Saved TopoJSON to: {filename}")

# Example:
generate_topojson_cone("katrina", 2005)
