# Kubernetes

## Architecture
- **Control plane:** **kube-apiserver** (the only component that talks to etcd; REST front door), **etcd** (consistent key-value store, the cluster's source of truth), **kube-scheduler** (assigns Pods to Nodes by resources/affinity/taints), **controller-manager** (control loops: Deployment, ReplicaSet, Node, Job controllers...), cloud-controller-manager.
- **Node:** **kubelet** (runs Pods via the container runtime (containerd), reports status, runs probes), **kube-proxy** (implements Services with iptables/IPVS), container runtime, CNI plugin (pod networking).
- **Declarative + reconciliation:** you declare desired state (YAML); controllers continuously drive actual state toward it ("level-triggered"). This is why pods get replaced automatically.

## Objects you must know
| Object | Purpose |
|---|---|
| **Pod** | Smallest unit; 1+ containers sharing network/storage. Ephemeral. |
| **ReplicaSet / Deployment** | Keeps N Pods; Deployment adds **rolling updates and rollback** (`rollout undo`). |
| **Service** | Stable virtual IP + DNS in front of Pods chosen by labels. Types: **ClusterIP** (internal), **NodePort**, **LoadBalancer** (cloud LB), **Headless** (`clusterIP: None`, returns Pod IPs), ExternalName. |
| **Ingress** + controller | L7 HTTP routing from outside (host/path rules, TLS). Needs a controller (ingress-nginx, ALB controller). Gateway API is the successor. |
| **ConfigMap / Secret** | Config and sensitive data (Secrets are only base64 by default: enable encryption at rest / use external secrets). |
| **StatefulSet** | Stable identity + storage for stateful apps (databases). **DaemonSet**: one Pod per node (log/metrics agents, e.g. Datadog agent). **Job/CronJob**: batch. |
| **PV / PVC / StorageClass** | Persistent storage and dynamic provisioning. |
| **HPA** | Scale replicas on CPU/memory/custom metrics (needs metrics-server). **VPA**, **Cluster Autoscaler/Karpenter** scale nodes. |
| **PodDisruptionBudget** | Limits voluntary disruptions (node drains). |
| **Namespace, RBAC, NetworkPolicy, ResourceQuota** | Multi-tenancy, authorization, traffic rules, limits. |

## Production concepts
- **Requests vs limits:** *request* = scheduler reservation; *limit* = cap. CPU over limit is **throttled**; memory over limit is **OOMKilled**. QoS classes: Guaranteed (req=limit), Burstable, BestEffort (evicted first).
- **Probes:** **readiness** (receive traffic?), **liveness** (restart if hung), **startup** (slow starters). Wrong liveness probes cause restart storms; readiness controls rollouts and Service endpoints.
- **Rolling update:** `maxSurge`/`maxUnavailable` (we use `0` unavailable → zero downtime); `preStop` hook + `terminationGracePeriodSeconds` + app handling SIGTERM for graceful shutdown.
- **Scheduling control:** nodeSelector, **affinity/anti-affinity** (spread replicas across nodes/zones), **taints/tolerations**, **topologySpreadConstraints**.
- **Security:** non-root, `readOnlyRootFilesystem`, drop capabilities, `allowPrivilegeEscalation: false`, Pod Security Standards, RBAC least privilege, NetworkPolicies default-deny, image scanning, secrets via external manager.
- **Packaging/deploy:** **Helm** (templated charts), **Kustomize** (overlays; we use it), **GitOps** (Argo CD/Flux: Git is source of truth, controller syncs the cluster). **Progressive delivery:** canary/blue-green (Argo Rollouts, Flagger).
- **Service mesh** (Istio/Linkerd): mTLS, retries, L7 gRPC load balancing, traffic shifting, telemetry.
- **EKS (AWS):** managed control plane; node groups/Fargate; IAM Roles for Service Accounts (IRSA)/Pod Identity; VPC CNI gives Pods VPC IPs; ALB controller; Karpenter.

## Our manifests ([k8s/](../k8s))
- **[listing.yaml](../k8s/listing.yaml)**: Deployment (2 replicas, `maxUnavailable: 0`), requests/limits, **native gRPC probes** (`grpc: {port: 50051}` uses the health service we registered), hardened `securityContext`. Service is **headless** so clients get all Pod IPs.
- **[api.yaml](../k8s/api.yaml)**: ConfigMap (`LISTING_ADDR=dns:///listing.hearth.svc.cluster.local:50051`), Deployment with HTTP probes on `/healthz`, ClusterIP Service (80→3000), **HPA** (2-6 replicas at 70% CPU), **PDB** (`minAvailable: 1`).
- **[ingress.yaml](../k8s/ingress.yaml)** and **[kustomization.yaml](../k8s/kustomization.yaml)**.
- Deploy: `kubectl apply -k k8s`.

### Verified on a real `kind` cluster
1. **Bug:** listing pods `CreateContainerConfigError`: `runAsNonRoot: true` can't verify a *named* image user. Fix: numeric `USER 10001`.
2. **Bug:** gRPC `pick_first` sent everything to one pod behind the headless Service. Fix: `round_robin` in the Node client. **Result: requests split 4/2 across the two pods.**
3. First request after rollout failed with name-resolution error (gRPC cached the earlier DNS failure; backoff) then recovered: why readiness gating matters.
4. API reachable via `kubectl port-forward svc/api`; 404 for a missing listing propagated through gRPC → HTTP.
(The Ingress and HPA objects were applied but not exercised: no ingress controller or metrics-server installed in kind.)

## Troubleshooting playbook (they will ask)
`kubectl get pods -o wide` → `kubectl describe pod X` (Events!) → `kubectl logs X [--previous]` → `kubectl exec -it X -- sh` → `kubectl get events --sort-by=.lastTimestamp`.
- **Pending:** insufficient resources, unschedulable (taints/affinity), PVC unbound.
- **ImagePullBackOff:** wrong image/tag, registry auth.
- **CrashLoopBackOff:** app crashes; check `logs --previous`, config/env, liveness probe too aggressive.
- **OOMKilled:** raise memory limit or fix leak (`Exit Code 137`).
- **CreateContainerConfigError:** missing ConfigMap/Secret key or security-context problem (our case).
- **Service has no endpoints:** selector/labels mismatch or Pods not Ready (`kubectl get endpoints`).
- **503 from Ingress:** backend not ready or wrong port.

## Interview Q&A
**Q: What happens when you `kubectl apply` a Deployment?** apiserver authenticates/authorizes/validates and stores in etcd → Deployment controller creates a ReplicaSet → ReplicaSet controller creates Pods → scheduler binds Pods to Nodes → kubelet pulls images and starts containers, runs probes → endpoints controller adds Ready Pods to Service endpoints.

**Q: Liveness vs readiness?** Readiness = can I serve traffic now (removes from Service); liveness = am I stuck (restart). Don't make liveness depend on downstream services.

**Q: How do Services route traffic?** kube-proxy programs iptables/IPVS rules mapping ClusterIP:port to healthy Pod IPs (random/round-robin per connection); DNS (CoreDNS) gives `svc.namespace.svc.cluster.local`.

**Q: Why does gRPC load balancing break with ClusterIP?** Long-lived HTTP/2 connection = pinned to one Pod. Use headless Service + client-side `round_robin`, a mesh or L7 proxy.

**Q: How do you do zero-downtime deployment?** Readiness probes, `maxUnavailable: 0`, graceful shutdown + `preStop`, PDB, enough replicas, backwards-compatible schema/API changes.

**Q: How do you handle config and secrets?** ConfigMaps for config, external secret manager (AWS Secrets Manager/Vault + External Secrets Operator) for secrets; RBAC; don't commit secrets.

**Q: How does HPA work?** Control loop compares current metric to target: `desired = ceil(current * currentMetric / targetMetric)`, bounded by min/max, with stabilization windows.

**Q: Deployment vs StatefulSet?** Deployment: interchangeable Pods. StatefulSet: stable names (`db-0`), ordered rollout, per-Pod PVCs, for databases/queues.

**Q: Rolling back?** `kubectl rollout undo deployment/api`; GitOps revert; keep old ReplicaSets via `revisionHistoryLimit`.
