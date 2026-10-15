# Terraform and AWS

## Terraform core
- **Infrastructure as Code (declarative):** describe desired infrastructure in HCL; Terraform computes the diff and applies it. Providers (aws, kubernetes, datadog...) translate to APIs.
- **Workflow:** `terraform init` (download providers/modules, configure backend) → `fmt` / `validate` → `plan` (diff; review it!) → `apply` → `destroy`.
- **State** (`terraform.tfstate`): the mapping between your config and real resources. **Never edit by hand; never commit it** (contains secrets). Use a **remote backend with locking**: S3 bucket (versioned, encrypted) + DynamoDB table (lock), or S3 native locking in newer versions; Terraform Cloud. Lost/corrupt state = Terraform forgets resources.
- **Core blocks:** `provider`, `resource`, `data` (read-only lookups), `variable`, `output`, `locals`, `module`.
- **Dependencies:** implicit through references (`aws_s3_bucket.datalake.id`); explicit `depends_on` only when needed. Terraform builds a graph and parallelizes.
- **Loops/conditionals:** `count` (index-based; removing an item shifts others, dangerous) vs **`for_each`** (keyed; preferred), `dynamic` blocks, ternary `cond ? a : b`, `for` expressions.
- **Modules:** reusable packages with inputs (`variable`) and outputs. Version-pin them; keep small and focused.
- **Lifecycle:** `prevent_destroy`, `create_before_destroy`, `ignore_changes`. **Drift:** infra changed outside Terraform → `plan` shows it; fix via apply or `import`. **`terraform import`/`import` blocks** adopt existing resources; **`moved` blocks** refactor without recreating.
- **Workspaces** (same config, multiple state files) vs **separate directories/backends per environment** (clearer, safer; commonly preferred) vs Terragrunt.
- **Security/ops:** least-privilege CI role, no secrets in code (use Secrets Manager/SSM + data sources; remember secrets still land in state), policy-as-code (OPA/Sentinel), `tflint`, `checkov`, plan review in PRs (Atlantis/Terraform Cloud), small blast radius via state separation.
- **Terraform vs CloudFormation vs CDK vs Pulumi:** Terraform = multi-cloud, huge provider ecosystem, own state. CloudFormation = AWS-native, managed state/rollback. CDK/Pulumi = real programming languages (CDK synthesizes CloudFormation). Note: Terraform moved to the BUSL license (2023) → community fork **OpenTofu**.

## Our config ([terraform/](../terraform))
- **[providers.tf](../terraform/providers.tf)**: one `use_localstack` flag swaps the AWS provider between **LocalStack** (free local AWS, fake creds, custom endpoints) and **real AWS** (your IAM profile). `dynamic "endpoints"` builds the override block only when needed.
- **[main.tf](../terraform/main.tf)**: encrypted-by-default practices: S3 **versioning** + **public access block**; an SQS queue via a module; an IAM policy built with `aws_iam_policy_document` (**least privilege**: only `ReceiveMessage`/`DeleteMessage` on that one queue ARN).
- **[modules/queue](../terraform/modules/queue/main.tf)**: a work queue + **dead-letter queue** with `redrive_policy` (`maxReceiveCount = 5`: after 5 failed receives the message moves to the DLQ for investigation; 14-day retention).
- **Verified:** `init` + `validate` OK → `apply` against LocalStack created **6 resources** → AWS CLI `s3 ls` and `sqs list-queues` confirmed → second `plan`: *No changes* (idempotent) → `destroy`.
- To use real AWS later: set up the IAM user + `aws configure`, then `terraform apply -var use_localstack=false` (use a remote backend first).

