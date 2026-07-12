"""Process-level cumulative LLM token usage (resets on backend restart)."""

import threading
from typing import TypedDict


class TokenSnapshot(TypedDict):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class TokenUsageTracker:
    """Thread-safe accumulator for Fireworks/Gemini token usage across requests."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._prompt_tokens = 0
        self._completion_tokens = 0

    def record(self, prompt_tokens: int, completion_tokens: int) -> None:
        prompt = max(0, int(prompt_tokens or 0))
        completion = max(0, int(completion_tokens or 0))
        if prompt == 0 and completion == 0:
            return
        with self._lock:
            self._prompt_tokens += prompt
            self._completion_tokens += completion

    def snapshot(self) -> TokenSnapshot:
        with self._lock:
            prompt = self._prompt_tokens
            completion = self._completion_tokens
        return {
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "total_tokens": prompt + completion,
        }


token_usage_tracker = TokenUsageTracker()
