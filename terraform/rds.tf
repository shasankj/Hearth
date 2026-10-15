# Optional. Set enable_rds=true and supply vpc_id + subnet_ids to create an RDS instance for Hearth.
variable "enable_rds" {
  type    = bool
  default = false
}
variable "vpc_id" {
  type    = string
  default = null
}
variable "subnet_ids" {
  type    = list(string)
  default = []
}
variable "app_security_group_ids" {
  type    = list(string)
  default = []
}

module "rds" {
  count                      = var.enable_rds ? 1 : 0
  source                     = "./modules/rds"
  name                       = "hearth-${var.env}"
  vpc_id                     = var.vpc_id
  subnet_ids                 = var.subnet_ids
  allowed_security_group_ids = var.app_security_group_ids
}
