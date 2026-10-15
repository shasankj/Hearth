output "bucket" { value = aws_s3_bucket.datalake.bucket }
output "queue_url" { value = module.offer_events.url }
