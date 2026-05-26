#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -n "$(git status --short)" ]]; then
  echo "working tree is dirty. commit or stash first."
  git status --short
  exit 1
fi

if ! git show-ref --verify --quiet refs/heads/main; then
  echo "main branch missing."
  exit 1
fi

if git show-ref --verify --quiet refs/heads/dev; then
  echo "dev branch already exists."
  exit 0
fi

git checkout main
git pull --ff-only origin main 2>/dev/null || true
git checkout -b dev
echo "created dev branch from main."
