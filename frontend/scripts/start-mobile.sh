#!/usr/bin/env bash
# Starts Expo dev server and generates a QR code for Expo Go on mobile.
# Usage: ./scripts/start-mobile.sh [port]

set -e

PORT=${1:-8081}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"

# Detect local IP (prefers non-loopback interface)
detect_ip() {
  if command -v ip &>/dev/null; then
    ip route get 8.8.8.8 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1
  elif command -v ifconfig &>/dev/null; then
    ifconfig | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | head -1
  else
    echo "127.0.0.1"
  fi
}

LOCAL_IP=$(detect_ip)
EXPO_URL="exp://${LOCAL_IP}:${PORT}"

echo ""
echo "========================================="
echo "  Portugal Vivo — Mobile Dev"
echo "  IP:   ${LOCAL_IP}"
echo "  Port: ${PORT}"
echo "  URL:  ${EXPO_URL}"
echo "========================================="
echo ""

# Generate QR code PNG if python3 + qrcode available
QR_PNG="${FRONTEND_DIR}/assets/expo-qr.png"
if python3 -c "import qrcode" 2>/dev/null; then
  python3 - <<PYEOF
import qrcode

url = "${EXPO_URL}"
qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
qr.add_data(url)
qr.make(fit=True)

img = qr.make_image(fill_color="black", back_color="white")
img.save("${QR_PNG}")
print(f"QR PNG saved → ${QR_PNG}")

qr2 = qrcode.QRCode(border=2)
qr2.add_data(url)
qr2.make(fit=True)
print("")
qr2.print_ascii(invert=True)
print("")
PYEOF
else
  echo "Install qrcode for PNG output: pip3 install qrcode[pil]"
  echo ""
fi

echo "Scan the QR code above with Expo Go"
echo "Starting Metro Bundler..."
echo ""

cd "$FRONTEND_DIR"
exec npx expo start --port "$PORT" --lan
