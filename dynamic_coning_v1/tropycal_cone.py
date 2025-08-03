import pandas as pd
import geopandas as gpd
import requests
from shapely.geometry import Polygon
from pyproj import Geod
from datetime import datetime
import os
import requests
from bs4 import BeautifulSoup

# Initialize geodesic calculator
geod = Geod(ellps="WGS84")

# NHC forecast hour -> average error radius (km)
nhc_error_radii = {
    0: 0,
    12: 54,
    24: 96,
    36: 133,
    48: 170,
    72: 244,
    96: 315,
    120: 382,
}

def is_current_season(year):
    return year == datetime.utcnow().year

def download_realtime_track(storm_id):
    url = f"https://ftp.nhc.noaa.gov/atcf/btk/{storm_id}.dat"
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.text.strip().splitlines()
    except Exception as e:
        print(f"Failed to fetch real-time track data: {e}")
        return None

def parse_realtime_dat(lines):
    records = []
    for line in lines:
        parts = [x.strip() for x in line.split(',')]
        if len(parts) < 10:
            continue
        time = datetime.strptime(parts[2], "%Y%m%d%H")
        lat = float(parts[6][:-1]) * (1 if parts[6][-1] == 'N' else -1)
        lon = float(parts[7][:-1]) * (1 if parts[7][-1] == 'E' else -1)
        vmax = int(parts[8])
        mslp = int(parts[9]) if parts[9].isdigit() else 0
        records.append({
            'time': time,
            'lat': lat,
            'lon': lon,
            'vmax': vmax,
            'mslp': mslp,
            'category': categorize(vmax)
        })
    return pd.DataFrame(records)

def categorize(vmax):
    if vmax >= 137: return "Category 5"
    elif vmax >= 113: return "Category 4"
    elif vmax >= 96: return "Category 3"
    elif vmax >= 83: return "Category 2"
    elif vmax >= 64: return "Category 1"
    return "Tropical Storm/Depression"

def classify_storm_type(vmax):
    if vmax < 25:
        return "LO"
    elif vmax < 34:
        return "TD"
    elif vmax < 64:
        return "TS"
    elif vmax >= 64:
        return "HU"
    return ""


def build_cone_polygon(track_df):
    cone_coords = []
    for i, row in track_df.iterrows():
        forecast_hour = i * 6
        if forecast_hour not in nhc_error_radii:
            continue
        radius_km = nhc_error_radii[forecast_hour]
        circle_lons, circle_lats = geod.fwd(
            [row['lon']] * 360,
            [row['lat']] * 360,
            list(range(360)),
            [radius_km * 1000] * 360
        )[:2]
        coords = list(zip(circle_lons, circle_lats))
        cone_coords.extend(coords)

    if cone_coords:
        cone_polygon = Polygon(cone_coords).convex_hull
        return cone_polygon
    else:
        return None

def get_latest_hurdat_url():
    index_url = "https://www.nhc.noaa.gov/data/hurdat/"
    response = requests.get(index_url)
    soup = BeautifulSoup(response.text, "html.parser")
    for link in soup.find_all('a'):
        href = link.get('href')
        if href and "hurdat2-1851-2023" in href and href.endswith(".txt"):
            return "https://www.nhc.noaa.gov/data/hurdat/" + href
    raise ValueError("HURDAT2 file not found.")


def parse_hurdat2_storm(basin_code, storm_number, year):
    hurdat_url = get_latest_hurdat_url()
    response = requests.get(hurdat_url)
    response.raise_for_status()
    lines = response.text.strip().splitlines()

    target_id = f"{basin_code.upper()}{int(storm_number):02d}{year}"
    records = []
    storm_found = False

    for line in lines:
        if line.startswith(target_id):
            storm_found = True
            continue
        elif storm_found:
            if line.startswith("AL") or line.startswith("EP") or not line.strip():
                break  # End of storm block
            parts = line.split(",")
            timestamp = parts[0].strip() + parts[1].strip()  # "201810061800"
            time = datetime.strptime(timestamp, "%Y%m%d%H%M")

            lat = float(parts[4][:-1]) * (1 if parts[4][-1] == 'N' else -1)
            lon = float(parts[5][:-1]) * (1 if parts[5][-1] == 'E' else -1)
            vmax = int(parts[6])
            mslp = int(parts[7]) if parts[7].strip().isdigit() else 0
            records.append({
                'time': time,
                'lat': lat,
                'lon': lon,
                'vmax': vmax,
                'mslp': mslp,
                'category': categorize(vmax)
            })

    return pd.DataFrame(records)

def generate_storm_data(storm_id, year):
    """
    storm_id should be like "al14" for Michael (14th Atlantic storm of 2018)
    """
    base_dir = "data"
    os.makedirs(base_dir, exist_ok=True)
    storm_key = f"{storm_id}_{year}".lower()
    basin_code = storm_id[:2]
    storm_number = storm_id[2:]

    if is_current_season(year):
        lines = download_realtime_track(f"{storm_id}{year}")
        if lines:
            df = parse_realtime_dat(lines)
        else:
            print(f"No real-time data found for {storm_id}")
            return
    else:
        df = parse_hurdat2_storm(basin_code, storm_number, year)
        if df.empty:
            print(f"No historical data found for {storm_id} {year}")
            return

    # Save CSV
    csv_path = os.path.join(base_dir, f"{storm_key}.csv")
    df_to_save = df.copy()
    df_to_save['time'] = df_to_save['time'].dt.strftime("%Y-%m-%d %H:%M:%S")
    df_to_save['extra_obs'] = ""
    df_to_save['special'] = ""
    df_to_save['type'] = df_to_save['vmax'].apply(classify_storm_type)
    df_to_save['wmo_basin'] = "north_atlantic"

    # Optional landfall marker
    if storm_id == "al14" and year == 2018:
        df_to_save.loc[df_to_save['time'] == "2018-10-10 17:30:00", 'special'] = "L"
        df_to_save.loc[df_to_save['time'] == "2018-10-10 17:30:00", 'extra_obs'] = 1

    df_to_save = df_to_save[["time", "extra_obs", "special", "type", "lat", "lon", "vmax", "mslp", "wmo_basin"]]
    df_to_save.to_csv(csv_path, index=False)

    # Generate cone
    cone_poly = build_cone_polygon(df)
    if cone_poly:
        gdf = gpd.GeoDataFrame(geometry=[cone_poly], crs="EPSG:4326")
        geojson_path = os.path.join(base_dir, f"{storm_key}.json")
        gdf.to_file(geojson_path, driver="GeoJSON")
        print(f"✅ Saved track to {csv_path} and cone to {geojson_path}")
    else:
        print("⚠️ Cone generation failed or not enough data.")

# 🔁 Example use:
generate_storm_data("al14", 2018)  # Hurricane Michael (historical)
