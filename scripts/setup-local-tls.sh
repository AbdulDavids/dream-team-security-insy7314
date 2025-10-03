#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "$0")" >/dev/null 2>&1 && pwd -P)"
CERT_DIR="${LOCAL_TLS_DIR:-$SCRIPT_DIR/../certs}"
KEY_PATH="${LOCAL_TLS_KEY:-$CERT_DIR/localhost-key.pem}"
CERT_PATH="${LOCAL_TLS_CERT:-$CERT_DIR/localhost-cert.pem}"

log() {
  printf '[tls:setup] %s\n' "$1"
}

ensure_openssl() {
  if command -v openssl >/dev/null 2>&1; then
    return
  fi

  log 'openssl is required but was not found on PATH.'
  log 'Install OpenSSL and re-run, or create certificates manually.'
  exit 1
}

ensure_directory() {
  mkdir -p "$CERT_DIR"
}

certificates_exist() {
  [[ -f "$KEY_PATH" && -f "$CERT_PATH" ]]
}

create_certificate() {
  log "Generating self-signed certificate in $CERT_DIR"
  openssl req \
    -x509 \
    -nodes \
    -days "${LOCAL_TLS_DAYS:-365}" \
    -newkey rsa:2048 \
    -keyout "$KEY_PATH" \
    -out "$CERT_PATH" \
    -subj "${LOCAL_TLS_SUBJECT:-/C=US/ST=Local/L=Local/O=Dev/OU=Dev/CN=localhost}" >/dev/null 2>&1
  log "Created:"
  log " - $KEY_PATH"
  log " - $CERT_PATH"
}

main() {
  ensure_openssl
  ensure_directory

  if certificates_exist; then
    log 'Existing certificate found. Skipping regeneration.'
    exit 0
  fi

  create_certificate
  log 'Remember to trust the generated certificate in your OS/browser for a warning-free experience.'
}

main "$@"
