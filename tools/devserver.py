#!/usr/bin/env python3
"""سرور توسعه با غیرفعال‌سازی کامل کش مرورگر."""
import http.server, socketserver, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def send_response(self, *a, **k):
        super().send_response(*a, **k)
class S(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f'سرور بدون کش روی پورت {port}')
    with S(('0.0.0.0', port), H) as httpd:
        httpd.serve_forever()
