"""Radar: risk score for a DEX token, ported from the ARGO // RADAR screener.

The one rule of the original carries over unchanged: data that is missing is
never guessed. It scores zero and is reported as not verified.

Weights are 40 on-chain, 20 security, 40 social. The social checks and holder
growth cannot be read from an API, so a scan with no `Manual` input tops out at
56 points. A failed security gate caps the score at 15 whatever the hype.

Scoring matches the original engine (see tests/radar_reference.json) with one
deliberate difference: the liquidity pool's own token account is not counted
among the top holders. On a fresh launch the pool or bonding curve holds a large
share of the supply, and reading it as a whale failed the gate on most new tokens.
"""

from __future__ import annotations

import json
import math
import re
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from urllib.parse import urlsplit

DEXSCREENER = "https://api.dexscreener.com/latest/dex/tokens/{address}"
RUGCHECK = "https://api.rugcheck.xyz/v1/tokens/{address}/report"
TIMEOUT = 9  # seconds

GATE_CAP = 15  # score ceiling when the contract can rug
UNVERIFIED_CAP = 49  # score ceiling when no security data exists at all

ACCOUNT_POINTS = {"none": 0, "fresh": 3, "solid": 8}
KOL_POINTS = {"none": 0, "micro": 5, "mid": 8, "top": 12}
VELOCITY_POINTS = {"low": 2, "med": 6, "high": 10}


class RadarError(Exception):
    """The token could not be scanned."""


@dataclass(frozen=True, slots=True)
class Item:
    key: str
    label: str
    value: str
    points: int
    max: int
    verified: bool
    flag: str = ""


@dataclass(frozen=True, slots=True)
class Manual:
    """Checks that only a person can make. An empty field is not verified and scores zero."""

    holder_growth: float | None = None  # % change in holders over the last hour
    account: str = ""  # none | fresh | solid
    kol: str = ""  # none | micro | mid | top
    velocity: str = ""  # low | med | high
    catalyst: str = ""  # no | yes


@dataclass(slots=True)
class Security:
    mint_ok: bool | None = None  # None: not verified
    freeze_ok: bool | None = None
    lp_locked: float | None = None  # % of the pool's LP locked or burned
    top10: float | None = None  # % of supply in the ten largest wallets
    risks: list[str] = field(default_factory=list)

    @property
    def unknown(self) -> bool:
        return (self.mint_ok, self.freeze_ok, self.lp_locked, self.top10) == (None,) * 4

    @property
    def gate_failed(self) -> bool:
        return (
            self.mint_ok is False
            or self.freeze_ok is False
            or (self.lp_locked is not None and self.lp_locked < 50)
            or (self.top10 is not None and self.top10 > 40)
        )


@dataclass(slots=True)
class Report:
    name: str
    symbol: str
    chain: str
    price: float | None
    market_cap: float | None
    liquidity: float | None
    items: list[Item]
    total: int
    coverage: int  # share of the 100 points backed by verified data
    gate: bool
    cap: int | None
    tier: str
    traps: list[str]


def chain_of(address: str) -> str | None:
    if re.fullmatch(r"0x[a-fA-F0-9]{40}", address):
        return "evm"
    if re.fullmatch(r"[1-9A-HJ-NP-Za-km-z]{32,44}", address):
        return "solana"
    return None


def security_from(rug: dict | None) -> Security:
    """Read a RugCheck report. Any field it does not carry stays not verified."""
    sec = Security()
    if not rug:
        return sec
    token = rug.get("token") or {}
    if "mintAuthority" in token:
        sec.mint_ok = not token["mintAuthority"]
    if "freezeAuthority" in token:
        sec.freeze_ok = not token["freezeAuthority"]
    markets = rug.get("markets") or [{}]
    lp = (markets[0] or {}).get("lp") or {}
    locked = lp.get("lpLockedPct")
    if locked is None:
        locked = lp.get("lpLocked")
    if _is_number(locked):
        sec.lp_locked = float(locked)
    holders = rug.get("topHolders")
    if isinstance(holders, list) and holders:
        known = rug.get("knownAccounts") or {}
        wallets = [h for h in holders if not _is_pool(h, known)]
        sec.top10 = sum(_number(h.get("pct")) or 0.0 for h in wallets[:10])
    for risk in rug.get("risks") or []:
        if str(risk.get("level", "")).lower() in ("danger", "warn") and risk.get("name"):
            sec.risks.append(risk["name"])
    return sec


