import sys
from pathlib import Path

import httpx


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"

for path in (ROOT, BACKEND):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))


if "app" not in httpx.Client.__init__.__code__.co_varnames:
    _original_httpx_client_init = httpx.Client.__init__

    def _httpx_client_init_compat(self, *args, app=None, **kwargs):
        _original_httpx_client_init(self, *args, **kwargs)

    httpx.Client.__init__ = _httpx_client_init_compat