## AWS essentials
- **Global infrastructure:** Regions → Availability Zones (separate data centers) → edge locations (CloudFront). Design for **multi-AZ** high availability.
- **IAM:** users/groups/**roles**/policies. **Policy evaluation:** explicit **Deny** wins; otherwise needs an explicit Allow; default deny. Prefer **roles** (temporary credentials via STS) over long-lived keys; **least privilege**; MFA; never use root. Resource policies (S3 bucket policy) vs identity policies; SCPs at Organization level.
- **Networking (VPC):** CIDR, **public vs private subnets**, route tables, **Internet Gateway**, **NAT Gateway** (private → internet), **Security Groups** (stateful, instance level, allow-only) vs **NACLs** (stateless, subnet level, allow+deny), VPC endpoints/PrivateLink, peering/Transit Gateway.
- **Compute:** EC2 (instance types, ASG, spot), **ECS/Fargate** (containers without managing servers), **EKS** (managed Kubernetes), **Lambda** (functions; cold starts, 15 min limit, concurrency limits).
- **Load balancing:** **ALB** (L7: path/host routing, gRPC supported), **NLB** (L4, static IPs, extreme performance), GWLB.
- **Storage:** **S3** (objects; strong read-after-write consistency; classes: Standard, IA, Glacier; lifecycle rules; versioning; presigned URLs; SSE), EBS (block), EFS (NFS).
- **Databases:** **RDS/Aurora** (managed relational; Multi-AZ failover, read replicas), **DynamoDB** (key-value, partition+sort key, on-demand/provisioned, GSIs), ElastiCache (Redis), **Redshift** (warehouse), OpenSearch.
- **Messaging:** **SQS** (queue; at-least-once; visibility timeout; DLQ; FIFO), **SNS** (pub/sub fan-out), **EventBridge** (event bus/rules), **Kinesis/MSK** (streams).
- **Observability/ops:** CloudWatch (metrics, logs, alarms), CloudTrail (API audit), X-Ray, Systems Manager, Secrets Manager/Parameter Store, KMS (encryption keys).
- **Well-Architected pillars:** Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability.
- **Cost:** budgets + alerts (set one!), tag resources, right-size, spot/savings plans, delete idle NAT gateways/EBS/EIPs. The Free Tier changed in 2025 for new accounts (a free plan with credits that needs upgrading to use everything): check your account's current terms.

## AWS CLI v2 quick commands
```bash
aws configure                           # key, secret, region, output
aws sts get-caller-identity             # who am I?
aws s3 ls / aws s3 cp file s3://bucket/
aws --endpoint-url http://localhost:4566 s3 ls    # talk to LocalStack
aws sqs send-message --queue-url URL --message-body hi
aws logs tail /aws/lambda/fn --follow
```

## Interview Q&A
**Q: What is Terraform state and why remote?** It maps config to real resources and stores metadata. Remote backend gives shared access, locking (prevent concurrent applies), encryption, versioning/recovery.

**Q: `count` vs `for_each`?** `count` identifies by index (removing the middle item re-addresses others → destroys/recreates). `for_each` identifies by key (stable).

**Q: Someone changed a resource in the console. What now?** `terraform plan` shows drift; decide: revert via apply, or update code to match; then `import` unmanaged resources. Prevent with restricted console access and CI-only applies.

**Q: How do you manage secrets with Terraform?** Don't hardcode; reference Secrets Manager/SSM/Vault; mark variables `sensitive`; know that state still contains them → encrypt and restrict the state bucket.

**Q: Design a highly available web app on AWS.** Route 53 → CloudFront → ALB across ≥2 AZs → ECS/EKS/EC2 ASG in private subnets → RDS Multi-AZ/Aurora + ElastiCache; S3 for assets; NAT for egress; SGs least privilege; IAM roles; CloudWatch alarms; IaC + CI/CD; backups and tested restores.

**Q: SQS standard vs FIFO? DLQ?** Standard: at-least-once, best-effort order, huge throughput. FIFO: ordered, exactly-once processing (dedup), lower throughput. DLQ catches poison messages after `maxReceiveCount`.

**Q: Security Group vs NACL?** SG: stateful, attached to ENIs, allow rules only. NACL: stateless, subnet-level, ordered allow/deny rules.

**Q: How would you deploy this app on AWS?** Images to ECR, EKS (or ECS Fargate) for services, RDS Postgres, MSK/SQS if needed, S3 data lake + Redshift/Databricks, Temporal Cloud or self-hosted on EKS, ALB/HAProxy at edge, all via Terraform and CircleCI, Datadog for observability.
