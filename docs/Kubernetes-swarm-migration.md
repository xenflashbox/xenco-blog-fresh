I’m going to tighten one part of the earlier recommendation.

Because you explicitly said to skip the lighter version and do this the right way, I would make the **production cluster nodes Talos Linux nodes, not general-purpose Linux hosts running a lighter Kubernetes distro**. Talos is an immutable, API-managed OS built specifically for Kubernetes, and its production guidance supports a shared control-plane VIP when the control-plane nodes are on the same Layer 2 network. For the platform layer, I would use **Flux** for GitOps, **Vault Secrets Operator** for syncing secrets into Kubernetes, **cert-manager** for certificate issuance and renewal, **MetalLB** for bare-metal `LoadBalancer` services, **Cilium** for networking and network observability, and **Velero** targeting your existing **Cloudflare R2** buckets for cluster backups. ([Talos][1])

This prose assumes the seven-node VM estate you described, your current backend-heavy service mix, and the fact that R2 is already part of your platform for images, blogs, and backups. 

## Canonical node map

**Node 1 — `infra-01`**
Permanent native infrastructure node. PostgreSQL primary, PgBouncer, Redis, Sentinel, Vault Raft member, and no Kubernetes.

**Node 2 — `infra-02`**
Permanent native infrastructure node. PostgreSQL replica, PgBouncer, Redis, Sentinel, Vault Raft member, and no Kubernetes.

**Node 3 — `infra-03`**
Permanent native infrastructure node. Redis, Sentinel, Vault Raft member, backup/WAL archive services, blackbox/uptime monitoring, and no Kubernetes.

**Node 4 — `prod-cp-01`**
Talos control-plane node for the new production Kubernetes cluster.

**Node 5 — `prod-cp-02`**
Talos control-plane node for the new production Kubernetes cluster.

**Node 6 — `prod-cp-03`**
Talos control-plane node for the new production Kubernetes cluster.

**Node 7 — `prod-wkr-01`**
Talos worker node for the new production Kubernetes cluster, but it stays in Swarm the longest during the migration as your temporary capacity buffer. 

---

## Phase 0 — Freeze production drift and assign final destinies

This phase is about ending ambiguity.

**Node 1** stops being thought of as “just another swarm box” and becomes the first permanent infrastructure anchor. Nothing new gets deployed here unless it belongs to the long-term native data plane. The point of Node 1 in this phase is to become boring. You snapshot it, document every volume, record every current service dependency, and begin removing anything that is not part of the final data-plane role.

**Node 2** follows the same philosophy, but its identity is “the first failover partner.” In this phase, you inventory every service that currently uses local disk, every Postgres instance that needs to survive the migration, and every shared secret source that must move under a proper secret system. Node 2 is being prepared to become the standing replica counterpart to Node 1, not a place where ad hoc app workloads continue to live.

**Node 3** becomes the operations anchor. In this freeze phase, it is where you plan to centralize backup execution, WAL archiving, external blackbox checks, and the third member of your native coordination plane for Redis Sentinel and Vault. The key mental change is that Node 3 is no longer an app host; it is the control room for recovery and verification.

**Node 4** is the first node you intentionally sacrifice to the rebuild. You drain it out of Swarm, move anything transient off it, snapshot it, and treat that snapshot as the last historical artifact of its old life. Node 4 is the beachhead for the new platform.

**Node 5** stays in the old world just long enough to keep capacity steady while Node 4 is rebuilt. The moment Node 4 is confirmed stable as a Talos control-plane node, Node 5 gets drained and joins the rebuild line.

**Node 6** mirrors Node 5. It remains old-world capacity during the first rebuild wave, then exits Swarm and becomes the third control-plane node.

**Node 7** is the last general-purpose box you keep in the old runtime. Its job in Phase 0 is simple: absorb temporary stateless spillover so you can free Nodes 4 through 6 without causing an immediate service collapse. Node 7 is your bridge node, not your final landing zone.

At the end of Phase 0, you have not built Kubernetes yet, but every node has a non-negotiable future role. That alone removes a lot of the chaos that currently comes from treating all seven nodes as vaguely interchangeable. 

---

## Phase 1 — Stand up the permanent native infrastructure plane

This is the phase where you stop pretending every critical system belongs under one scheduler.

**Node 1** becomes your primary data node. Its final role in this phase is PostgreSQL primary, PgBouncer, Redis, Sentinel, and Vault Raft member 1. This node should not host customer-facing app containers anymore. Its value is not elasticity; its value is authority. It becomes the canonical write origin for Postgres and one of the permanent members of the secret and cache quorum.

