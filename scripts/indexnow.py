#!/usr/bin/env python3
"""Tell IndexNow-enabled search engines (Bing and partners) which pages changed.

Usage:
    python3 scripts/indexnow.py <before-sha> <after-sha>   # pages changed in a push
    python3 scripts/indexnow.py --all                      # every page in sitemap.xml
    add --dry-run to print the request without sending it

Only URLs listed in sitemap.xml are ever submitted, so drafts, noindex pages and
admin tooling stay out. The key file at the site root proves ownership; it is
meant to be public.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
SITE_ORIGIN = "https://shchen0603.github.io/Personal-Website"
SITE_HOST = "shchen0603.github.io"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
KEY_PATTERN = re.compile(r"^[0-9a-f]{32}\.txt$")
PAGES_WAIT_SECONDS = 300
PAGES_POLL_SECONDS = 15


def find_key() -> str:
    keys = [path.stem for path in ROOT.glob("*.txt") if KEY_PATTERN.match(path.name)]
    if len(keys) != 1:
        sys.exit(f"Expected exactly one IndexNow key file at the site root, found {len(keys)}.")
    key = keys[0]
    if (ROOT / f"{key}.txt").read_text(encoding="utf-8").strip() != key:
        sys.exit("The IndexNow key file must contain its own key.")
    return key


def sitemap_urls() -> list[str]:
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    return [url.replace("&amp;", "&") for url in re.findall(r"<loc>([^<]+)</loc>", sitemap)]


def url_for_file(relative_path: str) -> str:
    if relative_path == "index.html":
        return f"{SITE_ORIGIN}/"
    return f"{SITE_ORIGIN}/{quote(relative_path)}"


def changed_files(before: str, after: str) -> list[str] | None:
    if not before or set(before) == {"0"}:
        return None
    result = subprocess.run(
        ["git", "diff", "--name-only", before, after],
        cwd=ROOT, capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"git diff failed; submitting every sitemap URL instead.\n{result.stderr.strip()}")
        return None
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def wait_for_pages(sha: str) -> None:
    """Wait until GitHub Pages has published the pushed commit, so crawlers that
    react immediately fetch the new content rather than the previous build."""
    repository = os.environ.get("GITHUB_REPOSITORY")
    token = os.environ.get("GITHUB_TOKEN")
    if not (repository and token and sha):
        return
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repository}/pages/builds/latest",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
    )
    deadline = time.time() + PAGES_WAIT_SECONDS
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                build = json.load(response)
            if build.get("commit") == sha and build.get("status") == "built":
                print("GitHub Pages has published this commit.")
                return
            if build.get("commit") == sha and build.get("status") == "errored":
                sys.exit("GitHub Pages build failed; not notifying search engines.")
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            print(f"Could not read the Pages build status yet: {error}")
        time.sleep(PAGES_POLL_SECONDS)
    print("Timed out waiting for GitHub Pages; submitting anyway.")


def main() -> None:
    args = [arg for arg in sys.argv[1:] if arg != "--dry-run"]
    dry_run = "--dry-run" in sys.argv[1:]
    submit_all = "--all" in args
    args = [arg for arg in args if arg != "--all"]

    known = sitemap_urls()
    after = args[1] if len(args) > 1 else ""
    files = None if submit_all or len(args) < 2 else changed_files(args[0], after)
    if files is None:
        urls = known
    else:
        candidates = {url_for_file(path) for path in files if path.endswith(".html")}
        urls = [url for url in known if url in candidates]

    if not urls:
        print("No indexable pages changed; nothing to submit.")
        return

    key = find_key()
    payload = {
        "host": SITE_HOST,
        "key": key,
        "keyLocation": f"{SITE_ORIGIN}/{key}.txt",
        "urlList": urls,
    }
    print(f"Submitting {len(urls)} URL(s) to IndexNow:")
    for url in urls:
        print(f"  {url}")
    if dry_run:
        print("Dry run: nothing was sent.")
        return

    wait_for_pages(after or os.environ.get("GITHUB_SHA", ""))
    request = urllib.request.Request(
        INDEXNOW_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            print(f"IndexNow accepted the submission (HTTP {response.status}).")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:300]
        # 403/422 mean the key or URLs are wrong and need fixing; anything else
        # is treated as a temporary hiccup so a search-engine outage never
        # shows up as a failed deploy.
        if error.code in {403, 422}:
            sys.exit(f"IndexNow rejected the submission (HTTP {error.code}): {detail}")
        print(f"IndexNow returned HTTP {error.code}; skipping this time. {detail}")
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"IndexNow could not be reached; skipping this time. {error}")


if __name__ == "__main__":
    main()
