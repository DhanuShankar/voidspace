/bin/bash
# ============================================================================
# VOID Cloud IDE - SSL Certificate Setup Script
# Supports Let's Encrypt and self-signed certificates
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SSL_DIR="${PROJECT_ROOT}/nginx/ssl"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Setup SSL certificates for VOID Cloud IDE

OPTIONS:
    --self-signed         Generate self-signed certificates (development)
    --letsencrypt         Obtain certificates from Let's Encrypt (production)
    --domain DOMAIN       Domain name (required for Let's Encrypt)
    --email EMAIL         Email address for Let's Encrypt notifications
    --staging             Use Let's Encrypt staging environment
    --renew               Renew existing Let's Encrypt certificates
    --help                Show this help message

EXAMPLES:
    # Development - Self-signed
    $0 --self-signed

    # Production - Let's Encrypt
    $0 --letsencrypt --domain example.com --email admin@example.com

    # Staging environment (rate limit safe)
    $0 --letsencrypt --domain example.com --email admin@example.com --staging

    # Renew certificates
    $0 --renew --domain example.com --email admin@example.com

EOF
}

# Generate self-signed certificates
generate_self_signed() {
    log_info "Generating self-signed certificates..."

    mkdir -p "$SSL_DIR"

    # Generate private key
    openssl genrsa -out "${SSL_DIR}/privkey.pem" 2048 2>/dev/null

    # Generate CSR
    openssl req -new -key "${SSL_DIR}/privkey.pem" -out "${SSL_DIR}/csr.pem" -subj "
        C=US
        ST=State
        L=City
        O=Organization
        OU=Unit
        CN=localhost
    " 2>/dev/null

    # Generate self-signed certificate (valid for 1 year)
    openssl x509 -req -days 365 -in "${SSL_DIR}/csr.pem" -signkey "${SSL_DIR}/privkey.pem" -out "${SSL_DIR}/fullchain.pem" 2>/dev/null

    # Create chain file (same as fullchain for self-signed)
    cp "${SSL_DIR}/fullchain.pem" "${SSL_DIR}/chain.pem"

    # Set proper permissions
    chmod 600 "${SSL_DIR}/privkey.pem"
    chmod 644 "${SSL_DIR}/fullchain.pem"
    chmod 644 "${SSL_DIR}/chain.pem"

    log_success "Self-signed certificates generated"
    log_info "Certificates location: $SSL_DIR"
    log_warning "Browser will show a warning for self-signed certificates"
}

# Obtain Let's Encrypt certificates
obtain_letsencrypt() {
    local domain="$1"
    local email="$2"
    local staging="$3"

    log_info "Obtaining Let's Encrypt certificates for $domain..."

    mkdir -p "$SSL_DIR"
    mkdir -p "${PROJECT_ROOT}/.certbot"

    local certbot_args=(
        "certonly"
        "--standalone"
        "--non-interactive"
        "--agree-tos"
        "--email" "$email"
        "-d" "$domain"
        "--cert-name" "void-cloud-ide"
        "--expand"
    )

    if [ "$staging" = true ]; then
        log_info "Using Let's Encrypt staging environment..."
        certbot_args+=("--staging")
    fi

    # Use certbot with standalone mode (requires port 80)
    log_info "Running certbot... (requires port 80 to be available)"

    # Stop nginx temporarily if running
    if docker-compose -f "${PROJECT_ROOT}/docker-compose.yml" ps | grep -q nginx; then
        log_info "Stopping nginx temporarily..."
        docker-compose -f "${PROJECT_ROOT}/docker-compose.yml" stop nginx
    fi

    # Run certbot
    certbot "${certbot_args[@]}" || {
        log_error "Failed to obtain certificate"
        log_info "Make sure port 80 is available and domain points to this server"
        exit 1
    }

    # Copy certificates to nginx directory
    local cert_dir="/etc/letsencrypt/live/$domain"
    if [ -d "$cert_dir" ]; then
        cp "${cert_dir}/privkey.pem" "${SSL_DIR}/"
        cp "${cert_dir}/fullchain.pem" "${SSL_DIR}/"
        cp "${cert_dir}/chain.pem" "${SSL_DIR}/"

        chmod 600 "${SSL_DIR}/privkey.pem"
        chmod 644 "${SSL_DIR}/fullchain.pem"
        chmod 644 "${SSL_DIR}/chain.pem"

        log_success "Certificates obtained and copied"
    else
        log_error "Certificate directory not found"
        exit 1
    fi

    # Restart nginx if it was running
    if docker-compose -f "${PROJECT_ROOT}/docker-compose.yml" ps | grep -q nginx; then
        log_info "Restarting nginx..."
        docker-compose -f "${PROJECT_ROOT}/docker-compose.yml" start nginx
    fi

    # Set up auto-renewal
    setup_cron_renewal "$domain" "$email" "$staging"
}