**Node 2** becomes the primary failover data node. It runs PostgreSQL replica, PgBouncer, Redis, Sentinel, and Vault Raft member 2. This node’s job is to mirror Node 1’s data responsibilities closely enough that a primary failover is operationally straightforward. It is not a place for experimental services or incidental tools.

**Node 3** becomes the recovery and observability node. It runs Redis, Sentinel, Vault Raft member 3, WAL archiving, database backup tooling, restore validation jobs, and your external service verification stack. It is also the right place to host a tiny amount of operator-facing tooling that tells you whether the platform is healthy from the outside. If Node 1 and Node 2 are about serving state, Node 3 is about proving recoverability.

During this phase, your R2 buckets become the formal backup target for database archives, cluster backups later, exported artifacts, and off-node recovery data. R2’s S3-compatible API makes it suitable as that shared object target. ([Cloudflare Docs][2])

**Nodes 4 through 7** do not yet join the new platform in this phase. Their job is to keep the old runtime alive just long enough for the native infrastructure plane to stabilize. The mistake to avoid here is trying to build Kubernetes before you have a trustworthy data and secret backbone.

At the end of Phase 1, Nodes 1 through 3 are no longer “Swarm nodes that also happen to run databases.” They are your native, permanent infrastructure layer.

---

## Phase 2 — Build the new production Kubernetes control plane on Nodes 4–6

This is the point where the new world begins.

**Node 4** is wiped and rebuilt as a Talos control-plane node. It receives the first machine config, becomes `prod-cp-01`, and is configured against the future control-plane endpoint. Because Talos supports a shared control-plane VIP on a common Layer 2 network, I would use that VIP as the canonical Kubernetes API endpoint rather than adding an extra HAProxy tier unless your virtualization network prevents the VIP model. ([Talos][3])

**Node 5** is then drained, wiped, and rebuilt as `prod-cp-02`. It joins the Talos cluster as the second control-plane node. At this stage, the cluster exists, but it is not yet the place where you put anything you care about. Node 5’s role is to harden the control plane, not to absorb workloads.

**Node 6** is rebuilt last in this wave as `prod-cp-03`. Once Node 6 joins, the control plane becomes the real production cluster skeleton: three dedicated control-plane nodes, a stable API endpoint, and an immutable host OS designed specifically for Kubernetes. Talos is attractive here because the nodes stop being hand-tuned Linux boxes and instead become declarative appliances for Kubernetes. ([Talos][1])

**Node 7** remains outside the new cluster for this entire phase. Its only job is to continue cushioning the old runtime until the control plane is not just alive, but boring.

**Nodes 1 through 3** are now the external services that the new cluster depends on. Vault is external. PostgreSQL is external. Redis is external. This is intentional. The new cluster is born with a clean dependency model instead of being expected to host every piece of the platform on day one.

At the end of Phase 2, you have two worlds running in parallel: the old Swarm world still serving traffic, and the new Kubernetes control plane waiting for its platform services.

---

## Phase 3 — Install the production platform stack on the new cluster

Now the Kubernetes cluster becomes useful.

**Nodes 4, 5, and 6** receive the cluster foundation services. First comes **Cilium** as the networking and policy layer, because this gives you a modern networking base plus Hubble-based visibility into service-to-service traffic. Then comes **Flux** so cluster state and app state are reconciled from Git instead of from operator memory. Then **cert-manager** for certificate lifecycle, **MetalLB** for bare-metal `LoadBalancer` services, and **Vault Secrets Operator** so application secrets are synchronized from Vault rather than passed around manually. ([Cilium Documentation][4])

**Node 4** in this phase acts as the first stable anchor of the new platform. It is where you first verify control-plane health, Talos config patching, and cluster bootstrap discipline. It should not yet be treated as a general workload sponge.

**Node 5** becomes the confirmation node. If Flux, cert-manager, MetalLB, and secret sync behave identically here, you know your configuration is truly declarative rather than accidentally local to Node 4.

**Node 6** becomes the resilience node. By the time the third control-plane node is carrying the same platform components cleanly, the cluster starts behaving like a production substrate rather than a lab cluster.

**Node 1** and **Node 2** in this phase are where Vault auth is tied into Kubernetes service accounts, database connectivity from the cluster is validated, and PgBouncer endpoints are formalized for the services that will migrate first. Kubernetes-to-Vault auth through Kubernetes service accounts is the clean pattern here. ([HashiCorp Developer][5])

**Node 3** becomes the place where backup validation enters the loop. Velero is configured to write cluster backups to R2, and restore testing is treated as part of the platform bring-up, not a future idea. Velero is designed for backing up and restoring Kubernetes cluster resources and persistent volumes, and R2’s S3-compatible API fits this backup target model. ([Velero][6])

