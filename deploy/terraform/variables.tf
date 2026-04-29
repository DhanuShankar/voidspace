# ============================================================================
# VOID Cloud IDE - Terraform Variables
# ============================================================================

variable "project_id" {
  description = "The Google Cloud project ID"
  type        = string
}

variable "region" {
  description = "The Google Cloud region"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "The name of the Cloud Run service"
  type        = string
  default     = "void-cloud-ide"
}

variable "environment" {
  description = "The deployment environment"
  type        = string
  default     = "production"
}

variable "container_image" {
  description = "The container image to deploy"
  type        = string
}

variable "tag" {
  description = "The tag for the container image"
  type        = string
  default     = "latest"
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 100
}

variable "min_instances" {
  description = "Minimum number of instances (for warm starts)"
  type        = number
  default     = 1
}

variable "concurrency" {
  description = "Container concurrency"
  type        = number
  default     = 50
}

variable "use_cloud_sql" {
  description = "Use Cloud SQL instead of external database"
  type        = bool
  default     = false
}

variable "db_password" {
  description = "Database password (if using Cloud SQL)"
  type        = string
  sensitive   = true
  default     = null
}

variable "network" {
  description = "VPC network for Cloud SQL (if using Cloud SQL)"
  type        = string
  default     = null
}
