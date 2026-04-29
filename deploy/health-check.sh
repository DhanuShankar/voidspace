#!/bin/bash
# ============================================================================
# VOID Cloud IDE - Health Check & Monitoring Script
# Checks all services and reports status
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

print_banner() {
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🔍 VOID Cloud IDE - Health Check                           ║
║   $(date +'%Y-%m-%d %H:%M:%S')                               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
}

# Check if Docker is running
check_docker() {
    log_info "Checking Docker daemon..."
    if docker info &> /dev/null; then
        log_success "Docker is running"
        return 0
    else
        log_error "Docker daemon is not running"
        return 1
    fi
}

# Check all container health status
check_containers() {
    log_info "Checking container health status..."
    echo ""

    local containers=("postgres" "redis" "app" "nginx")
    local all_healthy=true

    for container in "${containers[@]}"; do
        local status=$(docker-compose -f "$COMPOSE_FILE" ps -q "$container" 2>/dev/null)

        if [ -z "$status" ]; then
            log_error "$container: Not running"
            all_healthy=false
            continue
        fi

        local health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-check{{end}}' "$status" 2>/dev/null)

        if [ "$health" = "healthy" ]; then
            log_success "$container: Healthy"
        elif [ "$health" = "starting" ]; then
            log_warning "$container: Starting..."
            all_healthy=false
        elif [ "$health" = "unhealthy" ]; then
            log_error "$container: Unhealthy"
            all_healthy=false
        elif [ "$health" = "no-check" ]; then
            # No health check defined, check if running
            local state=$(docker inspect --format='{{.State.Status}}' "$status")
            if [ "$state" = "running" ]; then
                log_success "$container: Running (no health check)"
            else
                log_error "$container: $state"
                all_healthy=false
            fi
        else
            log_error "$container: Unknown status - $health"
            all_healthy=false
        fi
    done

    echo ""
    return $([ "$all_healthy" = true ] && echo 0 || echo 1)
}

# Check application endpoints
check_endpoints() {
    log_info "Checking application endpoints..."
    echo ""

    local endpoints=(
        "http://localhost/api/health:Health API"
        "http://localhost:3000/api/gateways/health:Gateway Health"
    )

    for endpoint in "${endpoints[@]}"; do
        IFS=':' read -r url name <<< "$endpoint"
        local code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

        if [ "$code" = "200" ] || [ "$code" = "204" ]; then
            log_success "$name: OK (HTTP $code)"
        else
            log_error "$name: Failed (HTTP $code)"
        fi
    done

    echo ""
}

# Check resource usage
check_resources() {
    log_info "Checking resource usage..."
    echo ""

    # Docker stats
    echo "Container Resource Usage:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null || true
    echo ""

    # Disk usage
    log_info "Disk usage for volumes:"
    df -h | grep -E "(Docker|/var/lib/docker)" || true
    echo ""
}

# Check logs for errors
check_logs() {
    log_info "Checking recent logs for errors..."
    echo ""

    local timeframe="${1:-10m}"

    log_info "Last 20 error/warning entries:"
    docker-compose -f "$COMPOSE_FILE" logs --since "$timeframe" 2>&1 | \
        grep -iE "(error|warn|exception|fail)" | \
        tail -n 20 || echo "No errors found"

    echo ""
}

# Database connectivity check
check_database() {
    log_info "Checking database connectivity..."
    echo ""

    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U void &> /dev/null; then
        log_success "PostgreSQL: Connected"

        # Check database stats
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void -d void -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null | tail -n 1 || true
    else
        log_error "PostgreSQL: Connection failed"
    fi

    echo ""
}

# Redis connectivity check
check_redis() {
    log_info "Checking Redis connectivity..."
    echo ""

    if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping &> /dev/null; then
        log_success "Redis: Connected"
        docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli info stats | grep total_connections_received || true
    else
        log_error "Redis: Connection failed"
    fi

    echo ""
}

# Generate health report
generate_report() {
    log_info "Generating health report..."
    echo ""

    local report_file="${PROJECT_ROOT}/logs/health-$(date +%Y%m%d-%H%M%S).txt"

    {
        echo "═══════════════════════════════════════════════════════════"
        echo "  VOID Cloud IDE - Health Report"
        echo "  Generated: $(date)"
        echo "═══════════════════════════════════════════════════════════"
        echo ""
        echo "System Information:"
        echo "  Hostname: $(hostname)"
        echo "  Uptime: $(uptime -p 2>/dev/null || echo 'N/A')"
        echo ""
        echo "Service Status:"
        docker-compose -f "$COMPOSE_FILE" ps
        echo ""
        echo "Resource Usage:"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null || true
        echo ""
        echo "Log Summary (errors):"
        docker-compose -f "$COMPOSE_FILE" logs --since 1h 2>&1 | grep -iE "(error|exception)" | tail -n 10 || echo "No errors"
        echo ""
        echo "═══════════════════════════════════════════════════════════"
    } > "$report_file"

    log_success "Health report saved to: $report_file"
}

# Main execution
main() {
    print_banner
    echo ""

    local exit_code=0

    check_docker || exit_code=1
    echo ""

    check_containers || exit_code=1
    echo ""

    check_endpoints || exit_code=1
    echo ""

    check_database || exit_code=1
    echo ""

    check_redis || exit_code=1
    echo ""

    check_resources
    echo ""

    check_logs "${1:-10m}"
    echo ""

    generate_report

    if [ $exit_code -eq 0 ]; then
        log_success "All checks passed!"
        exit 0
    else
        log_warning "Some checks failed. Review the output above."
        exit 1
    fi
}

main "$@"
