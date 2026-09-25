"""In-process metrics: counters and a latency histogram, exportable as a plain
dict or Prometheus text. No external dependency.

These are per process. With several instances, scrape each one (a Prometheus
server sums them); do not read a single instance's numbers as the whole fleet.
"""
from __future__ import annotations

import threading
from collections import defaultdict
from typing import Any, Dict, Iterable, Tuple

_BUCKETS_MS: Tuple[float, ...] = (50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000)

Labels = Tuple[Tuple[str, str], ...]


def _labels(**kw: Any) -> Labels:
    return tuple(sorted((k, str(v)) for k, v in kw.items()))


class RouterMetrics:
    def __init__(self) -> None:
        self._counters: Dict[Tuple[str, Labels], int] = defaultdict(int)
        self._hist_counts: Dict[Labels, list] = {}
        self._hist_sum: Dict[Labels, float] = defaultdict(float)
        self._lock = threading.Lock()

    def incr(self, name: str, amount: int = 1, **labels: Any) -> None:
        with self._lock:
            self._counters[(name, _labels(**labels))] += amount

    def observe_latency(self, latency_ms: float, **labels: Any) -> None:
        key = _labels(**labels)
        with self._lock:
            counts = self._hist_counts.setdefault(key, [0] * (len(_BUCKETS_MS) + 1))
            for i, bound in enumerate(_BUCKETS_MS):
                if latency_ms <= bound:
                    counts[i] += 1
                    break
            else:
                counts[-1] += 1
            self._hist_sum[key] += latency_ms

    def counter(self, name: str, **labels: Any) -> int:
        """Sum of every series of `name` whose labels include the given ones."""
        want = set(_labels(**labels))
        with self._lock:
            return sum(v for (n, lab), v in self._counters.items() if n == name and want <= set(lab))

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            counters = [{"name": n, "labels": dict(lab), "value": v} for (n, lab), v in sorted(self._counters.items())]
            hist = []
            for lab, counts in self._hist_counts.items():
                total = sum(counts)
                hist.append({
                    "labels": dict(lab),
                    "count": total,
                    "sum_ms": round(self._hist_sum[lab], 1),
                    "buckets_ms": dict(zip([*map(str, _BUCKETS_MS), "+Inf"], counts)),
                })
        return {"counters": counters, "latency": hist}

    def prometheus(self) -> str:
        def fmt(lab: Iterable[Tuple[str, str]]) -> str:
            items = ",".join(f'{k}="{v}"' for k, v in lab)
            return "{" + items + "}" if items else ""

        lines = []
        with self._lock:
            for (name, lab), value in sorted(self._counters.items()):
                lines.append(f"ai_router_{name}{fmt(lab)} {value}")
            for lab, counts in self._hist_counts.items():
                running = 0
                for bound, c in zip([*_BUCKETS_MS, float("inf")], counts):
                    running += c
                    le = "+Inf" if bound == float("inf") else str(int(bound))
                    lines.append(f"ai_router_latency_ms_bucket{fmt((*lab, ('le', le)))} {running}")
                lines.append(f"ai_router_latency_ms_sum{fmt(lab)} {self._hist_sum[lab]}")
                lines.append(f"ai_router_latency_ms_count{fmt(lab)} {sum(counts)}")
        return "\n".join(lines) + ("\n" if lines else "")
