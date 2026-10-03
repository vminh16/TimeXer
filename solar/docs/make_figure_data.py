"""Run the mock data through the pipeline and dump the series plotted in the slides.

  python solar/make_mock_data.py
  python solar/docs/make_figure_data.py          -> solar/docs/fig_data.json
  cd solar/docs && npm install && node build_deck.js
"""
import json
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from prepare_solar_data import WEATHER_COLS, clean_pv, load_weather_csv  # noqa: E402

MOCK = os.path.join(os.path.dirname(HERE), 'mock')


def L(s, nd=3):
    return [None if pd.isna(v) else round(float(v), nd) for v in s]


def norm(s):
    return (s - s.min()) / (s.max() - s.min())


def main():
    site = json.load(open(os.path.join(MOCK, 'site.json')))
    weather = load_weather_csv(os.path.join(MOCK, 'weather_hourly.csv'))
    raw = pd.read_csv(os.path.join(MOCK, 'inverter_5min.csv'), parse_dates=['time'], index_col='time')
    energy, stats, steps = clean_pv(raw, weather, site['lat'], site['lon'], site['tz'], site['kwp'])

    full5 = pd.date_range(weather.index[0], weather.index[-1] + pd.Timedelta('55min'), freq='5min')
    raw5 = raw[~raw.index.duplicated()]['power_w'].reindex(full5) / 1000   # kW, gaps = NaN
    kept5 = steps['kept_5min_w'].reindex(full5) / 1000
    lead = weather[WEATHER_COLS].shift(-24)
    o = {'stats': stats, 'faults': site['injected_faults']}

    # (a) cleaning: 3 days of the 5-min log
    a = slice('2023-02-21', '2023-02-23 23:55')
    removed = raw5[a].notna() & kept5[a].isna()
    near = removed | removed.shift(1, fill_value=False) | removed.shift(-1, fill_value=False)
    o['a'] = {'x': L(np.arange(len(raw5[a])) / 288), 'kept': L(kept5[a]), 'removed': L(raw5[a].where(near))}
    # (b) hourly + gap fill: 7 days around a multi-day outage
    b = slice('2023-06-13', '2023-06-19 23:00')
    obs, fin = steps['hourly_observed_kwh'][b], energy[b]
    gap = obs.isna().values
    edge = gap | np.r_[gap[1:], False] | np.r_[False, gap[:-1]]   # connect estimate to observed line
    o['b'] = {'x': L(np.arange(len(obs)) / 24), 'obs': L(obs), 'fill': L(fin.where(edge))}
    # (c) +24 h lead: original vs shifted irradiance, cloudy days 18-19/03
    c = slice('2023-03-16', '2023-03-19 23:00')
    o['c'] = {'x': L(np.arange(len(weather['ghi'][c])) / 24), 'ghi': L(weather['ghi'][c], 0), 'lead': L(lead['ghi'][c], 0)}
    # (d) one training sample: 168 h input + 24 h target
    d = slice('2023-03-13', '2023-03-20 23:00')
    o['d'] = {'x': list(range(-168, 24)), 'pv': L(energy[d])}

    # slide 1 sparklines (normalised where several variables share a box)
    h3 = slice('2023-02-21', '2023-02-23 23:00')
    o['s1'] = {
        'raw5': L(raw5[a], 2), 'kept5': L(kept5[a], 2), 'hourly3': L(energy[h3], 2),
        'w': {k: L(norm(weather[k])[h3], 2) for k in WEATHER_COLS},
        'ghi_orig': L(weather['ghi'][c] / 1000, 2), 'ghi_lead': L(lead['ghi'][c] / 1000, 2),
        'stack': [L(norm(energy)[d] * 0.8 + 5, 2)] + [L(norm(lead[k])[d] * 0.8 + (4 - i), 2) for i, k in enumerate(WEATHER_COLS)],
        'forecast': L(energy[d][-24:], 2),
    }
    with open(os.path.join(HERE, 'fig_data.json'), 'w') as f:
        json.dump(o, f)
    print('stats', stats)
    print('panel b missing hours', int(gap.sum()))


if __name__ == '__main__':
    main()
