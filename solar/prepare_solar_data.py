"""Build a TimeXer-ready dataset for rooftop solar PV forecasting.

Pipeline: collect (PV + weather) -> clean -> align -> lead exogenous -> export CSV.

Sources
  PV (endogenous)    : inverter export CSV (--pv-csv) with columns [time, power_w].
                       Without it, PV is simulated with pvlib from the weather data.
  Weather (exogenous): Open-Meteo archive API (--source openmeteo, needs internet),
                       a CSV with columns [time, ghi, dni, dhi, cloud, temp, rh, wind]
                       (--source csv --weather-csv), or the TMY2 sample bundled with
                       pvlib (--source sample, offline).

Mock data: solar/make_mock_data.py writes solar/mock/{weather_hourly,inverter_5min}.csv;
run them through this script with
  python solar/prepare_solar_data.py --source csv --weather-csv solar/mock/weather_hourly.csv \
      --pv-csv solar/mock/inverter_5min.csv --lat 25.8 --lon -80.27 --tz Etc/GMT+5

Output: dataset/Solar/<name>.csv with columns
  date, ghi_lead, cloud_lead, temp_lead, rh_lead, wind_lead, OT
where OT is hourly PV energy (kWh) and *_lead are weather values shifted
--horizon hours ahead (stand-in for a weather forecast known at time t).

WARNING: with observed weather (sample/csv/openmeteo archive) the *_lead columns are an
oracle: the model sees the real future weather, which is not available at prediction time.
Scores measured this way are optimistic and a model trained this way over-trusts the
weather input (see solar/experiments/weather_leakage_check.py). For training/evaluation
the lead columns must be forecasts issued before t, e.g. Open-Meteo Previous Runs API
(*_previous_day1).
"""
import argparse
import json
import os

import numpy as np
import pandas as pd
import pvlib

WEATHER_COLS = ['ghi', 'cloud', 'temp', 'rh', 'wind']


# ---------------------------------------------------------------- 1. collect
def load_weather_sample():
    path = os.path.join(os.path.dirname(pvlib.__file__), 'data', '12839.tm2')
    df, meta = pvlib.iotools.read_tmy2(path)
    df = pd.DataFrame({
        'ghi': df['GHI'], 'dni': df['DNI'], 'dhi': df['DHI'],
        'cloud': df['TotCld'] * 10.0,  # tenths -> %
        'temp': df['DryBulb'] / 10.0, 'rh': df['RHum'], 'wind': df['Wspd'] / 10.0,  # 0.1 units
    })
    # TMY months come from different years; map onto one nominal year
    df.index = pd.date_range('2023-01-01 00:00', periods=len(df), freq='h')
    return df, meta['latitude'], meta['longitude'], 'Etc/GMT+5'


def load_weather_openmeteo(lat, lon, start, end, tz):
    import requests
    hourly = ['shortwave_radiation', 'direct_normal_irradiance', 'diffuse_radiation',
              'cloud_cover', 'temperature_2m', 'relative_humidity_2m', 'wind_speed_10m']
    r = requests.get('https://archive-api.open-meteo.com/v1/archive', params={
        'latitude': lat, 'longitude': lon, 'start_date': start, 'end_date': end,
        'hourly': ','.join(hourly), 'wind_speed_unit': 'ms', 'timezone': tz}, timeout=120)
    r.raise_for_status()
    h = r.json()['hourly']
    df = pd.DataFrame({
        'ghi': h['shortwave_radiation'], 'dni': h['direct_normal_irradiance'],
        'dhi': h['diffuse_radiation'], 'cloud': h['cloud_cover'],
        'temp': h['temperature_2m'], 'rh': h['relative_humidity_2m'], 'wind': h['wind_speed_10m'],
    }, index=pd.to_datetime(h['time']))
    return df, lat, lon, tz


def load_weather_csv(path):
    df = pd.read_csv(path, parse_dates=['time'], index_col='time')
    return df[['ghi', 'dni', 'dhi'] + [c for c in WEATHER_COLS if c != 'ghi']]


