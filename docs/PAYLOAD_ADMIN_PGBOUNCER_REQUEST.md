# PGBouncer Configuration Request for OpenBrain MCP

**From:** OpenBrain MCP Admin
**To:** Payload-Swarm Admin
**Date:** 2026-03-31
**Priority:** Production Critical

---

## Summary

The OpenBrain MCP service requires the following configuration in PGBouncer to function correctly. This is a **production dependency** - if this configuration is incorrect or out of sync across cluster nodes, OpenBrain will experience intermittent connection failures.

---

## Required Configuration

### 1. Database Entry in `pgbouncer.ini`

Add or verify this line exists in the `[databases]` section:

```ini
openbrain = host=payload-postgres_postgres port=5432 dbname=openbrain
```

### 2. User Entry in `userlist.txt`

Add or verify this line exists in `userlist.txt`:

```
"openbrain" "SCRAM-SHA-256$4096:surrzewDBBqmMudFR1LkCw==$yZMntGG/2ocv1Q3YcQ0Lm4UKbREZrgvtrLpWM04MjgA=:HPE/yk9xYr4X4qBO5J08jPcb6ruezFmODyGB2qwBALs="
```

**The password for this hash is:** `openbrain_secure_2025`

If the password needs to be changed, please:
1. Update the PostgreSQL role: `ALTER ROLE openbrain WITH PASSWORD 'new_password';`
2. Generate a new SCRAM-SHA-256 hash
3. Update userlist.txt on ALL pgbouncer nodes
4. Notify OpenBrain admin to update `deploy/swarm/.env`

---

## Critical: Multi-Node Sync Requirement

**PGBouncer runs on multiple nodes.** The configuration files MUST be identical on all nodes:

| Node | Path |
|------|------|
| xenco3 | `/home/xen/docker/apps/payload-swarm/pgbouncer/userlist.txt` |
| xenco5 | `/home/xen/docker/apps/payload-swarm/pgbouncer/userlist.txt` |

### Recommended Sync Process

After any changes to PGBouncer configuration:

```bash
# 1. Make changes on the source node (e.g., xenco3)
# 2. Sync to all other pgbouncer nodes
rsync -avz /home/xen/docker/apps/payload-swarm/pgbouncer/ xenco5:/home/xen/docker/apps/payload-swarm/pgbouncer/

# 3. Reload PGBouncer on all nodes (SIGHUP reloads config without restart)
ssh xenco3 "docker kill --signal=SIGHUP \$(docker ps -q -f name=pgbouncer)"
ssh xenco5 "docker kill --signal=SIGHUP \$(docker ps -q -f name=pgbouncer)"

# 4. Verify sync
ssh xenco3 "md5sum /home/xen/docker/apps/payload-swarm/pgbouncer/userlist.txt"
ssh xenco5 "md5sum /home/xen/docker/apps/payload-swarm/pgbouncer/userlist.txt"
# Both should show the same hash
```

---

## Incident History

**2026-03-31:** OpenBrain experienced intermittent "Connection reset by peer" errors affecting ~50% of requests. Root cause was inconsistent userlist.txt between xenco3 and xenco5 - xenco5 had an outdated SCRAM hash for the `openbrain` user.

---

## Verification

After making changes, please verify OpenBrain connectivity:

```bash
# Test from any node with curl access
curl -s https://brain.xencolabs.com/health
# Expected: {"status":"ok","service":"open-brain-mcp","version":"1.0.0"}

# Test MCP functionality
curl -s -X POST https://brain.xencolabs.com/mcp \
  -H "Content-Type: application/json" \
  -H "X-Brain-Key: ob1-mcp-4644eef5e4ebd280533c774e16f3cafd" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"thought_stats","arguments":{}}}'
# Expected: Response with thought statistics (not an error)
```

---

## Long-Term Recommendation

Consider migrating PGBouncer configuration from bind mounts to Docker configs to eliminate multi-node sync issues:

```yaml
# Current (problematic)
volumes:
  - /home/xen/docker/apps/payload-swarm/pgbouncer/userlist.txt:/etc/pgbouncer/userlist.txt:ro

# Recommended (Docker configs)
configs:
  pgbouncer-userlist:
    external: true
    name: pgbouncer-userlist-v1
```

This would make configuration immutable and automatically distributed across the swarm.

---

## Contact

If you need to coordinate password changes or have questions:
- OpenBrain admin: xen@xencolabs.com
- Service: openbrain_openbrain-mcp
- Health URL: https://brain.xencolabs.com/health
