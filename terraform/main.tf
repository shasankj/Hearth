resource "aws_s3_bucket" "datalake" {
  bucket = "hearth-${var.env}-datalake"
}

resource "aws_s3_bucket_versioning" "datalake" {
  bucket = aws_s3_bucket.datalake.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "datalake" {
  bucket                  = aws_s3_bucket.datalake.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

module "offer_events" {
  source = "./modules/queue"
  name   = "hearth-${var.env}-offer-events"
}

data "aws_iam_policy_document" "worker" {
  statement {
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage"]
    resources = [module.offer_events.arn] # least privilege: one queue, two actions
  }
}

resource "aws_iam_policy" "worker" {
  name   = "hearth-${var.env}-worker"
  policy = data.aws_iam_policy_document.worker.json
}