def score(pair: dict, rug: dict | None, now_ms: float, manual: Manual | None = None) -> Report:
    """Score one DexScreener pair with its RugCheck report, if there is one."""
    manual = manual or Manual()
    market_cap = _number(pair.get("marketCap")) or _number(pair.get("fdv")) or None
    liquidity = _number((pair.get("liquidity") or {}).get("usd")) or None
    volume = pair.get("volume") or {}
    change = pair.get("priceChange") or {}
    trades = (pair.get("txns") or {}).get("h1") or {}
    created = pair.get("pairCreatedAt")
    age_h = (now_ms - created) / 3_600_000 if created else None
    items: list[Item] = []

    def add(key, label, value, max_, points, verified, flag=""):
        shown = value if verified else "—"
        items.append(Item(key, label, shown, points if verified else 0, max_, verified, flag))

    # --- on-chain: 40 points ----------------------------------------------------
    vol_1h = _number(volume.get("h1"))
    known = bool(market_cap) and vol_1h is not None
    ratio = vol_1h / market_cap if known else 0.0
    points = (
        10 if ratio >= 0.5 else 7 if ratio >= 0.2 else 4 if ratio >= 0.05 else 1 if ratio > 0 else 0
    )
    flag = "volume anemico vs mcap" if known and ratio < 0.05 else ""
    add("volm", "Volume 1h / market cap", f"{ratio:.0%}", 10, points, known, flag)

    known = bool(market_cap) and liquidity is not None
    ratio = liquidity / market_cap if known else 0.0
    if 0.05 <= ratio <= 0.5:
        points, flag = 8, ""
    elif ratio >= 0.02:
        points, flag = 4, ""
    else:
        points, flag = 1, "liquidità sottile: uscita = slippage"
    add("liq", "Liquidità / market cap", f"{ratio:.1%}", 8, points, known, flag if known else "")

    buys, sells = _number(trades.get("buys")) or 0, _number(trades.get("sells")) or 0
    known = buys + sells > 0
    buy_share = buys / (buys + sells) if known else 0.0
    points = 7 if buy_share >= 0.6 else 4 if buy_share >= 0.5 else 2 if buy_share >= 0.4 else 0
    flag = "pressione di vendita dominante (1h)" if known and buy_share < 0.4 else ""
    add("bp", "Pressione in acquisto 1h", f"{buy_share:.0%} buy", 7, points, known, flag)

    m5, h1 = _number(change.get("m5")), _number(change.get("h1"))
    known = m5 is not None or h1 is not None
    points = 7 if (m5 or 0) > 0 and (h1 or 0) > 0 else 4 if (h1 or 0) > 0 else 0
    add("mom", "Momentum (5m · 1h)", f"{_pct(m5)} · {_pct(h1)}", 7, points, known)

    known, points, flag = age_h is not None, 0, ""
    if known:
        vol_24h = _number(volume.get("h24"))
        if age_h < 1:
            flag = "ultra-early (<1h): varianza massima, sniper in vantaggio"
        elif age_h <= 72:
            points = 4
        elif age_h <= 168:
            points = 2
        elif market_cap and vol_24h is not None and vol_24h / market_cap < 0.05:
            flag = "vecchio e senza trazione"
    add("age", "Età della pair", _age(age_h), 4, points, known, flag)

    growth = manual.holder_growth
    known = growth is not None
    points = (4 if growth >= 30 else 2 if growth >= 10 else 0) if known else 0
    flag = "holder in calo: distribuzione in corso" if known and growth < 0 else ""
    add("hold", "Crescita holder 1h", _pct(growth), 4, points, known, flag)

    # --- security: 20 points ----------------------------------------------------
    sec = security_from(rug)
    add(
        "mint",
        "Mint authority",
        "rinunciata" if sec.mint_ok else "ATTIVA",
        5,
        5 if sec.mint_ok else 0,
        sec.mint_ok is not None,
        "il dev può stampare supply" if sec.mint_ok is False else "",
    )
    add(
        "freeze",
        "Freeze authority",
        "disabilitata" if sec.freeze_ok else "ATTIVA",
        5,
        5 if sec.freeze_ok else 0,
        sec.freeze_ok is not None,
        "i wallet possono essere congelati" if sec.freeze_ok is False else "",
    )
    known, lp = sec.lp_locked is not None, sec.lp_locked or 0.0
    points = 5 if lp >= 80 else 2 if lp >= 50 else 0
    flag = "LP non bloccata: rug a un click" if known and lp < 50 else ""
    add("lp", "LP bloccata / bruciata", f"{lp:.0f}%", 5, points, known, flag)

    known, top = sec.top10 is not None, sec.top10 or 0.0
    points = 5 if top < 15 else 2 if top <= 30 else 0
    flag = f"top 10 wallet: {top:.0f}% della supply" if known and top > 30 else ""
    add("top10", "Supply nei top 10 wallet", f"{top:.1f}%", 5, points, known, flag)

    # --- social: 40 points, never automatic ---------------------------------------
    add(
        "sacc",
        "Account X dev/token",
        manual.account,
        8,
        ACCOUNT_POINTS.get(manual.account, 0),
        manual.account in ACCOUNT_POINTS,
        "nessuna identità social dietro il token" if manual.account == "none" else "",
    )
    add(
        "skol",
        "Menzioni KOL (3h)",
        manual.kol,
        12,
        KOL_POINTS.get(manual.kol, 0),
        manual.kol in KOL_POINTS,
    )
    add(
        "svel",
        "Velocity menzioni",
        manual.velocity,
        10,
        VELOCITY_POINTS.get(manual.velocity, 0),
        manual.velocity in VELOCITY_POINTS,
    )
    add(
        "scat",
        "Catalizzatore reale",
        manual.catalyst,
        10,
        10 if manual.catalyst == "yes" else 0,
        manual.catalyst in ("yes", "no"),
    )

    # --- verdict --------------------------------------------------------------------
    total = sum(item.points for item in items)
    cap = GATE_CAP if sec.gate_failed else UNVERIFIED_CAP if sec.unknown else None
    if cap is not None:
        total = min(total, cap)
    if sec.gate_failed:
        tier = "EVITARE"
    elif total < 40:
        tier = "RISCHIO ESTREMO"
    elif total < 65:
        tier = "RISCHIO ALTO"
    else:
        tier = "RISCHIO MODERATO*"  # moderate for a memecoin, which is still a casino
    traps = list(dict.fromkeys([item.flag for item in items if item.flag] + sec.risks))

    token = pair.get("baseToken") or {}
    return Report(
        name=token.get("name") or "?",
        symbol=token.get("symbol") or "?",
        chain=pair.get("chainId") or "",
        price=_number(pair.get("priceUsd")),
        market_cap=market_cap,
        liquidity=liquidity,
        items=items,
        total=total,
        coverage=sum(item.max for item in items if item.verified),
        gate=sec.gate_failed,
        cap=cap,
        tier=tier,
        traps=traps,
    )


