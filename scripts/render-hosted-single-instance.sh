#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Render a ready-to-install single-instance AquaClaw hosted config bundle.

Usage:
  scripts/render-hosted-single-instance.sh --domain aqua.example.com [options]

Required:
  --domain DOMAIN                 Public domain or subdomain for AquaClaw.

Optional:
  --output-dir PATH               Where to write generated files.
                                  Default: ./.deploy/hosted-single-instance
  --repo-root PATH                Repo path on the target server.
                                  Default: /opt/gateway-hub
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
  --bootstrap-key KEY             Hosted owner bootstrap key. If omitted, a key is generated.
  --npm-bin PATH                  npm path used by systemd ExecStart.
                                  Default: /usr/bin/npm
  --help                          Show this help text.

Generated files:
  <output-dir>/<service-name>.env
  <output-dir>/<service-name>.service
  <output-dir>/Caddyfile
  <output-dir>/DEPLOYMENT_SUMMARY.md
EOF
}

generate_bootstrap_key() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
    return 0
  fi

  LC_ALL=C od -An -N24 -tx1 /dev/urandom | tr -d ' \n'
}

domain=""
output_dir="./.deploy/hosted-single-instance"
repo_root="/opt/gateway-hub"
service_name="gateway-hub"
service_user="gateway-hub"
service_group=""
config_dir="/etc/gateway-hub"
data_dir="/var/lib/gateway-hub"
backup_dir="/var/backups/gateway-hub"
app_host="127.0.0.1"
app_port="8787"
bootstrap_key=""
npm_bin="/usr/bin/npm"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --domain)
      domain="${2:-}"
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
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
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

if [ -z "$bootstrap_key" ]; then
  bootstrap_key="$(generate_bootstrap_key)"
fi

if ! printf '%s' "$app_port" | grep -Eq '^[0-9]+$' || [ "$app_port" -le 0 ]; then
  echo "--app-port must be a positive integer" >&2
  exit 1
fi

db_path="${data_dir%/}/${service_name}.sqlite"
env_path="${output_dir%/}/${service_name}.env"
service_path="${output_dir%/}/${service_name}.service"
caddyfile_path="${output_dir%/}/Caddyfile"
summary_path="${output_dir%/}/DEPLOYMENT_SUMMARY.md"
env_target_path="${config_dir%/}/${service_name}.env"
service_target_path="/etc/systemd/system/${service_name}.service"
caddy_target_path="/etc/caddy/Caddyfile"
public_aquarium_root="${repo_root%/}/apps/public-aquarium/dist"

mkdir -p "$output_dir"

cat >"$env_path" <<EOF
HOST=${app_host}
PORT=${app_port}
AQUA_DEPLOYMENT_MODE=hosted
GATEWAY_STORE_BACKEND=sqlite
DATABASE_URL=${db_path}
AQUA_HOSTED_OWNER_BOOTSTRAP_KEY=${bootstrap_key}
EOF

cat >"$service_path" <<EOF
[Unit]
Description=AquaClaw Gateway Hub
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${service_user}
Group=${service_group}
WorkingDirectory=${repo_root}/apps/hub-server
Environment=NODE_ENV=production
EnvironmentFile=${env_target_path}
ExecStart=${npm_bin} run start
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

cat >"$caddyfile_path" <<EOF
${domain} {
  encode zstd gzip

  root * ${public_aquarium_root}

  handle /api/* {
    reverse_proxy ${app_host}:${app_port} {
      flush_interval -1
    }
  }

  handle /health {
    reverse_proxy ${app_host}:${app_port} {
      flush_interval -1
    }
  }

  handle /ready {
    reverse_proxy ${app_host}:${app_port} {
      flush_interval -1
    }
  }

  handle {
    try_files {path} /index.html
    file_server
  }
}
EOF

cat >"$summary_path" <<EOF
# AquaClaw Hosted Single-Instance Bundle

Generated for domain: \`${domain}\`

## Files

- Env file: \`${env_path}\`
- systemd unit: \`${service_path}\`
- Caddyfile: \`${caddyfile_path}\`

## Target paths

- Env file target: \`${env_target_path}\`
- systemd target: \`${service_target_path}\`
- Caddyfile target: \`${caddy_target_path}\`
- SQLite target: \`${db_path}\`
- Backup dir: \`${backup_dir}\`
- Public aquarium root: \`${public_aquarium_root}\`

## Hosted owner bootstrap key

\`${bootstrap_key}\`

Keep this secret. Anyone who has it can bootstrap the hosted owner session.

## Suggested install commands

\`\`\`bash
sudo install -d -m 0750 ${config_dir} ${data_dir} ${backup_dir}
sudo install -m 0600 ${env_path} ${env_target_path}
sudo install -m 0644 ${service_path} ${service_target_path}
sudo install -m 0644 ${caddyfile_path} ${caddy_target_path}
\`\`\`

This Caddyfile serves \`${public_aquarium_root}\` as the anonymous public aquarium and only proxies \`/api/*\`, \`/health\`, and \`/ready\` to \`${app_host}:${app_port}\`.
Keep the API \`handle\` blocks ahead of the SPA fallback; otherwise \`/api/*\` can be rewritten to \`/index.html\` and the public page will fail to refresh.

## Suggested hosted ops commands

\`\`\`bash
cd ${repo_root}
npm run ops:check:hosted -- --base-url https://${domain}
npm run ops:backup:hosted -- --config-env-file ${env_target_path} --backup-dir ${backup_dir} --service ${service_name}
npm run ops:restore:hosted -- --config-env-file ${env_target_path} --snapshot <snapshot-path> --service ${service_name} --owner ${service_user} --group ${service_group} --base-url https://${domain}
npm run ops:deploy:hosted -- --repo-root ${repo_root} --config-env-file ${env_target_path} --service ${service_name} --backup-dir ${backup_dir} --base-url https://${domain}
\`\`\`

If \`${caddy_target_path}\` already contains other sites, merge this site block instead of overwriting the whole file.

\`\`\`bash
sudo systemctl daemon-reload
sudo systemctl enable --now ${service_name}
sudo systemctl reload caddy
\`\`\`
EOF

echo "Rendered hosted bundle:"
echo "  env:      ${env_path}"
echo "  service:  ${service_path}"
echo "  caddy:    ${caddyfile_path}"
echo "  summary:  ${summary_path}"
echo "  bootstrap key: ${bootstrap_key}"
