from __future__ import annotations

import logging
from typing import Awaitable, Callable

from aiohttp import web as TSWeb

from .ts_logging import TSLogVerbose

TSLogger = logging.getLogger("TSArtiusBrowser")

# A single place where an unhandled exception in any Timesaver Artius Browser
# route becomes a clean 500 JSON response instead of leaking a stack trace or a
# broken half-response. This closes the whole "unhandled exception = broken
# route" class rather than relying on each handler to guard itself.
#
# It is applied as a per-handler wrapper (not app-level middleware) on purpose:
# ComfyUI's aiohttp application is already frozen by the time this extension
# registers its routes, so its middleware list can no longer be appended to,
# and a shared middleware would also intercept every other extension's routes.
# Wrapping only our own handlers keeps the behavior scoped to this extension.


def TSWrapRouteHandler(
    ts_handler: Callable[[object], Awaitable[object]],
) -> Callable[[object], Awaitable[object]]:
    async def ts_wrapped(ts_request):
        try:
            return await ts_handler(ts_request)
        except TSWeb.HTTPException:
            # Intentional HTTP outcomes (404 missing asset, 400 bad request,
            # 413 entity too large, redirects) are the handler's contract, not
            # bugs. They must pass through untouched.
            raise
        except Exception:
            TSLogger.exception(
                "Unhandled error in Timesaver Artius Browser route %s %s",
                getattr(ts_request, "method", "?"),
                getattr(ts_request, "path", "?"),
            )
            TSLogVerbose("route.error.unhandled", path=str(getattr(ts_request, "path", "")))
            return TSWeb.json_response({"error": "internal_error"}, status=500)

    return ts_wrapped
