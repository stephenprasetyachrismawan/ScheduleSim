"""ScheduleSim backend: a project-management view over the ARLS-PPO thesis code.

All scheduling work is done by ``arls_ppo`` from the pinned submodule ``vendor/arls-ppo``;
this package only maps its results to issues, boards and timelines and serves them.
"""
from __future__ import annotations

import sys
from pathlib import Path

#: Root of the ScheduleSim repository.
ROOT = Path(__file__).resolve().parents[2]
#: The arls-ppo checkout pinned as a git submodule.
ARLS_PPO = ROOT / "vendor" / "arls-ppo"

if str(ARLS_PPO / "src") not in sys.path:
    sys.path.insert(0, str(ARLS_PPO / "src"))

import arls_ppo  # noqa: E402,F401  (also puts dfjsp and the experiment scripts on sys.path)