**Node 7** still waits. It is not rebuilt yet. That restraint matters. You do not want the first worker join to become the moment you discover the platform basics were not actually finished.

At the end of Phase 3, the new production cluster is real: immutable nodes, GitOps, secrets sync, cert automation, service exposure, backup path, and network visibility.

---

## Phase 4 — Convert Node 7 and move the shared backend services first

This is the first application cutover phase.

**Node 7** is finally drained from Swarm, wiped, rebuilt as Talos, and joined to the new production cluster as `prod-wkr-01`. This node becomes the first true application worker. The emotional rule here is simple: Node 7 is where apps go once the platform has earned them.

**Node 4, Node 5, and Node 6** continue carrying the control plane and system services. In the early weeks, they may also host a small amount of workload capacity if necessary, but the intent is that serious user workloads increasingly land on Node 7 first, with the control-plane nodes serving more as a resilience cushion than as the primary app tier.

The first workloads to move are the ones that already fit a clean cloud-native shape:

* your shared FastAPI production API
* LiteLLM gateway
* document generation service
* image orchestration APIs
* stateless background workers
* small internal service wrappers

These services should be deployed through GitOps, consume secrets from Vault via the operator, write artifacts to R2, and point at external PostgreSQL and Redis rather than trying to bring their own state with them. 

**Node 1** and **Node 2** in this phase become more important because your first migrated services will lean hard on external Postgres, PgBouncer, and Redis. This is exactly what you want. The application plane should feel ephemeral; the data plane should feel deliberate.

**Node 3** continues validating backups and begins participating in a more serious operational loop: external uptime checks, restore verification, and alerting against the new API endpoints rather than the old Swarm paths.

At the end of Phase 4, your production APIs are no longer running on the mutable shared dev/prod Docker stack that caused the original pain. They are running on a new production Kubernetes plane with externalized state.

---

## Phase 5 — Move the business-support services without re-importing old habits

This phase is where you bring over the important but less foundational business apps.

**Node 7** becomes the main application landing zone for:

* Firefly
* BookStack
* your invoicing companion application
* Listmonk
* Mautic
* internal admin dashboards that are not the source of truth

The rule is that the app moves, not its bad storage assumptions.

If Firefly, BookStack, Listmonk, or Mautic need Postgres, they use the external Postgres plane on Nodes 1 and 2. If they need object/file storage, they use R2 or a tightly controlled shared store. If they need email or webhooks, those integrations are declared through Git and secrets, not copied by hand at runtime.

**Nodes 4 through 6** in this phase become the stability guardrails. Multi-replica apps that need higher availability should get PodDisruptionBudgets and safe drain procedures, because Kubernetes is excellent at orchestrating workloads only when you define how much disruption the application can tolerate. PodDisruptionBudgets exist specifically to limit simultaneous voluntary disruptions, and node drains respect them when configured correctly. ([Kubernetes][7])

**Node 1** and **Node 2** may need a capacity review here. Once the business apps move, your external Postgres plane becomes more central. If one of these nodes is underpowered, this is when you feel it. That is a good thing, because it means the resource pressure is visible in the right place instead of being hidden inside container roulette.

**Node 3** in this phase graduates from “backup box” to “operational referee.” It is where you prove that restoring a database backup, restoring a Velero cluster backup, and reissuing secrets all work before you trust the system with more revenue-sensitive services.

At the end of Phase 5, most of the backend surface that matters to your business is already off Swarm.

---

## Phase 6 — Migrate the storage-sensitive and search-heavy services carefully

This is where most people rush and recreate the same instability they were trying to escape. You should not.

**Node 7** continues to be the first landing zone for new app workloads, but the services in this phase are different. This is where you evaluate Payload, Meilisearch, OpenDeepSearch components, and any vector or search systems that have statefulness or heavier I/O behavior.

The principle here is strict:

* if the service can use external Postgres plus R2, do that
* if the service can externalize its durable artifacts, do that
* if the service insists on persistent block storage inside Kubernetes, treat it as an exception, not the default

**Nodes 4 through 6** should not become the place where you casually pin fragile stateful workloads. Their job is still control-plane health, platform services, and supporting replicated stateless workloads when needed.

**Nodes 1 through 3** remain the truth layer. If you discover that a service really belongs outside Kubernetes, this is not a failure. It is the platform doing its job by revealing the right home for the service.

This is also the phase where you decide whether you truly need an in-cluster storage fabric later. Not now. Later. If a future storage layer is warranted, then you evaluate that on its own merits. Until then, R2 handles object storage cleanly and Kubernetes persistent volumes should be treated surgically, not casually. Kubernetes persistent volumes exist to abstract durable storage for workloads, but that does not mean every workload should get one by default. ([Cloudflare Docs][8])

