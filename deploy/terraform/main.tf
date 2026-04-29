# ============================================================================
# VOID Cloud IDE - Terraform Configuration
# Infrastructure as Code for Google Cloud Run
# ============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
  }
}

# ============================================================================
# Google Cloud Provider Configuration
# ============================================================================
provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ============================================================================
# Project Setup
# ============================================================================
resource "google_project_service" "run" {
  service = "run.googleapis.com"
}

resource "google_project_service" "cloudbuild" {
  service = "cloudbuild.googleapis.com"
}

resource "google_project_service" "secretmanager" {
  service = "secretmanager.googleapis.com"
}

resource "google_project_service" "vpcaccess" {
  service = "vpcaccess.googleapis.com"
}

# ============================================================================
# Service Account
# ============================================================================
resource "google_service_account" "void_service_account" {
  account_id   = "void-service-account"
  display_name = "VOID Cloud IDE Service Account"
  description  = "Service account for VOID Cloud IDE Cloud Run service"
}

# IAM Roles
resource "google_project_iam_member" "void_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.void_service_account.email}"
}

resource "google_project_iam_member" "void_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.void_service_account.email}"
}

resource "google_project_iam_member" "void_vpcaccess_user" {
  project = var.project_id
  role    = "roles/vpcaccess.user"
  member  = "serviceAccount:${google_service_account.void_service_account.email}"
}

# ============================================================================
# Secrets Management
# ============================================================================
resource "google_secret_manager_secret" "database_url" {
  secret_id = "void-db-credentials"
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret" "redis_url" {
  secret_id = "void-redis-credentials"
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret" "api_keys" {
  secret_id = "void-api-keys"
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret" "oauth_credentials" {
  secret_id = "void-oauth-credentials"
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "void-jwt-secret"
  replication {
    automatic = true
  }
}

# ============================================================================
# VPC Connector (for private networking)
# ============================================================================
resource "google_vpc_access_connector" "void_connector" {
  name          = "void-vpc-connector"
  ip_cidr_range = "10.8.0.0/28"
  region        = var.region
}

# ============================================================================
# Cloud Run Service
# ============================================================================
resource "google_cloud_run_service" "void_app" {
  name     = var.service_name
  location = var.region

  template {
    spec {
      containers {
        image = var.container_image

        env {
          name  = "NODE_ENV"
          value = "production"
        }
        env {
          name  = "PORT"
          value = "3000"
        }
        env {
          name  = "HOST"
          value = "0.0.0.0"
        }

        # Database connection
        env {
          name = "DATABASE_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.database_url.secret_id
              key  = "latest"
            }
          }
        }

        # Redis connection
        env {
          name = "REDIS_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.redis_url.secret_id
              key  = "latest"
            }
          }
        }

        # API Keys
        env {
          name = "ANTHROPIC_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.api_keys.secret_id
              key  = "anthropic"
            }
          }
        }

        env {
          name = "GEMINI_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.api_keys.secret_id
              key  = "gemini"
            }
          }
        }

        # OAuth
        env {
          name = "GOOGLE_CLIENT_ID"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.oauth_credentials.secret_id
              key  = "client-id"
            }
          }
        }

        env {
          name = "GOOGLE_CLIENT_SECRET"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.oauth_credentials.secret_id
              key  = "client-secret"
            }
          }
        }

        # Secrets
        env {
          name = "JWT_SECRET"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.jwt_secret.secret_id
              key  = "latest"
            }
          }
        }
      }

      service_account_name = google_service_account.void_service_account.email

      timeout_seconds     = 3600
      max_instance_count  = var.max_instances
      min_instance_count  = var.min_instances
      container_concurrency = var.concurrency
    }

    metadata {
      annotations = {
        "run.googleapis.com/ingress"                    = "all"
        "run.googleapis.com/ingress-status"             = "all"
        "run.googleapis.com/client-name"                = "cloud-run-client"
        "run.googleapis.com/vpc-access-connector"       = google_vpc_access_connector.void_connector.name
        "run.googleapis.com/vpc-access-connector-egress" = "private-ranges-only"
      }
    }
  }

  metadata {
    name = var.service_name
    labels = {
      environment = var.environment
      managed-by  = "terraform"
    }
  }

  depends_on = [
    google_project_service.run,
    google_project_service.secretmanager,
    google_project_service.vpcaccess
  ]
}

# ============================================================================
# Cloud Run Service IAM
# ============================================================================
resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_service.void_app.location
  project  = google_cloud_run_service.void_app.project
  service  = google_cloud_run_service.void_app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ============================================================================
# Cloud SQL (Optional - if using Cloud SQL instead of separate DB)
# ============================================================================
resource "google_sql_database_instance" "void_db" {
  count = var.use_cloud_sql ? 1 : 0

  name             = "void-db-instance"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier = "db-custom-1-3840"

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      location                      = var.region
      transaction_log_retention_days = 7
    }

    maintenance_window {
      day          = 7
      hour         = 3
      update_track = "stable"
    }

    ip_configuration {
      ipv4_enabled = false
      private_network = var.network
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }
  }

  deletion_protection = false
}

resource "google_sql_database" "void_db" {
  count = var.use_cloud_sql ? 1 : 0

  name     = "void"
  instance = google_sql_database_instance.void_db[0].name
}

resource "google_sql_user" "void_user" {
  count = var.use_cloud_sql ? 1 : 0

  name     = "void"
  instance = google_sql_database_instance.void_db[0].name
  password = var.db_password
}

# ============================================================================
# Outputs
# ============================================================================
output "service_url" {
  description = "The URL of the Cloud Run service"
  value       = google_cloud_run_service.void_app.status[0].url
}

output "service_name" {
  description = "The name of the Cloud Run service"
  value       = google_cloud_run_service.void_app.name
}

output "service_account_email" {
  description = "The service account email"
  value       = google_service_account.void_service_account.email
}
