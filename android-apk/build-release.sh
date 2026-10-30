#!/bin/bash
# Release 签名打包：与 build.sh 流程一致，仅把签名换成 release keystore。
# 用法（任选其一）：
#   1) 环境变量：RELEASE_STORE_PASS=xxx RELEASE_KEY_PASS=xxx bash android-apk/build-release.sh
#   2) 本地文件：在 android-apk/.keystore-pass 写 STORE_PASS/KEY_PASS（已 gitignore，不入库）
# 产物：android-apk/肌肉守护者.apk（release 签名，可正式分发）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK="$ROOT/android-apk"
OUT="$APK/build"
SDK="${ANDROID_SDK:-$HOME/Library/Android/sdk}"
BT="$SDK/build-tools/37.0.0"
JAR="$SDK/platforms/android-34/android.jar"

# 未通过环境变量传入时，从本地 gitignore 的 .keystore-pass 读取（不入库）
if [ -z "${RELEASE_STORE_PASS:-}" ] && [ -f "$APK/.keystore-pass" ]; then
  set -a; . "$APK/.keystore-pass"; set +a
fi

: "${RELEASE_STORE_PASS:?请设置环境变量 RELEASE_STORE_PASS（release keystore 密码），或在 android-apk/.keystore-pass 配置}"
: "${RELEASE_KEY_PASS:?请设置环境变量 RELEASE_KEY_PASS（release key 密码），或在 android-apk/.keystore-pass 配置}"
ALIAS="${ALIAS:-muscleguardian}"
KS="$APK/release.keystore"
[ -f "$KS" ] || { echo "缺少 $KS，请先生成 release keystore"; exit 1; }

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
"$BT/apksigner" sign --ks "$KS" \
  --ks-pass "pass:$RELEASE_STORE_PASS" --key-pass "pass:$RELEASE_KEY_PASS" \
  --ks-key-alias "$ALIAS" \
  --out "$APK/肌肉守护者.apk" "$OUT/app-aligned.apk"
echo "OK(release): $APK/肌肉守护者.apk"
