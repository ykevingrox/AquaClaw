#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Initialize a fresh single-instance hosted AquaClaw server.

Usage:
  scripts/init-hosted-single-instance.sh --domain aqua.example.com [options]

Required:
  --domain DOMAIN                 Public domain or subdomain for AquaClaw.

Optional:
  --base-url URL                  Base URL used for post-install HTTP checks.
                                  Default: https://<domain>
  --output-dir PATH               Generated bundle directory.
                                  Default: ./.deploy/hosted-single-instance
  --repo-root PATH                Repo root on the target server.
                                  Default: current repo root
  --service-name NAME             systemd service name.
                                  Default: gateway-hub
  --service-user USER             Linux service user.
                                  Default: gateway-hub
  --service-group GROUP           Linux service group.
                                  Default: same as --service-user
  --config-dir PATH               Target env/config directory.
                                  Default: /etc/gateway-hub
  --data-dir PATH                 Target SQLite/data directory.
                                  Default: /var/lib/gateway-hub
  --backup-dir PATH               Target backup directory.
                                  Default: /var/backups/gateway-hub
  --app-host HOST                 Internal listen host.
                                  Default: 127.0.0.1
  --app-port PORT                 Internal listen port.
                                  Default: 8787
  --bootstrap-key KEY             Hosted owner bootstrap key. If omitted, one is generated.
  --npm-bin PATH                  npm path recorded in the generated systemd unit.
                                  Default: detected npm path
  --overwrite-caddyfile           Allow replacing a non-default /etc/caddy/Caddyfile
  --skip-caddy-install            Do not install or reload Caddyfile
  --skip-npm-ci                   Skip npm ci
  --skip-build                    Skip npm run build
  --skip-tests                    Skip npm test
  --skip-local-smoke             Skip local smoke
  --skip-hosted-smoke            Skip hosted smoke
  --skip-hosted-sqlite-smoke     Skip hosted+sqlite smoke
  --skip-start                    Install files but do not start/restart services
  --skip-check                    Skip post-install hosted HTTP checks
  --help                          Show this help text

This script is designed for a fresh single-purpose host. It refuses to overwrite
an existing non-default /etc/caddy/Caddyfile unless --overwrite-caddyfile is set.
EOF
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
default_repo_root="$(cd "${script_dir}/.." && pwd)"

domain=""
base_url=""
output_dir="${default_repo_root}/.deploy/hosted-single-instance"
repo_root="${default_repo_root}"
service_name="gateway-hub"
service_user="gateway-hub"
service_group=""
config_dir="/etc/gateway-hub"
data_dir="/var/lib/gateway-hub"
backup_dir="/var/backups/gateway-hub"
app_host="127.0.0.1"
app_port="8787"
bootstrap_key=""
npm_bin="$(command -v npm || true)"

overwrite_caddyfile=0
skip_caddy_install=0
skip_npm_ci=0
skip_build=0
skip_tests=0
skip_local_smoke=0
skip_hosted_smoke=0
skip_hosted_sqlite_smoke=0
skip_start=0
skip_check=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --domain)
      domain="${2:-}"
      shift 2
      ;;
    --base-url)
      base_url="${2:-}"
      shift 2
      ;;
    --output-dir)
      output_dir="${2:-}"
      shift 2
      ;;
    --repo-root)
      repo_root="${2:-}"
      shift 2
      ;;
    --service-name)
      service_name="${2:-}"
      shift 2
      ;;
    --service-user)
      service_user="${2:-}"
      shift 2
      ;;
    --service-group)
      service_group="${2:-}"
      shift 2
      ;;
    --config-dir)
      config_dir="${2:-}"
      shift 2
      ;;
    --data-dir)
      data_dir="${2:-}"
      shift 2
      ;;
    --backup-dir)
      backup_dir="${2:-}"
      shift 2
      ;;
    --app-host)
      app_host="${2:-}"
      shift 2
      ;;
    --app-port)
      app_port="${2:-}"
      shift 2
      ;;
    --bootstrap-key)
      bootstrap_key="${2:-}"
      shift 2
      ;;
    --npm-bin)
      npm_bin="${2:-}"
      shift 2
      ;;
    --overwrite-caddyfile)
      overwrite_caddyfile=1
      shift
      ;;
    --skip-caddy-install)
      skip_caddy_install=1
      shift
      ;;
    --skip-npm-ci)
      skip_npm_ci=1
      shift
      ;;
    --skip-build)
      skip_build=1
      shift
      ;;
    --skip-tests)
      skip_tests=1
      shift
      ;;
    --skip-local-smoke)
      skip_local_smoke=1
      shift
      ;;
    --skip-hosted-smoke)
      skip_hosted_smoke=1
      shift
      ;;
    --skip-hosted-sqlite-smoke)
      skip_hosted_sqlite_smoke=1
      shift
      ;;
    --skip-start)
      skip_start=1
      shift
      ;;
    --skip-check)
      skip_check=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$domain" ]; then
  echo "--domain is required" >&2
  usage >&2
  exit 1
