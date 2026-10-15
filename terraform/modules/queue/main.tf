# A reusable module: a work queue plus its dead-letter queue (DLQ).
variable "name" { type = string }
variable "max_receive" {
  type    = number
  default = 5
}

resource "aws_sqs_queue" "dlq" {
  name                      = "${var.name}-dlq"
  message_retention_seconds = 1209600 # 14 days to investigate failures
}

resource "aws_sqs_queue" "main" {
  name                       = var.name
  visibility_timeout_seconds = 60
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = var.max_receive # after N failed receives -> DLQ
  })
}

output "url" { value = aws_sqs_queue.main.url }
output "arn" { value = aws_sqs_queue.main.arn }
