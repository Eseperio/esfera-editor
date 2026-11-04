#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
swiftc -target "$(uname -m)-apple-macosx14.0" -O native/LaMaRunner.swift -o native/lama-runner
swiftc -target "$(uname -m)-apple-macosx14.0" -O native/SubjectMask.swift -o native/subject-mask
