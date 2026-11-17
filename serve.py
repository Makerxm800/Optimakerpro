#!/usr/bin/env python3
"""Preview server for the Optimakerpro UI.

Sends Cache-Control: no-store so the browser always loads the freshest
CSS/JS (the plain http.server made browsers serve stale assets).
"""
import http.server
import socketserver
import sys
from functools import partial

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
DIR = "ui"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the log clean


class ReusableTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with ReusableTCPServer(("0.0.0.0", PORT), partial(NoCacheHandler)) as httpd:
        print(f"Serving {DIR}/ on 0.0.0.0:{PORT} (no-store)")
        httpd.serve_forever()
