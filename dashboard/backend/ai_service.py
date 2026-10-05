"""Optional future AI adapter. Core baseline operations do not import a model client."""
from typing import Protocol


class BaselineAI(Protocol):
    def parse_baseline(self, text: str) -> dict: ...
    def review_baseline(self, baseline: dict) -> dict: ...
    def compare_baselines(self, first: dict, second: dict) -> dict: ...


class DisabledAI:
    enabled = False

    def parse_baseline(self, text: str) -> dict:
        raise RuntimeError("Local LLM is not configured")

    def review_baseline(self, baseline: dict) -> dict:
        raise RuntimeError("Local LLM is not configured")

    def compare_baselines(self, first: dict, second: dict) -> dict:
        raise RuntimeError("Local LLM is not configured")
