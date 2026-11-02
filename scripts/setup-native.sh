#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
swiftc -O native/LaMaRunner.swift -o native/lama-runner
swiftc -O native/SubjectMask.swift -o native/subject-mask
