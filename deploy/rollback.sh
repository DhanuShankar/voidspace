#!/bin/bash
# ============================================================================
# VOID Cloud IDE - Rollback Script
# Quickly rollback to previous stable deployment
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

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Rollback VOID Cloud IDE to a previous stable deployment

OPTIONS:
    --to-version VERSION    Rollback to specific version/tag
    --list                  List available rollback points
    --create-snapshot NAME  Create a snapshot before rolling back
    --restore SNAPSHOT      Restore from snapshot
    --help                  Show this help message

EXAMPLES:
    # Create snapshot and rollback
    $0 --create-snapshot pre-failure-$(date +%Y%m%d)

    # List available snapshots
    $0 --list

    # Restore from snapshot
    $0 --restore pre-failure-20240101

EOF
}

# Create backup snapshot
create_snapshot() {
    local snapshot_name="$1"
    local snapshot_dir="${PROJECT_ROOT}/backups/${snapshot_name}"

    log_info "Creating deployment snapshot: $snapshot_name"

    mkdir -p "$snapshot_dir"

    # Backup database
    log_info "Backing up database..."
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U void void > "${snapshot_dir}/database.sql" 2>/dev/null || {
        log_warning "Database backup failed"
    }

    # Backup volumes
    log_info "Backing up volumes..."
    docker run --rm -v void_postgres-data:/data -v "$(pwd)/backups/$snapshot_name:/backup" alpine tar czf /backup/postgres-data.tar.gz /data 2>/dev/null || true
    docker run --rm -v void_redis-data:/data -v "$(pwd)/backups/$snapshot_name:/backup" alpine tar czf /backup/redis-data.tar.gz /data 2>/dev/null || true

    # Save current image digests
    log_info "Saving container images..."
    docker images "void-*" --format "{{.Repository}}:{{.Tag}} {{.ID}}" > "${snapshot_dir}/images.txt" 2>/dev/null || true

    # Save current git commit
    git rev-parse HEAD > "${snapshot_dir}/git-commit.txt" 2>/dev/null || echo "unknown" > "${snapshot_dir}/git-commit.txt"

    # Save timestamp
    date -Iseconds > "${snapshot_dir}/timestamp.txt"

    log_success "Snapshot created: $snapshot_name"
    log_info "Location: $snapshot_dir"
}

# List available snapshots
list_snapshots() {
    log_info "Available snapshots:"
    echo ""

    if [ ! -d "${PROJECT_ROOT}/backups" ]; then
        log_warning "No backups directory found"
        return
    fi

    local found=false
    for snapshot in "${PROJECT_ROOT}/backups"/*; do
        if [ -d "$snapshot" ]; then
            local name=$(basename "$snapshot")
            local timestamp=$(cat "${snapshot}/timestamp.txt" 2>/dev/null || echo "Unknown")
            local git_commit=$(cat "${snapshot}/git-commit.txt" 2>/dev/null || echo "Unknown")
            echo "  $name"
            echo "    Created: $timestamp"
            echo "    Git:     $git_commit"
            echo ""
            found=true
        fi
    done

    if [ "$found" = false ]; then
        log_warning "No snapshots found"
    fi
}

# Restore from snapshot
restore_snapshot() {
    local snapshot_name="$1"
    local snapshot_dir="${PROJECT_ROOT}/backups/${snapshot_name}"

    if [ ! -d "$snapshot_dir" ]; then
        log_error "Snapshot not found: $snapshot_name"
        list_snapshots
        exit 1
    fi

    log_warning "===== ROLLBACK IN PROGRESS ====="
    log_warning "This will restore to snapshot: $snapshot_name"
    echo ""
    log_info "Current deployment will be stopped"
    log_info "Database will be restored from backup"
    log_info "Volumes will be restored"
    echo ""

    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log_info "Rollback cancelled"
        exit 0
    fi

    # Stop services
    log_info "Stopping all services..."
    docker-compose -f "$COMPOSE_FILE" down -v

    # Restore database
    if [ -f "${snapshot_dir}/database.sql" ]; then
        log_info "Restoring database..."
        # Start just postgres
        docker-compose -f "$COMPOSE_FILE" up -d postgres
        sleep 5

        # Wait for postgres
        until docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U void &>/dev/null; do
            sleep 1
        done

        # Restore
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void void < "${snapshot_dir}/database.sql" 2>/dev/null || {
            log_error "Database restore failed"
            exit 1
        }

        log_success "Database restored"
    fi

    # Restore volumes (if they exist)
    if [ -f "${snapshot_dir}/postgres-data.tar.gz" ]; then
        log_info "Restoring PostgreSQL data volume..."
        docker run --rm -v void_postgres-data:/data -v "$snapshot_dir:/backup" alpine tar xzf /backup/postgres-data.tar.gz || true
    fi

    if [ -f "${snapshot_dir}/redis-data.tar.gz" ]; then
        log_info "Restoring Redis data volume..."
        docker run --rm -v void_redis-data:/data -v "$snapshot_dir:/backup" alpine tar xzf /backup/redis-data.tar.gz || true
    fi

    # Restart all services
    log_info "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d

    log_success "Rollback complete!"
    log_info "The application is being restored to snapshot: $snapshot_name"
    log_info "Please wait a moment for services to become healthy."
}

# Quick rollback (stop and restart
rollback_quick() {
    log_warning "Quick Rollback - Stopping and restarting services"

    log_info "Stopping services..."
    docker-compose -f "$COMPOSE_FILE" down

    log_info "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d

    log_success "Services restarted"
    log_info "Use --create-snapshot for more controlled rollbacks"
}

# Main execution
main() {
    local action="quick"
    local snapshot_name=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --to-version)
                action="restore"
                snapshot_name="$2"
                shift 2
                ;;
            --list)
                action="list"
                shift
                ;;
            --create-snapshot)
                action="create"
                snapshot_name="$2"
                shift 2
                ;;
            --restore)
                action="restore"
                snapshot_name="$2"
                shift 2
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
    echo ""

    case "$action" in
        create)
            if [ -z "$snapshot_name" ]; then
                snapshot_name="rollback-$(date +%Y%m%d-%H%M%S)"
            fi
            create_snapshot "$snapshot_name"
            ;;
        list)
            list_snapshots
            ;;
        restore)
            restore_snapshot "$snapshot_name"
            ;;
        quick)
            rollback_quick
            ;;
    esac
}

print_banner() {
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🔄 VOID Cloud IDE - Rollback Manager                        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
}

main "$@"
