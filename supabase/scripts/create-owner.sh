#!/usr/bin/env bash
# Membuat user owner untuk testing lokal (Sub-PRD 0.3).
# Jalankan setelah `supabase start` atau setiap `supabase db reset`
# (reset menghapus data auth + seed ulang tabel).
#
#   ./supabase/scripts/create-owner.sh [email] [password]
#
# Default: owner@pos.local / owner123
set -euo pipefail

EMAIL="${1:-owner@pos.local}"
PASSWORD="${2:-owner123}"
API_URL="${SUPABASE_API_URL:-http://127.0.0.1:54321}"

# Ambil service_role key dari .env.local bila tidak di-set di environment.
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2-)"
fi
SR="$SUPABASE_SERVICE_ROLE_KEY"

echo "Membuat user $EMAIL ..."
USER_JSON="$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SR" -H "Authorization: Bearer $SR" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Owner\"}}")"

USER_ID="$(echo "$USER_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")"
echo "User id: $USER_ID"

supabase db query --local \
  "INSERT INTO public.profiles (id, role_id, full_name) VALUES ('$USER_ID', '10000000-0000-4000-8000-000000000001', 'Owner') ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name, is_active = TRUE;"

echo "Owner siap: $EMAIL"
