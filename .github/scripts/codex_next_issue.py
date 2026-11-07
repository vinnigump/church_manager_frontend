#!/usr/bin/env python3
"""Select one unblocked frontend issue, requiring backend merges."""
import json
import os
import re
import subprocess
import sys

REPO = os.environ["GITHUB_REPOSITORY"]
ISSUES = [4, 5, 6]
BACKEND_DEPENDENCY = {4: 32, 5: 37, 6: 48}
BACKEND = "vinnigump/church_manager"

def gh(*args):
    return json.loads(subprocess.check_output(["gh", *args], text=True))

def issue(repo, number):
    return gh("api", f"repos/{repo}/issues/{number}")

def merged(repo, number):
    query = f'repo:{repo} is:pr is:merged "Closes #{number}" in:body'
    result = gh("api", "-X", "GET", "search/issues", "-f", f"q={query}", "-f", "per_page=30")
    return any(re.search(rf"(?im)^\\s*(?:closes|fixes|resolves)\\s+#{number}\\b", x.get("body") or "") for x in result.get("items", []))

def open_pr(repo, number):
    result = gh("api", "-X", "GET", "search/issues", "-f", f'q=repo:{repo} is:pr is:open "Closes #{number}" in:body')
    return any(re.search(rf"(?im)^\\s*(?:closes|fixes|resolves)\\s+#{number}\\b", x.get("body") or "") for x in result.get("items", []))

for index, number in enumerate(ISSUES):
    current = issue(REPO, number)
    if current["state"] == "closed":
        if not merged(REPO, number):
            print(f"::warning::Issue #{number} closed without merged PR; stop", file=sys.stderr)
            break
        continue
    if open_pr(REPO, number):
        print(f"::notice::Issue #{number} has open PR", file=sys.stderr)
        break
    if index and not merged(REPO, ISSUES[index - 1]):
        print("::notice::Previous frontend issue has no verified merged PR", file=sys.stderr)
        break
    if not os.environ.get("BACKEND_READ_TOKEN"):
        print("::warning::BACKEND_READ_TOKEN missing; cannot verify private backend", file=sys.stderr)
        break
    previous = os.environ["GH_TOKEN"]
    os.environ["GH_TOKEN"] = os.environ["BACKEND_READ_TOKEN"]
    try:
        backend_number = BACKEND_DEPENDENCY[number]
        dep = issue(BACKEND, backend_number)
        ready = dep["state"] == "closed" and merged(BACKEND, backend_number)
    finally:
        os.environ["GH_TOKEN"] = previous
    if not ready:
        print(f"::notice::Backend #{backend_number} not merged; frontend #{number} blocked", file=sys.stderr)
        break
    print(f"issue={number}")
    print("title=" + current["title"].replace("\n", " ").replace("\r", " "))
    break
else:
    print("::notice::All frontend issues completed", file=sys.stderr)
