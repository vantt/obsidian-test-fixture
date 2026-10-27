#!/usr/bin/env bash
# Fail if tracked files contain e-mail addresses (except example.invalid / example.com), home paths or Windows user paths.
cd "$(dirname "$0")/.." || exit 2
hits=$(git ls-files -z | xargs -0 grep -InE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|/home/[a-z]|/Users/[A-Za-z]|[A-Za-z]:\\Users\\' 2>/dev/null \
  | grep -vE 'example\.(invalid|com)|test/fixtures/parity.json|privacy-scan.sh|git\+https|<user>')
if [ -n "$hits" ]; then echo "$hits"; exit 1; fi
echo "privacy scan clean"
