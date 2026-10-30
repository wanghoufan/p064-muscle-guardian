#!/bin/bash
# 无 Gradle 打包：aapt2 编资源 → javac → d8 → zipalign → apksigner
# 产物：android-apk/build/肌肉守护者.apk（assets/www 内嵌 dist，完全离线）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK="$ROOT/android-apk"
OUT="$APK/build"
SDK="${ANDROID_SDK:-$HOME/Library/Android/sdk}"
BT="$SDK/build-tools/37.0.0"
JAR="$SDK/platforms/android-34/android.jar"

rm -rf "$OUT"; mkdir -p "$OUT/res" "$OUT/classes" "$OUT/dex" "$OUT/assets"

[ -f "$ROOT/dist/index.html" ] || { echo "先 npm run build"; exit 1; }
cp -R "$ROOT/dist" "$OUT/assets/www"

"$BT/aapt2" compile --dir "$APK/res" -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/app-unsigned.apk" \
  -I "$JAR" --manifest "$APK/AndroidManifest.xml" \
  -R "$OUT/res.zip" -A "$OUT/assets" --auto-add-overlay

javac -source 8 -target 8 -bootclasspath "$JAR" -classpath "$JAR" \
  -d "$OUT/classes" $(find "$APK/src" -name '*.java') 2>/dev/null

"$BT/d8" --lib "$JAR" --min-api 23 --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')

(cd "$OUT/dex" && zip -q "$OUT/app-unsigned.apk" classes.dex)
"$BT/zipalign" -f 4 "$OUT/app-unsigned.apk" "$OUT/app-aligned.apk"
"$BT/apksigner" sign --ks "$HOME/.android/debug.keystore" \
  --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey \
  --out "$APK/肌肉守护者.apk" "$OUT/app-aligned.apk"
echo "OK: $APK/肌肉守护者.apk"
