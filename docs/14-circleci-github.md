# CircleCI and GitHub workflow

## CI/CD concepts
- **CI** = every change is built and tested automatically, quickly, on a clean machine. **Continuous Delivery** = always releasable (deploy by button). **Continuous Deployment** = every green change on main auto-deploys.
- A good pipeline is **fast** (minutes), **reliable** (no flaky tests), **gives clear feedback**, and is **the only path to production**.
- **Test pyramid:** many unit tests (fast), fewer integration, few E2E. Run cheap checks first (lint/format/vet), then tests, then build artifacts.
- **Deployment strategies:** rolling, **blue/green** (switch traffic between two environments), **canary** (small % first, watch metrics), feature flags (decouple deploy from release), instant rollback.
- **Artifacts:** build once, promote the *same* image through environments (never rebuild per environment). Tag with git SHA.

## CircleCI core
- **Config:** `.circleci/config.yml`, `version: 2.1`.
- **Executors:** `docker` (container; fast), `machine` (full VM; needed for Docker-in-Docker/Compose), `macos`. **Resource classes** size CPU/RAM.
- **Job** = steps on one executor. **Workflow** = jobs graph with `requires` (dependencies), `filters` (branch/tag), `matrix`, **approval** jobs (manual gate), scheduled triggers.
- **Orbs:** shared packaged config (`circleci/node`, `aws-cli`, `docker`, `slack`...): commands/jobs/executors you can reuse. **Commands** and **parameters** make your own jobs DRY.
- **Caching & data sharing:** **cache** (`save_cache/restore_cache` keyed by checksum of lockfiles: dependency reuse across runs), **workspace** (`persist_to_workspace`: pass files between jobs *in one workflow*), **artifacts** (store outputs/reports for download).
- **Speed:** parallelism + **test splitting** by timings (`circleci tests split --split-by=timings`), Docker layer caching, cache keys, smaller images.
- **Secrets:** project env vars or **contexts** (shared sets, restrictable by group); never in config. **OIDC tokens** to assume AWS roles without stored keys.
- **Debug:** "Rerun job with SSH", `store_test_results` (shows flaky/slow tests), insights dashboard.
- **CircleCI vs GitHub Actions vs Jenkins:** CircleCI = fast hosted CI with strong caching/parallelism and orbs; Actions = integrated with GitHub, huge marketplace; Jenkins = self-hosted, plugin-heavy, more maintenance.

## Our pipeline ([.circleci/config.yml](../.circleci/config.yml))
- **Orb:** `circleci/node@6` for dependency install with caching.
- **Reusable commands** `restore-go`/`save-go`: cache key `go-{{ checksum "go.sum" }}` changes only when dependencies change.
- **Jobs:** `go-test` (`go vet` + `go test -race -cover`), `api-test` (npm), `agent-test` (Python + ETL tests), `java-test` (javac + test main), `e2e` (Cypress in `cypress/browsers`), `docker-build` (`machine` executor, `docker compose build`).
- **Workflow `ci`:** the five test jobs run **in parallel**; `docker-build` has `requires: [...]` and a `filters: branches: only: main` → images are only built after all tests pass, and only on main.
- **Verified:** `circleci config validate` → "valid" (config *syntax/semantics*). **Not run on CircleCI's servers** (needs a connected GitHub repo/account).

## GitHub workflow (what interviewers want to hear)
- **Branching:** short-lived feature branches off `main` (**trunk-based** with small PRs) vs long-lived GitFlow (heavier). Protect `main`: required reviews, required status checks (CircleCI), no force-push, linear history optional.
- **Pull requests:** small, focused, descriptive (what/why/how tested), link the ticket, screenshots for UI; review for correctness, tests, readability, security, observability; use **CODEOWNERS** for required reviewers; use draft PRs for early feedback.
- **Merge strategies:** merge commit (preserves history), **squash** (clean main, one commit per PR), **rebase** (linear). Know `git rebase` vs `merge`, `cherry-pick`, `revert` (safe on shared branches), `reset` (rewrites; local only), `git bisect`, `reflog` for recovery, interactive rebase to tidy before PR.
- **Conventional commits / semantic versioning**, release tags, changelogs. **Dependabot/Renovate** for dependency updates, **secret scanning**, code scanning.
- **Quality gates in this repo:** `gofmt`, `go vet`, `go test -race`, function-length check (`scripts/check_function_length.py`: ≤10 lines/function), `terraform fmt/validate`, `circleci config validate`.

## Interview Q&A
**Q: Walk through your pipeline.** On every PR: lint/vet → unit tests in parallel (Go/Node/Python/Java) → Cypress E2E → on main, build images tagged with SHA → push to registry → deploy to staging via GitOps/Helm → smoke tests → manual approval → canary to prod with monitoring and auto-rollback.

**Q: How do you handle flaky tests?** Detect (test insights, reruns show inconsistent results), quarantine with a ticket and owner, fix root cause (time, ordering, shared state, real network), don't just add retries.

**Q: Cache vs workspace vs artifact?** Cache: reuse across *pipelines*, keyed; workspace: pass data between jobs in *one* workflow; artifacts: persist outputs for humans/other tools.

**Q: How do you keep secrets safe in CI?** Contexts/env vars (masked), OIDC to cloud roles, least-privilege deploy roles, no secrets in logs/PRs from forks, rotate regularly.

**Q: How do you speed up a slow pipeline?** Parallelize jobs, split tests by timing, cache deps and Docker layers, run only affected services (path filtering), smaller images, fail fast on cheap checks.

**Q: Rebase vs merge?** Rebase rewrites your branch onto the latest main for linear history (never rebase shared/public branches); merge preserves exact history and is safe for shared branches.

**Q: How do you roll back a bad deploy?** Redeploy the previous image tag (artifacts are immutable) or revert the commit in GitOps; use feature flags to disable features instantly; keep DB migrations backward compatible.
