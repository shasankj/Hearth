variable "env" {
  type    = string
  default = "local"
}

variable "use_localstack" {
  description = "Point the AWS provider at LocalStack (free, local) instead of real AWS"
  type        = bool
  default     = true
}