# Set up cron job for automatic certificate renewal
setup_cron_renewal() {
    local domain="$1"
    local email="$2"
    local staging="$3"

    log_info "Setting up automatic certificate renewal..."

    local cron_job="0 12 * * * certbot renew --quiet"

    if [ "$staging" = true ]; then
        cron_job="${cron_job} --staging"
    fi

    (crontab -l 2>/dev/null | grep -v "certbot" || true; echo "$cron_job") | crontab -

    log_success "Auto-renewal configured"
}

# Renew existing certificates
renew_certificates() {
    local domain="$1"
    local staging="$2"

    log_info "Renewing Let's Encrypt certificates..."

    local renew_args=("renew" "--quiet")

    if [ "$staging" = true ]; then
        renew_args+=("--staging")
    fi

    certbot "${renew_args[@]}"

    # Copy renewed certificates
    local cert_dir="/etc/letsencrypt/live/$domain"
    cp "${cert_dir}/privkey.pem" "${SSL_DIR}/"
    cp "${cert_dir}/fullchain.pem" "${SSL_DIR}/"
    cp "${cert_dir}/chain.pem" "${SSL_DIR}/"

    chmod 600 "${SSL_DIR}/privkey.pem"
    chmod 644 "${SSL_DIR}/fullchain.pem"
    chmod 644 "${SSL_DIR}/chain.pem"

    log_success "Certificates renewed"

    # Reload nginx
    if [ -f "${PROJECT_ROOT}/docker-compose.yml" ]; then
        log_info "Reloading nginx..."
        docker-compose -f "${PROJECT_ROOT}/docker-compose.yml" exec nginx nginx -s reload || true
    fi
}

# Validate certificates
validate_certificates() {
    if [ ! -f "${SSL_DIR}/fullchain.pem" ]; then
        log_error "No certificates found at $SSL_DIR"
        exit 1
    fi

    log_info "Certificate information:"

    if command -v openssl &> /dev/null; then
        openssl x509 -in "${SSL_DIR}/fullchain.pem" -noout -subject -dates
        log_success "Certificates are valid"
    else
        log_warning "OpenSSL not available for validation"
    fi
}

# Main execution
main() {
    local mode=""
    local domain=""
    local email=""
    local staging=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --self-signed)
                mode="self-signed"
                shift
                ;;
            --letsencrypt)
                mode="letsencrypt"
                shift
                ;;
            --domain)
                domain="$2"
                shift 2
                ;;
            --email)
                email="$2"
                shift 2
                ;;
            --staging)
                staging=true
                shift
                ;;
            --renew)
                mode="renew"
                shift
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    print_banner

    case "$mode" in
        self-signed)
            generate_self_signed
            ;;
        letsencrypt)
            if [ -z "$domain" ] || [ -z "$email" ]; then
                log_error "Domain and email are required for Let's Encrypt"
                usage
                exit 1
            fi
            obtain_letsencrypt "$domain" "$email" "$staging"
            ;;
        renew)
            if [ -z "$domain" ]; then
                log_error "Domain is required for renewal"
                usage
                exit 1
            fi
            renew_certificates "$domain" "$staging"
            ;;
        *)
            log_error "No mode specified. Use --self-signed, --letsencrypt, or --renew"
            usage
            exit 1
            ;;
    esac

    validate_certificates
    log_success "SSL setup complete!"
}

print_banner() {
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🔒 VOID Cloud IDE - SSL Certificate Setup                  ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
}

main "$@"
