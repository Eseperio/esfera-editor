#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -d models/LaMa.mlmodelc ]; then
  printf '%s\n' 'Compiled LaMa model already exists; leaving it unchanged.'
  exit 0
fi
package=models/LaMa.mlpackage
base=https://huggingface.co/mlboydaisuke/LaMa-CoreML/resolve/main/LaMa.mlpackage
mkdir -p "$package/Data/com.apple.CoreML/weights"
fetch() {
  relative=$1 expected=$2 target="$package/$1"
  if [ -f "$target" ] && [ "$(shasum -a 256 "$target" | cut -d ' ' -f 1)" = "$expected" ]; then return; fi
  temporary="$target.download"
  trap 'rm -f "$temporary"' EXIT HUP INT TERM
  curl --fail --location --output "$temporary" "$base/$relative"
  printf '%s  %s\n' "$expected" "$temporary" | shasum -a 256 -c -
  mv "$temporary" "$target"
  trap - EXIT HUP INT TERM
}
fetch Manifest.json c814fff3cedf827c044094545ef80b0280b6cb8dd0e5c0bcf69fd31921191e58
fetch Data/com.apple.CoreML/model.mlmodel 06a100ef99e0fd16326a3a8c4a687d13f7b26f544ea906a75338932d8554f953
fetch Data/com.apple.CoreML/weights/weight.bin d0541f6044a94cd4982bfdac074fc1ccfe11d8f1f590c299d6b5071b501fc184
xcrun coremlcompiler compile "$package" models
