"""User projects in SQLite (the specification as typed in the form)."""
from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path

EXAMPLES = Path(__file__).with_name("contoh")


class Store:
    def __init__(self, path: Path, *, seed_examples: bool = True):
        path.parent.mkdir(parents=True, exist_ok=True)
        new = not path.exists()
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._lock = threading.Lock()
        self._db.execute("CREATE TABLE IF NOT EXISTS projects (key TEXT PRIMARY KEY, "
                         "spec TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP)")
        self._db.commit()
        if new and seed_examples:
            for f in sorted(EXAMPLES.glob("*.json")):
                spec = json.loads(f.read_text(encoding="utf-8"))
                self.put(spec["key"], spec)

    def all(self) -> dict[str, dict]:
        with self._lock:
            rows = self._db.execute("SELECT key, spec FROM projects ORDER BY created, key")
            return {k: json.loads(s) for k, s in rows}

    def get(self, key: str) -> dict | None:
        with self._lock:
            row = self._db.execute("SELECT spec FROM projects WHERE key = ?", (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, key: str, spec: dict) -> None:
        with self._lock:
            self._db.execute("INSERT OR REPLACE INTO projects (key, spec) VALUES (?, ?)",
                             (key, json.dumps(spec, ensure_ascii=False)))
            self._db.commit()

    def delete(self, key: str) -> bool:
        with self._lock:
            cur = self._db.execute("DELETE FROM projects WHERE key = ?", (key,))
            self._db.commit()
        return cur.rowcount > 0
