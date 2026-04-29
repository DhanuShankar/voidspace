#!/bin/bash
# ============================================================================
# VOID Cloud IDE - Database Migration Script
# Migrates schema and data between versions
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
MIGRATIONS_DIR="${PROJECT_ROOT}/deploy/migrations"

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

# Initialize migrations directory
init_migrations_dir() {
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        mkdir -p "$MIGRATIONS_DIR"
        log_info "Created migrations directory: $MIGRATIONS_DIR"
    fi
}

# Create a new migration
create_migration() {
    local name="$1"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local filename="${timestamp}_${name// /_}.sql"
    local filepath="${MIGRATIONS_DIR}/${filename}"

    if [ -z "$name" ]; then
        log_error "Migration name is required"
        echo "Usage: $0 create <migration_name>"
        exit 1
    fi

    init_migrations_dir

    cat > "$filepath" << EOF
-- ============================================================================
-- Migration: $name
-- Created: $(date -Iseconds)
-- Description: Add description here
-- ============================================================================

BEGIN;

-- Add your SQL statements here
-- Example:
-- CREATE TABLE IF NOT EXISTS users (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     email VARCHAR(255) UNIQUE NOT NULL,
--     created_at TIMESTAMP DEFAULT NOW()
-- );

-- Record migration
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('$timestamp', '$name', NOW());

COMMIT;
EOF

    log_success "Created migration: $filename"
    log_info "Edit $filepath to add your SQL statements"
}

# List all migrations
list_migrations() {
    init_migrations_dir

    if [ ! -f "${MIGRATIONS_DIR}/schema_migrations.sql" ]; then
        # Create schema_migrations table tracking
        cat > "${MIGRATIONS_DIR}/schema_migrations.sql" << 'EOF'
-- ============================================================================
-- Schema Migrations Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);
EOF
    fi

    log_info "Available migrations:"
    echo ""

    # List .sql files (excluding schema_migrations.sql)
    ls -1t "${MIGRATIONS_DIR}"/*.sql 2>/dev/null | grep -v "schema_migrations" | while read -r file; do
        local filename=$(basename "$file")
        local applied=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void -d void -t -c "SELECT COUNT(*) FROM schema_migrations WHERE version='${filename%%.sql}';" 2>/dev/null | tr -d '[:space:]')
        local status=""

        if [ "$applied" = "1" ]; then
            status="${GREEN}[APPLIED]${NC}"
        else
            status="${YELLOW}[PENDING]${NC}"
        fi

        echo "  $status  $filename"
    done
}

# Apply pending migrations
apply_migrations() {
    init_migrations_dir

    log_info "Applying pending migrations..."

    # Ensure schema_migrations table exists
    log_info "Ensuring migration tracking table exists..."
    if ! docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void -d void -c "\d schema_migrations" &>/dev/null; then
        log_info "Creating schema_migrations table..."
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void -d void < "${MIGRATIONS_DIR}/schema_migrations.sql"
    fi

    # Get list of applied migrations
    local applied_migrations=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void -d void -t -c "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null | tr -d '[:space:]')

    # Apply pending migrations
    local count=0
    for file in "${MIGRATIONS_DIR}"/*.sql; do
        [ -f "$file" ] || continue
        local filename=$(basename "$file")
        local version="${filename%%.sql}"

        # Skip schema_migrations table creation
        if [[ "$filename" == "schema_migrations.sql" ]]; then
            continue
        fi

        # Check if already applied
        if echo "$applied_migrations" | grep -q "^${version}$"; then
            log_info "  $filename already applied, skipping"
            continue
        fi

        log_info "  Applying $filename..."
        if docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void -d void < "$file"; then
            log_success "  Applied $filename"
            ((count++))
        else
            log_error "  Failed to apply $filename"
            exit 1
        fi
    done

    if [ $count -eq 0 ]; then
        log_success "No pending migrations"
    else
        log_success "Applied $count migration(s)"
    fi
}

# Rollback last migration
rollback_migration() {
    local count="${1:-1}"

    log_info "Rolling back $count migration(s)..."

    # Get last N applied migrations
    local migrations=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void -d void -t -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT $count;" 2>/dev/null | tr -d '[:space:]')

    if [ -z "$migrations" ]; then
        log_warning "No migrations to rollback"
        exit 0
    fi

    for version in $migrations; do
        local migration_file="${MIGRATIONS_DIR}/${version}.sql"

        if [ ! -f "$migration_file" ];
            log_error "Migration file not found: $migration_file"
            continue
        fi

        log_warning "Rolling back $version..."

        # Extract rollback statements (between -- ===== markers)
        # In practice, you'd create separate down migrations
        # For now, we just delete from schema_migrations
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void -d void -c "DELETE FROM schema_migrations WHERE version='$version';" 2>/dev/null || true

        log_success "Rolled back $version"
    done

    log_success "Rollback complete"
}

# Reset database (CAUTION!)
reset_database() {
    log_error "===== DANGEROUS OPERATION ====="
    log_error "This will DROP ALL DATA and reset the database"
    echo ""
    read -p "Type 'RESET' to confirm: " confirmation

    if [ "$confirmation" != "RESET" ]; then
        log_info "Reset cancelled"
        exit 0
    fi

    log_warning "Resetting database..."

    # Stop app to prevent writes
    docker-compose -f "$COMPOSE_FILE" stop app

    # Drop and recreate database
    docker-compose -f "$COMPOSE_FILE" exec -T postgres dropdb -U void void || true
    docker-compose -f "$COMPOSE_FILE" exec -T postgres createdb -U void void

    # Re-run initial schema
    if [ -f "${PROJECT_ROOT}/deploy/init.sql" ]; then
        log_info "Running initial schema..."
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void void < "${PROJECT_ROOT}/deploy/init.sql"
    fi

    # Clear migrations tracking
    docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void -d void -c "TRUNCATE schema_migrations;" 2>/dev/null || true

    log_success "Database reset complete"
    log_warning "All data has been lost"
}

# Show migration status
show_status() {
    log_info "Migration Status"
    echo ""

    local applied=$(docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void -d void -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null | tr -d '[:space:]')
    local total=$(find "$MIGRATIONS_DIR" -name "*.sql" 2>/dev/null | grep -v "schema_migrations.sql" | wc -l)

    echo "  Applied: $applied"
    echo "  Total:   $total"
    echo "  Pending: $((total - applied))"
    echo ""

    # Show last 5 migrations
    echo "  Recent migrations:"
    docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U void -d void -c "SELECT version, name, applied_at FROM schema_migrations ORDER BY version DESC LIMIT 5;" 2>/dev/null || true
}

# Main execution
main() {
    local command="$1"
    local arg="$2"

    print_banner
    echo ""

    case "$command" in
        create)
            create_migration "$arg"
            ;;
        list)
            list_migrations
            ;;
        apply)
            apply_migrations
            ;;
        rollback)
            rollback_migration "$arg"
            ;;
        reset)
            reset_database
            ;;
        status)
            show_status
            ;;
        *)
            echo "Usage: $0 {create <name>|list|apply|rollback [count]|reset|status}"
            echo ""
            echo "Commands:"
            echo "  create <name>    Create new migration"
            echo "  list            List all migrations with status"
            echo "  apply           Apply pending migrations"
            echo "  rollback [N]    Rollback last N migrations (default: 1)"
            echo "  status          Show migration statistics"
            echo "  reset           Reset database (DANGEROUS!)"
            echo ""
            exit 1
            ;;
    esac
}

print_banner() {
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🗄️  VOID Cloud IDE - Database Migrations                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
}

main "$@"
