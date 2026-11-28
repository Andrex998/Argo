"""Claude access for the analyst agents: one structured answer per call."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal, Protocol, TypeVar

import anthropic
from pydantic import BaseModel

from desk.config import Settings

T = TypeVar("T", bound=BaseModel)
Effort = Literal["low", "medium", "high", "xhigh", "max"]

MAX_TOKENS = 16_000
MAX_CONTINUATIONS = 3  # resumes of a server-tool turn the API paused
FALLBACK_BETA = "server-side-fallback-2026-07-01"

# USD per million tokens (input, output), used only to estimate spend in `desk status`.
PRICES = {
    "claude-fable-5-2": (8.00, 40.00),
    "claude-opus-5-5": (4.00, 20.00),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-haiku-5-5": (0.10, 0.50),
}
SEARCH_PRICE = 0.01  # USD per web search


class AgentUnavailable(Exception):
    """An analyst could not answer. The desk treats this as 'no trade'."""


@dataclass(frozen=True, slots=True)
class Usage:
    input_tokens: int
    output_tokens: int
    searches: int
    cost: float  # estimated USD; 0 when the model's price is unknown


class LLM(Protocol):
    def ask(
        self,
        system: str,
        prompt: str,
        schema: type[T],
        *,
        effort: Effort = "medium",
        web_search: bool = False,
    ) -> T: ...


class ClaudeLLM:
    def __init__(self, cfg: Settings, on_usage: Callable[[Usage], None] | None = None):
        self.cfg = cfg
        self.on_usage = on_usage
        # With no key in .env the SDK resolves credentials from the environment itself.
        self.client = (
            anthropic.Anthropic(api_key=cfg.anthropic_api_key)
            if cfg.anthropic_api_key
            else anthropic.Anthropic()
        )
        if not (self.client.api_key or self.client.auth_token or self.client.credentials):
            raise AgentUnavailable("nessuna credenziale Anthropic trovata")

    def ask(
        self,
        system: str,
        prompt: str,
        schema: type[T],
        *,
        effort: Effort = "medium",
        web_search: bool = False,
    ) -> T:
        messages: list = [{"role": "user", "content": prompt}]
        request: dict = {
            "model": self.cfg.model,
            "max_tokens": MAX_TOKENS,
            "system": system,
            "thinking": {"type": "adaptive"},
            "output_config": {"effort": effort},
            "output_format": schema,
        }
        if self.cfg.refusal_fallback:
            # If a safety classifier declines, the API re-runs the request on its
            # recommended fallback model instead of returning a refusal.
            request["betas"] = [FALLBACK_BETA]
            request["fallbacks"] = "default"
        if web_search:
            request["tools"] = [
                {
                    "type": "web_search_20260209",
                    "name": "web_search",
                    "max_uses": self.cfg.max_searches,
                }
            ]

        for _ in range(MAX_CONTINUATIONS + 1):
            response = self._send(request, messages)
            self._record(response.usage)
            if response.stop_reason != "pause_turn":
                break
            messages = [*messages, {"role": "assistant", "content": response.content}]

        if response.stop_reason == "refusal":
            raise AgentUnavailable("il modello ha rifiutato la richiesta")
        if response.parsed_output is None:
            raise AgentUnavailable(f"risposta incompleta (stop_reason={response.stop_reason})")
        return response.parsed_output

    def _send(self, request: dict, messages: list):
        try:
            return self.client.beta.messages.parse(**request, messages=messages)
        except anthropic.AuthenticationError as e:
            raise AgentUnavailable("chiave ANTHROPIC_API_KEY mancante o non valida") from e
        except anthropic.RateLimitError as e:
            raise AgentUnavailable("limite di richieste raggiunto") from e
        except anthropic.APIStatusError as e:
            raise AgentUnavailable(f"errore API {e.status_code}: {e.message}") from e
        except anthropic.APIConnectionError as e:
            raise AgentUnavailable("API Anthropic non raggiungibile") from e
        except ValueError as e:  # the answer was cut off and is not valid JSON for the schema
            raise AgentUnavailable(f"risposta non interpretabile: {e}") from e

    def _record(self, usage) -> None:
        if not self.on_usage:
            return
        # Cached and cache-writing tokens are billed too; count them all as input.
        tokens_in = (
            usage.input_tokens
            + (usage.cache_read_input_tokens or 0)
            + (usage.cache_creation_input_tokens or 0)
        )
        searches = (usage.server_tool_use.web_search_requests or 0) if usage.server_tool_use else 0
        price_in, price_out = PRICES.get(self.cfg.model, (0.0, 0.0))
        cost = (tokens_in * price_in + usage.output_tokens * price_out) / 1e6
        if price_in:
            cost += searches * SEARCH_PRICE
        self.on_usage(Usage(tokens_in, usage.output_tokens, searches, cost))
