"""Which projects can be opened: training and validation instances, and user projects.

Test instances never appear here. MK03, MK04, MK09 and the 35 benchmark test instances are
the thesis test data; they are refused by ``arls_ppo`` as well, and the test results are only
read from the result files (see ``/api/results``).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from . import ARLS_PPO  # noqa: F401  (puts arls_ppo on sys.path)

GROUP_MK = "Brandimarte (latih)"
GROUP_TRAIN = "Benchmark (latih)"
GROUP_VALID = "Benchmark (validasi)"
GROUP_CUSTOM = "Proyek sendiri"

#: Test instances of the thesis (``configs/split.yaml`` and ``docs/KUNCI_UJI.md``).
TEST_KEYS = frozenset({"MK03", "MK04", "MK09"})


@dataclass(frozen=True)
class Entry:
    key: str
    name: str
    group: str
    source: str               # instance name for arls_ppo, or "custom:KEY"
    editable: bool = False


def benchmark_key(name: str) -> str:
    """Short project key for a benchmark instance ("hurink/edata/la02" -> "LA02E")."""
    parts = name.split("/")
    if parts[0] == "hurink":
        return f"{parts[2].upper()}{parts[1][0].upper()}"
    if parts[0] == "dauzere":
        return f"DP{parts[1].upper()}"
    return re.sub(r"[^A-Z0-9]", "", parts[-1].upper())


def benchmark_name(name: str) -> str:
    parts = name.split("/")
    family = {"hurink": "Hurink", "barnes": "Barnes", "dauzere": "Dauzère-Pérès",
              "brandimarte": "Brandimarte"}.get(parts[0], parts[0])
    variant = f" {parts[1]}" if parts[0] == "hurink" else ""
    return f"{parts[-1]} ({family}{variant})"


def thesis_entries() -> list[Entry]:
    """The 7 MK training instances and the training and validation benchmark instances."""
    from dfjsp.datasets import BENCHMARK_LATIH, BENCHMARK_UJI, BENCHMARK_VALIDASI, BRANDIMARTE_TRAIN

    out = [Entry(n, f"{n} (Brandimarte)", GROUP_MK, n) for n in BRANDIMARTE_TRAIN]
    for group, names in ((GROUP_TRAIN, BENCHMARK_LATIH), (GROUP_VALID, BENCHMARK_VALIDASI)):
        for n in names:
            assert n not in BENCHMARK_UJI
            out.append(Entry(benchmark_key(n), benchmark_name(n), group, n))
    assert not TEST_KEYS & {e.key for e in out}
    return out