def simulate_pv(weather, lat, lon, tz, kwp, tilt, azimuth):
    """PVWatts system as a stand-in for real inverter data (5-min, W)."""
    times = weather.index.tz_localize(tz)
    loc = pvlib.location.Location(lat, lon, tz=tz)
    system = pvlib.pvsystem.PVSystem(
        surface_tilt=tilt, surface_azimuth=azimuth,
        module_parameters={'pdc0': kwp * 1000, 'gamma_pdc': -0.004},
        inverter_parameters={'pdc0': kwp * 1000 / 0.96},
        temperature_model_parameters=pvlib.temperature.TEMPERATURE_MODEL_PARAMETERS['sapm']['open_rack_glass_polymer'])
    mc = pvlib.modelchain.ModelChain(system, loc, aoi_model='physical', spectral_model='no_loss')
    w = weather.rename(columns={'temp': 'temp_air', 'wind': 'wind_speed'}).copy()
    w.index = times
    mc.run_model(w[['ghi', 'dni', 'dhi', 'temp_air', 'wind_speed']])
    ac = mc.results.ac.clip(lower=0).fillna(0) * 0.86  # 14% system losses
    ac.index = weather.index
    # hourly -> 5-min logger resolution, with small sensor noise
    rng = np.random.default_rng(0)
    idx = pd.date_range(ac.index[0], ac.index[-1] + pd.Timedelta('55min'), freq='5min')
    p = ac.reindex(idx).interpolate().ffill()
    p = p * (1 + rng.normal(0, 0.03, len(p)))
    return pd.DataFrame({'power_w': p.clip(lower=0).values}, index=idx)


def inject_faults(pv, kwp, seed=1):
    """Typical inverter-log defects, for demonstrating the cleaning step."""
    rng = np.random.default_rng(seed)
    pv = pv.copy()
    n = len(pv)
    log = {}
    # short dropouts (wifi loss): 40 gaps of 15 min - 2 h
    drop = np.zeros(n, bool)
    for s in rng.integers(0, n - 30, 40):
        drop[s:s + rng.integers(3, 25)] = True
    # long outages: 3 gaps of 1-3 days
    for s in rng.integers(0, n - 900, 3):
        drop[s:s + rng.integers(288, 864)] = True
    log['missing'] = int(drop.sum())
    # spikes
    spikes = rng.choice(n, 30, replace=False)
    pv.iloc[spikes, 0] = kwp * 1000 * rng.uniform(2, 5, 30)
    log['spikes'] = 30
    # frozen value (logger stuck) for 6 h
    s = int(rng.integers(0, n - 72))
    pv.iloc[s:s + 72, 0] = pv.iloc[s, 0]
    log['frozen'] = 72
    pv = pv[~drop]
    # duplicated timestamps
    dup = pv.sample(200, random_state=seed)
    log['duplicates'] = len(dup)
    pv = pd.concat([pv, dup]).sample(frac=1, random_state=seed)
    return pv, log


