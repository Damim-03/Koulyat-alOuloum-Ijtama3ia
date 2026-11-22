#!/usr/bin/env bash
# A trial with a real HTTPS address and no domain: a Cloudflare quick tunnel.
#
#   ./tunnel.sh         start it, and point the platform at its address
#   ./tunnel.sh stop    take the platform off the internet
#
# The address (https://….trycloudflare.com) is new each time the tunnel
# starts: the platform must know it — it is the only origin allowed in, and
# the address in every email link — so it is written into .env as
# PUBLIC_ORIGIN and the platform restarted with it.
set -euo pipefail
cd "$(dirname "$0")"

if [[ "${1:-}" == "stop" ]]; then
  docker compose stop tunnel
  echo "The tunnel is stopped: the platform is no longer on the internet."
  exit 0
fi

[[ -f .env ]] || { echo "deploy/.env is missing — copy .env.example first (README.md)."; exit 1; }

docker compose --profile tunnel up -d --force-recreate tunnel

echo -n "Waiting for the tunnel's address"
url=""
for _ in $(seq 1 30); do
  url=$(docker compose logs tunnel 2>/dev/null | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1 || true)
  [[ -n "$url" ]] && break
  echo -n "."
  sleep 2
done
echo
[[ -n "$url" ]] || { echo "No address yet — see: docker compose logs tunnel"; exit 1; }

# PUBLIC_ORIGIN=<the address>, replacing any earlier one.
if grep -q '^PUBLIC_ORIGIN=' .env; then
  sed -i "s#^PUBLIC_ORIGIN=.*#PUBLIC_ORIGIN=$url#" .env
else
  printf '\nPUBLIC_ORIGIN=%s\n' "$url" >> .env
fi
docker compose up -d app

echo
echo "The platform is on the internet at:"
echo "  $url"
echo "Stop it with: ./tunnel.sh stop"
