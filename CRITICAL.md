# CRITICAL (READ FIRST)

## Network (authoritative)
- Cluster subnet: 10.8.8.0/24
- NEVER use 192.168.x.x in this environment.

## Swarm nodes (authoritative quick ref)
- Managers: 10.8.8.14, 10.8.8.15, 10.8.8.17
- Workers: 10.8.8.12, 10.8.8.16, 10.8.8.108

## Absolute rule: no guessing
Before ANY infra action:
1) ./scripts/whoami.sh
2) ./scripts/preflight.sh

## Deployment rule
- Only deploy using: ./scripts/deploy.sh
- Deploy BLOCKS if git is dirty unless you pass --force

## Emergency only
- ./scripts/deploy.sh --force
- If used, you MUST paste: reason + git diff --stat + git rev-parse HEAD
