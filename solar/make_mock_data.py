"""Write mock raw data in the same shape as the real sources.

  solar/mock/weather_hourly.csv : time, ghi, dni, dhi, cloud, temp, rh, wind   (hourly)
  solar/mock/inverter_5min.csv  : time, power_w                               (5-min log)

Weather is the TMY2 typical year for Miami (NREL, bundled with pvlib; tropical climate,
dates mapped to a nominal 2023, local time UTC-5). PV is a simulated 5 kWp rooftop system
with injected logger defects (dropouts, multi-day outages, spikes, a frozen value,
duplicated rows), so the cleaning step has something to do.
"""
import json
import os

from prepare_solar_data import inject_faults, load_weather_sample, simulate_pv

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mock')
KWP, TILT, AZIMUTH = 5.0, 10, 180

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    weather, lat, lon, tz = load_weather_sample()
    pv = simulate_pv(weather, lat, lon, tz, KWP, TILT, AZIMUTH)
    raw, log = inject_faults(pv, KWP)
    raw = raw.sort_index(kind='stable')

    weather.round(2).to_csv(os.path.join(OUT, 'weather_hourly.csv'), index_label='time')
    raw.round(1).to_csv(os.path.join(OUT, 'inverter_5min.csv'), index_label='time')
    with open(os.path.join(OUT, 'site.json'), 'w') as f:
        json.dump({'lat': lat, 'lon': lon, 'tz': tz, 'kwp': KWP, 'tilt': TILT, 'azimuth': AZIMUTH,
                   'injected_faults': log}, f, indent=1)
    print(f'weather: {len(weather)} rows, inverter: {len(raw)} rows, faults: {log}')
