import tropycal.tracks as tracks
import datetime as dt
import pandas as pd

basin = tracks.TrackDataset(basin='north_atlantic',source='hurdat',include_btk=False)

storm = basin.get_storm(('michael',2018))

df = storm.to_dataframe()

df.to_csv("hurricane_michael_data.csv", index=False)