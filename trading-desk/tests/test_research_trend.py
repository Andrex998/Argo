"""research/trend.py, exam E02: the signals and the figures it is judged on."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "research"))

import trend  # noqa: E402  research/trend.py


def bars(closes):
    return [
        {
            "day": f"d{i:04d}",
            "open": c,
            "high": c * 1.01,
            "low": c * 0.99,
            "close": c,
            "funding": [],
        }
        for i, c in enumerate(closes)
    ]


def test_t1_is_the_average_sign_of_five_lookbacks():
    rising = trend.signals(bars([100 + i for i in range(200)]))
    falling = trend.signals(bars([300 - i for i in range(200)]))
    assert rising["T1"][111] is None and rising["T1"][112] == 1.0
    assert falling["T1"][150] == -1.0


def test_t2_turns_on_above_the_channel_and_off_under_its_midpoint():
    closes = [100.0] * 200 + [130.0] * 5 + [95.0] * 5  # a breakout, then a fall under the middle
    sig = trend.signals(bars(closes))
    assert sig["T2"][199] == 0.0
    assert sig["T2"][200] == 1.0  # above every channel's top
    assert sig["T2"][204] == 1.0  # holds while above the midpoints
    assert sig["T2"][205] == 0.0  # 95 is under every midpoint


def test_figures_on_a_known_path():
    daily = {"2025-01-01": 0.10, "2025-01-02": -0.20, "2025-01-03": 0.05}
    f = trend.figures(daily, "2025-01-01", "2025-12-31")
    assert f["ret"] == pytest.approx((1.1 * 0.8 * 1.05 - 1) * 100, abs=0.1)
    assert f["dd"] == pytest.approx(20.0, abs=0.1)