fi

if [ -z "$service_group" ]; then
  service_group="$service_user"
fi

if [ -z "$base_url" ]; then
  base_url="https://${domain}"
fi

if [ -z "$npm_bin" ]; then
  echo "npm is required" >&2
  exit 1
fi

tmp_sqlite_smoke=""

cleanup() {
  if [ -n "$tmp_sqlite_smoke" ] && [ -f "$tmp_sqlite_smoke" ]; then
    rm -f "$tmp_sqlite_smoke"
  fi
}
trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "required command not found: $1" >&2
    exit 1
  fi
}

require_sudo_if_needed() {
  if [ "${EUID}" -eq 0 ]; then
    return 0
  fi
  require_command sudo
}

run_privileged() {
  if [ "${EUID}" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

ensure_group() {
  if getent group "$service_group" >/dev/null 2>&1; then
    return 0
  fi
  echo "Creating system group ${service_group}..."
  run_privileged addgroup --system "$service_group"
}

ensure_user() {
  if id -u "$service_user" >/dev/null 2>&1; then
    return 0
  fi

  echo "Creating system user ${service_user}..."
  if [ "$service_group" = "$service_user" ]; then
    run_privileged adduser --system --group --home /nonexistent --no-create-home "$service_user"
  else
    ensure_group
    run_privileged adduser --system --ingroup "$service_group" --home /nonexistent --no-create-home "$service_user"
  fi
}

is_safe_default_caddyfile() {
  local path="$1"
  if [ ! -f "$path" ] || [ ! -s "$path" ]; then
    return 0
  fi
  if grep -q 'Hello, world!' "$path" && ! grep -q 'reverse_proxy' "$path"; then
    return 0
  fi
  return 1
}

require_command bash
require_command cmp
require_command install
require_command systemctl
require_command getent
require_command adduser
require_command addgroup

if [ "$skip_caddy_install" -ne 1 ]; then
  require_command caddy
fi

require_sudo_if_needed

cd "$repo_root"

if [ "$skip_npm_ci" -ne 1 ]; then
  echo "Running npm ci..."
  npm ci
fi

if [ "$skip_build" -ne 1 ]; then
  echo "Running npm run build..."
  npm run build
fi

if [ "$skip_tests" -ne 1 ]; then
  echo "Running npm test..."
  npm test
fi

if [ "$skip_local_smoke" -ne 1 ]; then
  echo "Running npm run smoke..."
  npm run smoke
fi

if [ "$skip_hosted_smoke" -ne 1 ]; then
  echo "Running hosted smoke..."
  AQUA_DEPLOYMENT_MODE=hosted AQUA_HOSTED_OWNER_BOOTSTRAP_KEY=hosted-smoke-secret npm run smoke
fi

if [ "$skip_hosted_sqlite_smoke" -ne 1 ]; then
  tmp_sqlite_smoke="$(mktemp "${TMPDIR:-/tmp}/gateway-hub-init-hosted-XXXXXX.sqlite")"
  echo "Running hosted sqlite smoke..."
  AQUA_DEPLOYMENT_MODE=hosted \
    AQUA_HOSTED_OWNER_BOOTSTRAP_KEY=hosted-smoke-secret \
    GATEWAY_STORE_BACKEND=sqlite \
    DATABASE_URL="$tmp_sqlite_smoke" \
    npm run smoke
fi

echo "Rendering hosted bundle..."
render_cmd=(
  bash "${repo_root}/scripts/render-hosted-single-instance.sh"
  --domain "$domain"
  --output-dir "$output_dir"
  --repo-root "$repo_root"
  --service-name "$service_name"
  --service-user "$service_user"
  --service-group "$service_group"
  --config-dir "$config_dir"
  --data-dir "$data_dir"
  --backup-dir "$backup_dir"
  --app-host "$app_host"
  --app-port "$app_port"
  --npm-bin "$npm_bin"
)

if [ -n "$bootstrap_key" ]; then
  render_cmd+=(--bootstrap-key "$bootstrap_key")
fi

"${render_cmd[@]}"

env_path="${output_dir%/}/${service_name}.env"
service_path="${output_dir%/}/${service_name}.service"
caddyfile_path="${output_dir%/}/Caddyfile"
caddy_target="/etc/caddy/Caddyfile"
service_target="/etc/systemd/system/${service_name}.service"
env_target="${config_dir%/}/${service_name}.env"
bootstrap_key_value="$(sed -n 's/^AQUA_HOSTED_OWNER_BOOTSTRAP_KEY=//p' "$env_path" | head -n 1)"

ensure_group
ensure_user

if [ "$skip_caddy_install" -ne 1 ] && [ -f "$caddy_target" ] && ! cmp -s "$caddyfile_path" "$caddy_target"; then
  if [ "$overwrite_caddyfile" -ne 1 ] && ! is_safe_default_caddyfile "$caddy_target"; then
    echo "Refusing to overwrite existing ${caddy_target}." >&2
    echo "Review the generated file at ${caddyfile_path} or rerun with --overwrite-caddyfile." >&2
    exit 1
  fi
fi

echo "Installing env/service files..."
run_privileged install -d -m 0750 "$config_dir" "$data_dir" "$backup_dir"
run_privileged chown -R "${service_user}:${service_group}" "$data_dir" "$backup_dir"
run_privileged install -m 0600 "$env_path" "$env_target"
run_privileged chown "${service_user}:${service_group}" "$env_target"
run_privileged install -m 0644 "$service_path" "$service_target"

if [ "$skip_caddy_install" -ne 1 ]; then
  echo "Installing Caddyfile..."
  run_privileged install -m 0644 "$caddyfile_path" "$caddy_target"
fi

echo "Reloading systemd..."
run_privileged systemctl daemon-reload

if [ "$skip_start" -ne 1 ]; then
  echo "Starting services..."
  run_privileged systemctl enable --now "$service_name"
  run_privileged systemctl restart "$service_name"
  if [ "$skip_caddy_install" -ne 1 ]; then
    run_privileged systemctl enable --now caddy
    run_privileged systemctl reload caddy
  fi
else
  echo "Skipping service start because --skip-start was set."
fi

if [ "$skip_caddy_install" -eq 1 ] && [ "$skip_check" -ne 1 ]; then
  echo "Skipping hosted HTTP checks because --skip-caddy-install was set."
  skip_check=1
fi

if [ "$skip_check" -ne 1 ] && [ "$skip_start" -ne 1 ]; then
  echo "Running hosted HTTP checks..."
  npm run ops:check:hosted -- --base-url "$base_url"
fi

echo
echo "Hosted init completed."
echo "- Env file: ${env_target}"
echo "- Service file: ${service_target}"
if [ "$skip_caddy_install" -eq 1 ]; then
  echo "- Generated Caddyfile: ${caddyfile_path}"
else
  echo "- Caddyfile: ${caddy_target}"
fi
echo "- Bootstrap key: ${bootstrap_key_value}"
echo
echo "Next step:"
echo "npm run ops:bootstrap:hosted -- --base-url ${base_url} --config-env-file ${env_target}"