def scan(address: str, now_ms: float, manual: Manual | None = None) -> Report:
    """Fetch live data for a contract address and score it."""
    chain = chain_of(address)
    if not chain:
        raise RadarError("indirizzo non valido: serve un contract Solana (base58) o EVM (0x…)")
    pairs = (_get(DEXSCREENER.format(address=address)) or {}).get("pairs") or []
    if not pairs:
        raise RadarError("DexScreener non conosce nessuna pair per questo token")
    pair = max(pairs, key=lambda p: _number((p.get("liquidity") or {}).get("usd")) or 0)
    rug = None
    if chain == "solana":
        try:
            rug = _get(RUGCHECK.format(address=address))
        except RadarError:
            rug = None  # security stays not verified and the score is capped
    return score(pair, rug, now_ms, manual)


def _get(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "token-screener/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return json.load(response)
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        raise RadarError(f"{urlsplit(url).hostname} non raggiungibile: {e}") from e


def _is_pool(holder: dict, known: dict) -> bool:
    """True for a token account RugCheck identifies as a liquidity pool, not a wallet."""
    return any(
        (known.get(holder.get(key)) or {}).get("type") == "AMM" for key in ("owner", "address")
    )


def _number(value) -> float | None:
    """A finite number from an API field that may be a string, missing or junk."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _is_number(value) -> bool:
    return not isinstance(value, bool) and _number(value) is not None


def _pct(value: float | None) -> str:
    return "—" if value is None else f"{value:+.1f}%"


def _age(hours: float | None) -> str:
    if hours is None:
        return "—"
    if hours < 1:
        return f"{hours * 60:.0f} min"
    if hours < 48:
        return f"{hours:.1f} h"
    return f"{hours / 24:.1f} giorni"
