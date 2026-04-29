# ============================================================================
# VOID Cloud IDE - Terraform Outputs
# ============================================================================

output "service_url" {
  description = "The URL of the deployed Cloud Run service"
  value       = google_cloud_run_service.void_app.status[0].url
}

output "service_name" {
  description = "The name of the Cloud Run service"
  value       = google_cloud_run_service.void_app.name
}

output "service_account_email" {
  description = "The service account used by the Cloud Run service"
  value       = google_service_account.void_service_account.email
  sensitive   = true
}

output "vpc_connector" {
  description = "The VPC connector name"
  value       = google_vpc_access_connector.void_connector.name
}

output "secrets" {
  description = "Created secret names"
  value = {
    database_url     = google_secret_manager_secret.database_url.secret_id
    redis_url        = google_secret_manager_secret.redis_url.secret_id
    api_keys         = google_secret_manager_secret.api_keys.secret_id
    oauth            = google_secret_manager_secret.oauth_credentials.secret_id
    jwt_secret       = google_secret_manager_secret.jwt_secret.secret_id
  }
  sensitive = true
}
