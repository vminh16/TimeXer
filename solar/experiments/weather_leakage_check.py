"""Does feeding "future weather" leak, and what happens when the weather forecast is wrong?

Day-ahead setup: at 00:00 of day d, predict the 24 hourly PV values of day d from
  - past PV: the previous 7 days (daily totals) + the previous day (hourly), and optionally
  - weather for the 24 target hours (GHI, cloud), taken either from
      * "actual"   : the observed weather (what dataset/Solar/solar_demo.csv uses today), or
      * "forecast" : a day-ahead forecast issued before 00:00 (here: synthetic, see make_forecast).
A ridge regression (24 outputs) stands in for TimeXer: the point is the data design, not the model.

Train on the first 70% of days, test on the last 30% (time order kept).
Data: the mock year in solar/mock. The forecast errors are synthetic; with real data, use
archived forecasts issued >= 24 h before the target hour (e.g. Open-Meteo Previous Runs API,
variables *_previous_day1).
"""
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from prepare_solar_data import clean_pv, load_weather_csv  # noqa: E402

MOCK = os.path.join(os.path.dirname(HERE), 'mock')


def make_forecast(w, sigma_day, seed=0):
    """Synthetic day-ahead forecast: a per-day multiplicative GHI error (whole day too
    sunny / too cloudy) plus smooth hourly error, capped by the clear-sky envelope."""
    rng = np.random.default_rng(seed)
    days = w.index.normalize()
    e_day = pd.Series(rng.normal(0, sigma_day, days.nunique()), index=days.unique()).reindex(days).values
    e_hour = pd.Series(rng.normal(0, sigma_day * 0.6, len(w))).rolling(3, min_periods=1, center=True).mean().values
    envelope = w['ghi'].groupby([w.index.month, w.index.hour]).transform('max').values
    f = w.copy()
    f['ghi'] = np.clip(w['ghi'].values * (1 + e_day + e_hour), 0, envelope)
    f['cloud'] = np.clip(w['cloud'].values - 60 * e_day + rng.normal(0, 10, len(w)), 0, 100)
    return f


def build(energy, weather_by_role):
    """One sample per day. weather_by_role: None (no future weather) or a weather frame."""
    E = energy.values.reshape(-1, 24)                      # (days, 24)
    X, Y = [], []
    for d in range(7, len(E)):
        feats = [E[d - 1], E[d - 7:d].sum(1)]
        if weather_by_role is not None:
            W = weather_by_role
            feats += [W['ghi'].values.reshape(-1, 24)[d] / 1000, W['cloud'].values.reshape(-1, 24)[d] / 100]
        X.append(np.concatenate(feats))
        Y.append(E[d])
    return np.array(X), np.array(Y)


def ridge_fit(X, Y, lam=1.0):
    mu, sd = X.mean(0), X.std(0) + 1e-9
    Z = np.c_[(X - mu) / sd, np.ones(len(X))]
    A = Z.T @ Z + lam * np.eye(Z.shape[1])
    A[-1, -1] -= lam                                       # no penalty on the intercept
    return mu, sd, np.linalg.solve(A, Z.T @ Y)


def ridge_predict(model, X):
    mu, sd, B = model
    return np.clip(np.c_[(X - mu) / sd, np.ones(len(X))] @ B, 0, None)


def scores(P, Y):
    day = Y.sum(1)
    err = (P - Y)[Y > 0]
    return {'MAE kWh/h (ban ngày)': np.abs(err).mean(), 'RMSE kWh/h (ban ngày)': np.sqrt((err ** 2).mean()),
            'Sai số tổng ngày %': 100 * np.abs(P.sum(1) - day).mean() / day.mean()}


def main():
    site = __import__('json').load(open(os.path.join(MOCK, 'site.json')))
    w = load_weather_csv(os.path.join(MOCK, 'weather_hourly.csv'))
    raw = pd.read_csv(os.path.join(MOCK, 'inverter_5min.csv'), parse_dates=['time'], index_col='time')
    energy, _, _ = clean_pv(raw, w, site['lat'], site['lon'], site['tz'], site['kwp'])

    n_days = len(energy) // 24 - 7
    split = int(n_days * 0.7)
    tr, te = slice(0, split), slice(split, None)
    rows = []

    def fit_score(train_w, test_w):
        Xtr, Ytr = build(energy, train_w)
        Xte, Yte = build(energy, test_w)
        return scores(ridge_predict(ridge_fit(Xtr[tr], Ytr[tr]), Xte[te]), Yte[te])

    def avg(dicts):
        return {k: np.mean([d[k] for d in dicts]) for k in dicts[0]}

    SEEDS = range(20)   # forecast errors are random: average over 20 draws
    X, Y = build(energy, None)
    rows.append({'Thiết lập': 'P. Ngày mai = hôm nay', **scores(X[te][:, :24], Y[te])})
    rows.append({'Thiết lập': 'A. Không dùng thời tiết tương lai', **fit_score(None, None)})
    rows.append({'Thiết lập': 'B. Train thực đo, test thực đo (oracle)', **fit_score(w, w)})
    fcs = [make_forecast(w, 0.25, seed) for seed in SEEDS]
    rows.append({'Thiết lập': 'C. Train thực đo, test dự báo (lệch train/serve)', **avg([fit_score(w, f) for f in fcs])})
    rows.append({'Thiết lập': 'D. Train dự báo, test dự báo (đúng)', **avg([fit_score(f, f) for f in fcs])})
    print('Dự báo thời tiết giả lập: sigma = 0.25, trung bình 20 lần sinh nhiễu')
    print(pd.DataFrame(rows).set_index('Thiết lập').round(3).to_string())

    # how bad can the forecast get before it stops helping?
    print('\nRMSE kWh/h ban ngày theo độ sai của dự báo thời tiết (A, không dùng thời tiết: %.3f):'
          % rows[1]['RMSE kWh/h (ban ngày)'])
    out = []
    for sg in [0.1, 0.25, 0.5, 1.0]:
        fcs = [make_forecast(w, sg, seed) for seed in SEEDS]
        nrmse = np.mean([np.sqrt(((f['ghi'] - w['ghi']) ** 2)[w['ghi'] > 0].mean()) / w['ghi'][w['ghi'] > 0].mean() for f in fcs])
        out.append({'sigma': sg, 'nRMSE bức xạ dự báo %': 100 * nrmse,
                    'C (train thực đo)': avg([fit_score(w, f) for f in fcs])['RMSE kWh/h (ban ngày)'],
                    'D (train dự báo)': avg([fit_score(f, f) for f in fcs])['RMSE kWh/h (ban ngày)']})
    print(pd.DataFrame(out).set_index('sigma').round(3).to_string())


if __name__ == '__main__':
    main()