At the end of Phase 6, the new production platform is no longer “Kubernetes for a few services.” It is the real backend platform.

---

## Phase 7 — Create the real non-production environment

Your production cluster is not the place where feature work happens.

The right version here is to add **three more Talos nodes** later and build a second cluster for non-production. Until those nodes exist, local development and tightly scoped single-node test environments remain acceptable, but production stays clean.

When you add them, the roles are:

**Node 8 — `nonprod-cp-01`**
First Talos control-plane node for non-production.

**Node 9 — `nonprod-cp-02`**
Second Talos control-plane node for non-production.

**Node 10 — `nonprod-cp-03`**
Third Talos control-plane node for non-production.

Those three nodes form a separate non-production control plane with its own Git branches or directories, secret paths, DNS, and workloads. The point is not just namespace separation. The point is to stop “development on the live production API server” from ever being structurally possible again. 

If later you add more non-prod workers, great. But the big operational win happens the moment prod and non-prod stop sharing the same cluster and same change stream.

---

## Phase 8 — Retire Swarm as a production runtime

By the time you reach this phase:

* Nodes 4 through 7 are no longer Swarm nodes
* Nodes 1 through 3 are no longer “general-purpose Docker hosts”
* public DNS should no longer target Swarm services
* app deploys happen through GitOps into Kubernetes
* secrets come from Vault, not from ad hoc runtime loading
* backups flow to R2 and are restored on purpose, not just stored hopefully

At this point, Swarm is not something you “keep around just in case.” It becomes historical infrastructure. You drain it, archive the compose files and historical manifests, document the old topology, and remove it from the critical path completely.

That is the moment when your backend stops being a clever dev lab and becomes an actual platform.

---

## Condensed node lifecycle, start to finish

**Node 1**
Starts as a mixed-use Docker box, ends as the native primary data node. It becomes the authoritative Postgres writer, a PgBouncer endpoint, a Redis/Sentinel member, and a Vault node. It never returns to generic app hosting.

**Node 2**
Starts as a mixed-use Docker box, ends as the native replica data node. It mirrors Node 1 where it matters and exists to make failover credible instead of theoretical.

**Node 3**
Starts as a mixed-use Docker box, ends as the recovery and observability node. It becomes the place where backups, WAL archives, external checks, and secret-plane quorum are anchored.

**Node 4**
Starts as an old-world Swarm node, becomes the first Talos control-plane node and the symbolic beginning of the new platform.

**Node 5**
Starts as temporary legacy capacity, becomes the second Talos control-plane node and proves the new platform is repeatable.

**Node 6**
Starts as temporary legacy capacity, becomes the third Talos control-plane node and turns the cluster from a pilot into a real production control plane.

**Node 7**
Starts as the last Swarm buffer, then becomes the first true production worker node and the initial home for the migrated backend services.

---

## The operating doctrine for your admins

From this point on, the rules should be:

* no production development on the production cluster
* no production secrets loaded by hand into runtime
* no critical state placed on Kubernetes just because it can be
* no NFS-as-default-persistence thinking
* no registry inside the same blast radius as the workloads it serves
* no cutover without backup restore proof
* no manual prod deploys outside GitOps

That is the prose version of the blueprint.

The next deliverable should be the **implementation runbook**, with exact hostnames, network assumptions, Talos control-plane VIP, namespace map, Git repo layout, Vault path layout, R2 bucket/prefix map, and the migration order for your first 10 services.

[1]: https://www.talos.dev/v1.9/introduction/what-is-talos/?utm_source=chatgpt.com "What is Talos Linux? - Sidero Documentation"
[2]: https://developers.cloudflare.com/r2/get-started/s3/?utm_source=chatgpt.com "S3 - R2"
[3]: https://www.talos.dev/v1.9/introduction/prodnotes/?utm_source=chatgpt.com "Production Clusters - Sidero Documentation"
[4]: https://docs.cilium.io/en/stable/overview/intro.html?utm_source=chatgpt.com "Introduction to Cilium & Hubble"
[5]: https://developer.hashicorp.com/vault/docs/auth/kubernetes?utm_source=chatgpt.com "Kubernetes - Auth Methods | Vault"
[6]: https://velero.io/docs/main/?utm_source=chatgpt.com "Velero Docs - Overview"
[7]: https://kubernetes.io/docs/tasks/run-application/configure-pdb/?utm_source=chatgpt.com "Specifying a Disruption Budget for your Application"
[8]: https://developers.cloudflare.com/r2/?utm_source=chatgpt.com "Overview · Cloudflare R2 docs"
