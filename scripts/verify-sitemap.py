#!/usr/bin/env python3
"""Reject missing/HTML/partial sitemap artifacts before and after deployment."""
import argparse
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

NS = '{http://www.sitemaps.org/schemas/sitemap/0.9}'


def parse_xml(data):
    root = ET.fromstring(data)
    if root.tag != NS + 'urlset':
        raise ValueError('Expected sitemap <urlset>, received another document (possibly the SPA HTML)')
    urls = [node.text for node in root.findall(NS + 'url/' + NS + 'loc')]
    if not urls or any(not url or not url.startswith('https://') for url in urls):
        raise ValueError('Sitemap is empty or contains non-HTTPS URLs')
    if len(urls) != len(set(urls)):
        raise ValueError('Sitemap contains duplicate URLs')
    return set(urls)


def verify(source, expected_file=None):
    if source.startswith(('http://', 'https://')):
        separator = '&' if '?' in source else '?'
        request = urllib.request.Request(
            source + separator + 'sitemap_check=' + str(time.time_ns()),
            headers={'User-Agent': 'Platforma-Sitemap-Check/1.0', 'Cache-Control': 'no-cache'},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status != 200:
                raise ValueError(f'Expected HTTP 200, received {response.status}')
            if 'html' in response.headers.get('Content-Type', '').lower():
                raise ValueError('Server returned HTML instead of sitemap XML; check the static root and SPA fallback')
            data = response.read()
    else:
        data = Path(source).read_bytes()
    urls = parse_xml(data)
    if expected_file and urls != parse_xml(Path(expected_file).read_bytes()):
        raise ValueError('Published sitemap does not match the generated artifact; check the deployment directory and server cache')
    return len(urls)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('--expect-file')
    args = parser.parse_args()
    attempts = 3 if args.source.startswith(('http://', 'https://')) else 1
    for attempt in range(attempts):
        try:
            count = verify(args.source, args.expect_file)
            print(f'Sitemap verified: {count} HTTPS URLs ({args.source})')
            return
        except (OSError, ValueError, ET.ParseError) as error:
            if attempt + 1 == attempts:
                print(f'Sitemap verification failed: {error}', file=sys.stderr)
                sys.exit(1)
            time.sleep(2)


if __name__ == '__main__':
    main()
