"""The Python port must score exactly like the original ARGO // RADAR engine.

`radar_reference.json` holds twelve inputs, shaped like DexScreener and RugCheck
responses, with the results the original JavaScript engine produced for them.
"""

import json
from pathlib import Path

import pytest

from desk import radar

REFERENCE = json.loads((Path(__file__).parent / "radar_reference.json").read_text())
NOW_MS = REFERENCE["now_ms"]
PAIR = REFERENCE["cases"]["demo_full"]["input"]["pair"]
RUG = REFERENCE["cases"]["demo_full"]["input"]["rug"]
SOLANA = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"


def manual_from(case: dict) -> radar.Manual:
    social = case["social"]
    return radar.Manual(
        holder_growth=case["holderGrowth"],
        account=social["account"],
        kol=social["kol"],
        velocity=social["vel"],
        catalyst=social["cat"],
    )


@pytest.mark.parametrize("name", REFERENCE["cases"])
def test_port_matches_the_original_engine(name):
    expected = REFERENCE["cases"][name]
    case = expected["input"]
    report = radar.score(case["pair"], case["rug"], NOW_MS, manual_from(case))

    assert report.total == expected["total"]
    assert report.coverage == expected["coverage"]
    assert report.gate == expected["gate"]
    assert report.cap == expected["cap"]
    assert report.tier == expected["tier"]
    assert report.traps == expected["traps"]
    points = {item.key: item.points if item.verified else None for item in report.items}
    assert points == expected["points"]


def test_unverified_data_scores_zero_and_is_shown_as_missing():
    report = radar.score(PAIR, RUG, NOW_MS)
    social = [item for item in report.items if item.key.startswith("s")]
    assert len(social) == 4
    assert all(not item.verified and item.points == 0 and item.value == "—" for item in social)
    assert report.coverage == 56  # 36 on-chain + 20 security; holder growth and social are manual


def test_chain_detection():
    assert radar.chain_of(SOLANA) == "solana"
    assert radar.chain_of("0x" + "ab" * 20) == "evm"
    assert radar.chain_of("not-an-address") is None
    assert radar.chain_of("0x1234") is None


def test_junk_in_a_security_report_is_not_trusted():
    rug = {"token": {}, "markets": [{"lp": {"lpLockedPct": "n/a"}}], "topHolders": "none"}
    assert radar.security_from(rug).unknown
    assert radar.security_from(None).unknown
    assert radar.security_from({"markets": [{"lp": {"lpLocked": "72.5"}}]}).lp_locked == 72.5


def test_scan_scores_the_most_liquid_pair(monkeypatch):
    thin = {**PAIR, "liquidity": {"usd": 900}, "baseToken": {"name": "Thin", "symbol": "THIN"}}
    replies = {"dexscreener": {"pairs": [thin, PAIR]}, "rugcheck": RUG}
    monkeypatch.setattr(radar, "_get", lambda url: replies[url.split(".")[1]])
    report = radar.scan(SOLANA, NOW_MS)
    assert report.symbol == "DEMO"
    assert report.total == REFERENCE["cases"]["demo_auto_only"]["total"]


def test_scan_without_rugcheck_is_capped(monkeypatch):
    def get(url):
        if "rugcheck" in url:
            raise radar.RadarError("api.rugcheck.xyz non raggiungibile")
        return {"pairs": [PAIR]}

    monkeypatch.setattr(radar, "_get", get)
    report = radar.scan(SOLANA, NOW_MS, radar.Manual(40, "solid", "top", "high", "yes"))
    assert report.cap == radar.UNVERIFIED_CAP
    assert report.total == 49


def test_evm_tokens_skip_rugcheck(monkeypatch):
    asked = []
    monkeypatch.setattr(radar, "_get", lambda url: asked.append(url) or {"pairs": [PAIR]})
    report = radar.scan("0x" + "ab" * 20, NOW_MS)
    assert len(asked) == 1 and "dexscreener" in asked[0]
    assert report.cap == radar.UNVERIFIED_CAP


def test_scan_errors(monkeypatch):
    with pytest.raises(radar.RadarError, match="non valido"):
        radar.scan("hello", NOW_MS)
    monkeypatch.setattr(radar, "_get", lambda url: {"pairs": None})
    with pytest.raises(radar.RadarError, match="nessuna pair"):
        radar.scan(SOLANA, NOW_MS)


def test_the_pool_itself_is_not_counted_as_a_whale():
    # A bonding curve holding 60% of supply, then ten ordinary wallets with 2% each.
    holders = [{"pct": 60.0, "owner": "Pool"}] + [{"pct": 2.0, "owner": f"W{i}"} for i in range(10)]
    rug = {**RUG, "topHolders": holders}
    assert radar.security_from(rug).top10 == 78.0  # read naively, the gate fails
    assert radar.score(PAIR, rug, NOW_MS).gate

    rug["knownAccounts"] = {"Pool": {"name": "Pump Fun", "type": "AMM"}}
    assert radar.security_from(rug).top10 == 20.0
    assert not radar.score(PAIR, rug, NOW_MS).gate


def test_lockers_and_creators_still_count_as_holders():
    holders = [{"pct": 45.0, "owner": "Team"}, {"pct": 5.0, "owner": "Dev"}]
    known = {"Team": {"type": "LOCKER"}, "Dev": {"type": "CREATOR"}}
    assert radar.security_from({"topHolders": holders, "knownAccounts": known}).top10 == 50.0
