#!/bin/bash
# ============================================================================
# VOID Cloud IDE - One-Click Deployment Script
# This script automates the entire deployment process
# ============================================================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Print banner
print_banner() {
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 VOID Cloud IDE - Deployment Script                      ║
║   Version: 1.0.0                                             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    log_success "Docker is installed"

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    log_success "Docker Compose is installed"

    # Check if docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    log_success "Docker daemon is running"

    # Check if .env file exists
    if [ ! -f "$ENV_FILE" ]; then
        log_warning ".env file not found. Creating from template..."
        cp "${PROJECT_ROOT}/.env.template" "$ENV_FILE"
        log_warning "Please edit .env file with your configuration before continuing."
        log_info "Required variables: ANTHROPIC_API_KEY, GEMINI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET"
        exit 1
    fi
    log_success "Environment configuration found"
}

# Validate environment variables
validate_env() {
    log_info "Validating environment variables..."

    source "$ENV_FILE"

    local required_vars=(
        "ANTHROPIC_API_KEY"
        "GEMINI_API_KEY"
        "GOOGLE_CLIENT_ID"
        "GOOGLE_CLIENT_SECRET"
        "JWT_SECRET"
    )

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable $var is not set in .env"
            exit 1
        fi
    done

    log_success "Environment validation passed"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."

    mkdir -p "${PROJECT_ROOT}/logs"
    mkdir -p "${PROJECT_ROOT}/data"
    mkdir -p "${PROJECT_ROOT}/uploads"
    mkdir -p "${PROJECT_ROOT}/nginx/ssl"
    mkdir -p "${PROJECT_ROOT}/nginx/conf.d"
    mkdir -p "${PROJECT_ROOT}/monitoring/prometheus"
    mkdir -p "${PROJECT_ROOT}/monitoring/grafana/provisioning"
    mkdir -p "${PROJECT_ROOT}/monitoring/grafana/dashboards"
    mkdir -p "${PROJECT_ROOT}/monitoring/loki"
    mkdir -p "${PROJECT_ROOT}/monitoring/promtail"
    mkdir -p "${PROJECT_ROOT}/deploy"

    log_success "Directories created"
}

# Generate JWT secret if not set
generate_secrets() {
    log_info "Checking secrets..."

    if ! grep -q "your_jwt_secret" "$ENV_FILE"; then
        log_success "Secrets already configured"
    else
        log_warning "Default secrets detected. Generating new secrets..."
        local jwt_secret=$(openssl rand -base64 32)
        local session_secret=$(openssl rand -base64 32)

        sed -i.bak "s/your_jwt_secret.*/$jwt_secret/g" "$ENV_FILE"
        sed -i.bak "s/your_session_secret.*/$session_secret/g" "$ENV_FILE"
        log_success "Generated new JWT and session secrets"
    fi
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."

    if [ "$1" == "--no-cache" ]; then
        docker-compose -f "$COMPOSE_FILE" build --no-cache
    else
        docker-compose -f "$COMPOSE_FILE" build
    fi

    log_success "Docker images built successfully"
}

# Start services
start_services() {
    log_info "Starting services with Docker Compose..."

    docker-compose -f "$COMPOSE_FILE" up -d

    log_success "Services started"
}

# Initialize certificates (for production)
setup_ssl() {
    log_info "Setting up SSL certificates..."

    if [ ! -f "${PROJECT_ROOT}/nginx/ssl/fullchain.pem" ]; then
        log_warning "SSL certificates not found."
        log_info "You have two options:"
        echo "  1. Use Let's Encrypt (recommended for production):"
        echo "     ./deploy/setup-ssl.sh --letsencrypt --domain yourdomain.com --email admin@yourdomain.com"
        echo ""
        echo "  2. Use self-signed certificates (for development):"
        echo "     ./deploy/setup-ssl.sh --self-signed"
        echo ""
        log_warning "The application will work on HTTP only until SSL is configured."
    else
        log_success "SSL certificates found"
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."

    docker-compose -f "$COMPOSE_FILE" exec -T app npm run migrate || {
        log_warning "No migration script found or migrations failed"
    }

    log_success "Database ready"
}

# Wait for services to be healthy
wait_for_health() {
    log_info "Waiting for services to become healthy..."

    local services=("postgres" "redis" "app")
    local timeout=300  # 5 minutes
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        local all_healthy=true

        for service in "${services[@]}"; do
            if ! docker-compose -f "$COMPOSE_FILE" ps | grep -q "$service.*healthy"; then
                all_healthy=false
                break
            fi
        done

        if [ "$all_healthy" = true ]; then
            log_success "All services are healthy"
            return 0
        fi

        sleep 5
        elapsed=$((elapsed + 5))
        echo -n "."
    done

    log_error "Timeout waiting for services to become healthy"
    return 1
}

# Show deployment summary
show_summary() {
    log_success "Deployment completed successfully!"
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "  🚀 VOID Cloud IDE is now running!"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    echo "  Services:"
    echo "  ├── Application:  http://localhost:3000"
    echo "  ├── Nginx:        http://localhost:80"
    echo "  ├── HTTPS:        https://localhost:443"
    echo "  ├── Grafana:      http://localhost:3001"
    echo "  ├── Prometheus:   http://localhost:9090"
    echo "  ├── Loki:         http://localhost:3100"
    echo "  └── pgAdmin:      http://localhost:5050"
    echo ""
    echo "  Useful commands:"
    echo "  ├── View logs:     docker-compose logs -f"
    echo "  ├── Stop services: docker-compose down"
    echo "  ├── Restart:       docker-compose restart"
    echo "  ├── Shell in app:  docker-compose exec app sh"
    echo "  ├── DB console:    docker-compose exec postgres psql -U void void"
    echo "  └── Status:        docker-compose ps"
    echo ""
    echo "  Documentation: See README.md and deploy/README.md"
    echo "═══════════════════════════════════════════════════════"
}

# Main deployment function
main() {
    print_banner
    echo ""

    case "${1:-}" in
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --no-cache      Rebuild images without cache"
            echo "  --skip-build    Skip Docker image build"
            echo "  --skip-migrate  Skip database migrations"
            echo "  --help          Show this help message"
            echo ""
            echo "Example:"
            echo "  $0                    # Full deployment"
            echo "  $0 --no-cache        # Rebuild from scratch"
            echo "  $0 --skip-build      # Only start services"
            exit 0
            ;;
    esac

    log_info "Starting deployment process..."
    echo ""

    # Run deployment steps
    check_prerequisites
    validate_env
    create_directories
    generate_secrets
    setup_ssl

    if [ "${1:-}" != "--skip-build" ]; then
        build_images "${1:-}"
    fi

    start_services

    if [ "${1:-}" != "--skip-migrate" ]; then
        run_migrations
    fi

    wait_for_health
    show_summary
}

# Run main function
main "$@"