# ------------------------------------------------------------------ 2. clean
def clean_pv(pv, weather, lat, lon, tz, kwp):
    stats = {'raw_rows': len(pv)}
    pv = pv[~pv.index.duplicated(keep='first')].sort_index()
    stats['after_dedup'] = len(pv)

    p = pv['power_w']
    # physical range: 0 .. 1.2 x nameplate
    bad = (p < 0) | (p > 1.2 * kwp * 1000)
    # frozen logger: identical non-zero value for >= 1 h (12 samples)
    run = (p.diff() != 0).cumsum()
    frozen = (p > 0) & (p.groupby(run).transform('size') >= 12)
    stats['outliers_removed'] = int(bad.sum())
    stats['frozen_removed'] = int(frozen.sum())
    p = p.mask(bad | frozen)
    kept = p.copy()

    # 5-min W -> hourly kWh (need >= 50% coverage inside the hour)
    full = pd.date_range(weather.index[0], weather.index[-1] + pd.Timedelta('55min'), freq='5min')
    p = p.reindex(full)
    cov = p.notna().groupby(p.index.floor('h')).mean()
    e = (p.groupby(p.index.floor('h')).mean() / 1000).where(cov >= 0.5)
    e = e.reindex(weather.index)

    # night -> 0 (sun below horizon)
    sun = pvlib.solarposition.get_solarposition(weather.index.tz_localize(tz), lat, lon)
    night = (sun['apparent_elevation'] <= 0).values
    e[night] = 0.0
    stats['hours'] = len(e)
    stats['missing_hours'] = int(e.isna().sum())

    # gap <= 3 h: linear interpolation; longer: GHI-based regression
    e_short = e.interpolate(limit=3, limit_area='inside')
    stats['filled_interp'] = int(e.isna().sum() - e_short.isna().sum())
    ok = e_short.notna() & (weather['ghi'] > 0)
    k = np.linalg.lstsq(weather.loc[ok, ['ghi']].values, e_short[ok].values, rcond=None)[0][0]
    long_gap = e_short.isna()
    observed = e_short.copy()
    e_short[long_gap] = (k * weather.loc[long_gap, 'ghi']).clip(lower=0, upper=kwp)
    stats['filled_model'] = int(long_gap.sum())
    # intermediates, for plotting each step
    steps = {'kept_5min_w': kept, 'hourly_observed_kwh': observed}
    return e_short.rename('OT'), stats, steps


# ------------------------------------------------------- 3. align + export
def build_dataset(energy, weather, horizon):
    lead = weather[WEATHER_COLS].shift(-horizon).add_suffix('_lead')
    df = pd.concat([lead, energy], axis=1).iloc[:-horizon]
    df.index.name = 'date'
    return df.reset_index()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', choices=['sample', 'openmeteo', 'csv'], default='sample')
    ap.add_argument('--weather-csv', default=None, help='weather CSV for --source csv')
    ap.add_argument('--lat', type=float, default=10.82)   # Ho Chi Minh City
    ap.add_argument('--lon', type=float, default=106.63)
    ap.add_argument('--tz', default='Asia/Ho_Chi_Minh')
    ap.add_argument('--start', default='2023-01-01')
    ap.add_argument('--end', default='2024-12-31')
    ap.add_argument('--pv-csv', default=None, help='inverter export: time,power_w (W)')
    ap.add_argument('--kwp', type=float, default=5.0)
    ap.add_argument('--tilt', type=float, default=10)
    ap.add_argument('--azimuth', type=float, default=180)
    ap.add_argument('--horizon', type=int, default=24)
    ap.add_argument('--demo-faults', action='store_true', help='inject logger defects (demo only)')
    ap.add_argument('--out', default='./dataset/Solar/solar_demo.csv')
    args = ap.parse_args()

    if args.source == 'sample':
        weather, lat, lon, tz = load_weather_sample()
    elif args.source == 'csv':
        weather, lat, lon, tz = load_weather_csv(args.weather_csv), args.lat, args.lon, args.tz
    else:
        weather, lat, lon, tz = load_weather_openmeteo(args.lat, args.lon, args.start, args.end, args.tz)

    if args.pv_csv:
        pv = pd.read_csv(args.pv_csv, parse_dates=['time'], index_col='time')[['power_w']]
        log = {}
    else:
        pv = simulate_pv(weather, lat, lon, tz, args.kwp, args.tilt, args.azimuth)
        pv, log = inject_faults(pv, args.kwp) if args.demo_faults else (pv, {})

    energy, stats, _ = clean_pv(pv, weather, lat, lon, tz, args.kwp)
    df = build_dataset(energy, weather, args.horizon)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    df.to_csv(args.out, index=False, float_format='%.4f')
    print(f'saved {args.out}: {df.shape}')
    print(json.dumps({**log, **stats}, indent=1))


if __name__ == '__main__':
    main()
