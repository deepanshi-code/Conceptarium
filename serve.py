"""Local development server for Conceptarium.

Same as `python -m http.server`, but tells the browser never to cache, so a normal refresh always
loads the latest JS/CSS. (The plain server sends no cache headers, and browsers then reuse old
ES modules for a while.)

Usage:  python serve.py [port]      (default port 5173)
"""
import http.server
import socketserver
import sys
from pathlib import Path


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    with Server(("", port), NoCacheHandler) as httpd:
        print(f"Conceptarium running at http://localhost:{port}  (Ctrl+C to stop)")
        httpd.serve_forever()
