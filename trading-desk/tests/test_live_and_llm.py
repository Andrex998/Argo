"""The two parts that talk to the outside world, exercised against stand-ins."""

from types import SimpleNamespace

import pytest

from desk import broker as broker_module
from desk.agents.llm import FALLBACK_BETA, AgentUnavailable, ClaudeLLM
from desk.broker import BrokerError, LiveBroker
from desk.config import Settings
from desk.models import Verdict


class StubExchange:
    def __init__(self, order: dict, balances: dict | None = None, options: dict | None = None):
        self.order = order
        self.balances = balances or {}
        self.options = options or {}
        self.created: list[tuple] = []

    def load_markets(self):
        return {}

    def market(self, symbol):
        return {"base": "SOL", "limits": {"amount": {"min": 0.01}, "cost": {"min": 5.0}}}

    def amount_to_precision(self, symbol, amount):
        return f"{int(amount * 100) / 100:.2f}"

    def fetch_balance(self):
        return self.balances

    def create_order(self, symbol, type_, side, amount, price=None):
        self.created.append((symbol, type_, side, amount, price))
        return self.order

    def fetch_order(self, order_id, symbol):
        return self.order


@pytest.fixture(autouse=True)
def no_waiting(monkeypatch):
    monkeypatch.setattr(broker_module.time, "sleep", lambda seconds: None)


def filled(amount, average, fee_cost, fee_currency) -> dict:
    return {
        "id": "1",
        "status": "closed",
        "filled": amount,
        "average": average,
        "fees": [{"cost": fee_cost, "currency": fee_currency}],
    }


def test_live_buy_with_fee_in_quote(cfg):
    exchange = StubExchange(filled(1.23, 100.0, 0.123, "USDC"))
    fill = LiveBroker(exchange, cfg).buy("SOL/USDC", 1.2345, 99.9)
    assert exchange.created == [("SOL/USDC", "market", "buy", 1.23, None)]
    assert fill.qty == 1.23
    assert fill.quote_delta == pytest.approx(-123.123)


def test_live_buy_with_fee_in_base_reduces_what_is_held(cfg):
    fill = LiveBroker(StubExchange(filled(1.0, 100.0, 0.001, "SOL")), cfg).buy(
        "SOL/USDC", 1.0, 100.0
    )
    assert fill.qty == pytest.approx(0.999)
    assert fill.quote_delta == pytest.approx(-100.0)
    assert fill.fee == pytest.approx(0.1)


def test_live_buy_passes_a_price_where_the_exchange_needs_one(cfg):
    options = {"createMarketBuyOrderRequiresPrice": True}
    exchange = StubExchange(filled(1.0, 100.0, 0.1, "USDC"), options=options)
    LiveBroker(exchange, cfg).buy("SOL/USDC", 1.0, 99.5)
    assert exchange.created[0][4] == 99.5


def test_live_buy_below_exchange_minimum_is_refused(cfg):
    exchange = StubExchange(filled(0.02, 100.0, 0.0, "USDC"))
    with pytest.raises(BrokerError, match="minimo"):
        LiveBroker(exchange, cfg).buy("SOL/USDC", 0.02, 100.0)  # 2 USDC, minimum cost is 5
    assert exchange.created == []


def test_live_sell_never_exceeds_the_balance_held(cfg):
    exchange = StubExchange(filled(0.99, 110.0, 0.1089, "USDC"), balances={"SOL": {"free": 0.999}})
    fill = LiveBroker(exchange, cfg).sell("SOL/USDC", 1.0, 110.0)
    assert exchange.created == [("SOL/USDC", "market", "sell", 0.99, None)]
    assert fill.quote_delta == pytest.approx(0.99 * 110.0 - 0.1089)


def test_live_order_that_never_confirms_is_reported(cfg):
    exchange = StubExchange({"id": "7", "status": "open", "filled": 0})
    with pytest.raises(BrokerError, match="non confermato"):
        LiveBroker(exchange, cfg).buy("SOL/USDC", 1.0, 100.0)


# --- Claude wrapper --------------------------------------------------------------

VERDICT = Verdict(decision="WAIT", conviction="low", confidence=0.5, rebuttals=[], summary="…")


def response(stop_reason="end_turn", parsed=VERDICT, searches=0):
    return SimpleNamespace(
        stop_reason=stop_reason,
        parsed_output=parsed,
        content=["blocks"],
        usage=SimpleNamespace(
            input_tokens=1000,
            output_tokens=200,
            cache_read_input_tokens=0,
            cache_creation_input_tokens=None,
            server_tool_use=SimpleNamespace(web_search_requests=searches) if searches else None,
        ),
    )


def claude(*responses):
    requests, usage, queue = [], [], list(responses)

    def parse(**request):
        requests.append(request)
        return queue.pop(0)

    llm = ClaudeLLM(Settings(_env_file=None, anthropic_api_key="test"), on_usage=usage.append)
    llm.client = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(parse=parse)))
    return llm, requests, usage


def test_request_shape():
    llm, requests, _ = claude(response())
    assert llm.ask("system", "prompt", Verdict, effort="high") is VERDICT
    (request,) = requests
    assert request["model"] == "claude-opus-5-5"
    assert request["output_format"] is Verdict
    assert request["output_config"] == {"effort": "high"}
    assert request["thinking"] == {"type": "adaptive"}
    assert request["betas"] == [FALLBACK_BETA] and request["fallbacks"] == "default"
    assert request["messages"] == [{"role": "user", "content": "prompt"}]
    assert "tools" not in request


def test_web_search_is_capped():
    llm, requests, _ = claude(response())
    llm.ask("system", "prompt", Verdict, web_search=True)
    assert requests[0]["tools"] == [
        {"type": "web_search_20260209", "name": "web_search", "max_uses": 3}
    ]


def test_paused_turn_is_resumed_with_the_partial_answer():
    llm, requests, usage = claude(response(stop_reason="pause_turn", parsed=None), response())
    assert llm.ask("system", "prompt", Verdict, web_search=True) is VERDICT
    assert requests[1]["messages"][1] == {"role": "assistant", "content": ["blocks"]}
    assert len(usage) == 2  # both requests are billed


def test_refusal_and_cut_off_answers_mean_no_report():
    for stop_reason in ("refusal", "max_tokens"):
        llm, _, _ = claude(response(stop_reason=stop_reason, parsed=None))
        with pytest.raises(AgentUnavailable):
            llm.ask("system", "prompt", Verdict)


def test_spend_is_estimated_from_usage():
    llm, _, usage = claude(response(searches=2))
    llm.ask("system", "prompt", Verdict, web_search=True)
    (spent,) = usage
    assert (spent.input_tokens, spent.output_tokens, spent.searches) == (1000, 200, 2)
    assert spent.cost == pytest.approx(1000 * 4 / 1e6 + 200 * 20 / 1e6 + 2 * 0.01)


def test_missing_credentials_are_caught_at_startup(monkeypatch):
    for name in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE"):
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(AgentUnavailable, match="credenziale"):
        ClaudeLLM(Settings(_env_file=None))
