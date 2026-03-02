# Redis Sentinel Configuration Guide

## Overview

This document provides the correct configuration for connecting to the **Native Redis VM Cluster** with Sentinel-based high availability.

**Architecture:**
- 3 Redis nodes running as native systemd services (not Docker)
- Redis Sentinel for automatic failover (quorum=2)
- Current master determined dynamically by Sentinel

## Cluster Information

| Node | Hostname | IP Address | Redis Port | Sentinel Port | Role |
|------|----------|------------|------------|---------------|------|
| xenco5 | xenco5 | 10.8.8.17 | 6379 | 26379 | Replica/Master* |
| xenco4 | xenco4 | 10.8.8.16 | 6379 | 26379 | Replica/Master* |
| xenco3 | xenco3 | 10.8.8.15 | 6379 | 26379 | Replica |

*Master role changes dynamically via Sentinel failover

**Password:** `redis_secure_password_2025`
**Sentinel Master Name:** `mymaster`

---

## Configuration Methods

### Method 1: Sentinel-Aware Client (RECOMMENDED)

This is the **correct** way to achieve true high availability. The client library handles master discovery and automatic reconnection on failover.

#### Environment Variables
```env
REDIS_SENTINEL_HOSTS=10.8.8.17:26379,10.8.8.16:26379,10.8.8.15:26379
REDIS_SENTINEL_MASTER=mymaster
REDIS_PASSWORD=redis_secure_password_2025
```

#### Node.js (ioredis)

```javascript
const Redis = require('ioredis');

const redis = new Redis({
  sentinels: [
    { host: '10.8.8.17', port: 26379 },
    { host: '10.8.8.16', port: 26379 },
    { host: '10.8.8.15', port: 26379 }
  ],
  name: 'mymaster',
  password: 'redis_secure_password_2025',
  sentinelPassword: 'redis_secure_password_2025',
  // Recommended settings
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false
});

redis.on('error', (err) => console.error('Redis error:', err));
redis.on('+node', (node) => console.log('Node added:', node));
redis.on('-node', (node) => console.log('Node removed:', node));
```

#### Python (redis-py)

```python
from redis.sentinel import Sentinel

# Create Sentinel connection
sentinel = Sentinel(
    [
        ('10.8.8.17', 26379),
        ('10.8.8.16', 26379),
        ('10.8.8.15', 26379)
    ],
    socket_timeout=0.5,
    password='redis_secure_password_2025',
    sentinel_kwargs={'password': 'redis_secure_password_2025'}
)

# Get master connection (auto-discovers current master)
master = sentinel.master_for(
    'mymaster',
    password='redis_secure_password_2025',
    socket_timeout=0.5
)

# Get replica for read operations (optional, for read scaling)
replica = sentinel.slave_for(
    'mymaster',
    password='redis_secure_password_2025',
    socket_timeout=0.5
)

# Usage
master.set('key', 'value')
value = replica.get('key')  # Read from replica
```

#### Go (go-redis)

```go
package main

import (
    "context"
    "github.com/redis/go-redis/v9"
)

func main() {
    rdb := redis.NewFailoverClient(&redis.FailoverOptions{
        MasterName:       "mymaster",
        SentinelAddrs:    []string{
            "10.8.8.17:26379",
            "10.8.8.16:26379",
            "10.8.8.15:26379",
        },
        Password:         "redis_secure_password_2025",
        SentinelPassword: "redis_secure_password_2025",

        // Connection pool settings
        PoolSize:     10,
        MinIdleConns: 5,
    })

    ctx := context.Background()
    err := rdb.Ping(ctx).Err()
    if err != nil {
        panic(err)
    }
}
```

#### PHP (predis)

```php
<?php
require 'vendor/autoload.php';

$sentinels = [
    'tcp://10.8.8.17:26379',
    'tcp://10.8.8.16:26379',
    'tcp://10.8.8.15:26379',
];

$options = [
    'replication' => 'sentinel',
    'service' => 'mymaster',
    'parameters' => [
        'password' => 'redis_secure_password_2025',
    ],
];

$client = new Predis\Client($sentinels, $options);
$client->set('key', 'value');
```

#### Java (Jedis)

```java
import redis.clients.jedis.JedisSentinelPool;
import redis.clients.jedis.Jedis;

Set<String> sentinels = new HashSet<>();
sentinels.add("10.8.8.17:26379");
sentinels.add("10.8.8.16:26379");
sentinels.add("10.8.8.15:26379");

JedisSentinelPool pool = new JedisSentinelPool(
    "mymaster",
    sentinels,
    "redis_secure_password_2025"
);

try (Jedis jedis = pool.getResource()) {
    jedis.set("key", "value");
    String value = jedis.get("key");
}
```

---

### Method 2: Docker Swarm Services (Via HAProxy Bridge)

For services running in Docker Swarm that cannot use `network_mode: host`, we provide an HAProxy bridge that proxies to the native Redis cluster.

#### How It Works
```
Docker Service → redis-sentinel_redis-1:6379 → HAProxy (3 replicas) → Native Redis
```

#### Connection Details
- **Host:** `redis-sentinel_redis-1` or `redis` or `redis-1`
- **Port:** `6379`
- **Password:** `redis_secure_password_2025`
- **Network:** `redis-sentinel_redis-network`

#### Docker Compose Example
```yaml
services:
  my-app:
    image: my-app:latest
    environment:
      - REDIS_HOST=redis-sentinel_redis-1
      - REDIS_PORT=6379
      - REDIS_PASSWORD=redis_secure_password_2025
    networks:
      - redis-sentinel_redis-network

networks:
  redis-sentinel_redis-network:
    external: true
```

**Note:** This method provides redundancy via 3 HAProxy replicas but is not as robust as direct Sentinel-aware connections.

---

### Method 3: Host Network Mode (Best for Critical Services)

For services that need direct access to the native Redis with full Sentinel support:

```yaml
services:
  critical-app:
    image: my-critical-app:latest
    network_mode: host
    environment:
      - REDIS_SENTINEL_HOSTS=10.8.8.17:26379,10.8.8.16:26379,10.8.8.15:26379
      - REDIS_SENTINEL_MASTER=mymaster
      - REDIS_PASSWORD=redis_secure_password_2025
```

**Pros:** True HA, direct Sentinel access
**Cons:** Loses Docker DNS resolution for other services

---

## Verifying Connection

### Check Current Master
```bash
# From any node with redis-cli
redis-cli -h 10.8.8.17 -p 26379 -a redis_secure_password_2025 sentinel get-master-addr-by-name mymaster
```

### Test Connection
```bash
# Direct to current master (query Sentinel first)
MASTER=$(redis-cli -h 10.8.8.17 -p 26379 -a redis_secure_password_2025 sentinel get-master-addr-by-name mymaster | head -1)
redis-cli -h $MASTER -p 6379 -a redis_secure_password_2025 ping
```

### Check Cluster Health
```bash
# From xenco2/xenco3/xenco5
redis-cli -h 10.8.8.17 -p 26379 -a redis_secure_password_2025 sentinel master mymaster
redis-cli -h 10.8.8.17 -p 26379 -a redis_secure_password_2025 sentinel replicas mymaster
```

---

## Failover Behavior

When the master fails:

1. Sentinels detect master is down (after `down-after-milliseconds`: 5000ms)
2. Sentinels reach quorum (2 of 3 must agree)
3. One Sentinel is elected leader
4. Leader promotes a replica to master
5. Other replicas reconfigure to follow new master
6. Sentinel-aware clients automatically reconnect to new master

**Typical failover time:** 5-15 seconds

---

## Troubleshooting

### Cannot Connect from Docker Container
1. Ensure the service is on `redis-sentinel_redis-network`
2. Use hostname `redis-sentinel_redis-1` not IP addresses
3. Check HAProxy bridge is running: `docker service ls | grep redis-bridge`

### Sentinel Returns Wrong Master
```bash
# Force Sentinel to re-check
redis-cli -h 10.8.8.17 -p 26379 -a redis_secure_password_2025 sentinel reset mymaster
```

### Connection Refused
1. Check firewall on Redis nodes: `sudo ufw status`
2. Ensure ports 6379 and 26379 are allowed
3. Verify Redis is running: `systemctl status redis-server`

### Auth Failed
- Password is `redis_secure_password_2025` (same for Redis and Sentinel)
- Both `password` and `sentinelPassword` must be set in client config

---

## Architecture Diagram

```
                    ┌─────────────────────────────────────────────────┐
                    │           Docker Swarm Overlay Network          │
                    │         (redis-sentinel_redis-network)          │
                    └─────────────────────┬───────────────────────────┘
                                          │
                    ┌─────────────────────▼───────────────────────────┐
                    │              HAProxy Bridge (x3)                │
                    │  Aliases: redis-sentinel_redis-1, redis, redis-1│
                    └─────────────────────┬───────────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        │                                 │                                 │
        ▼                                 ▼                                 ▼
┌───────────────┐                 ┌───────────────┐                 ┌───────────────┐
│    xenco5     │                 │    xenco4     │                 │    xenco3     │
│  10.8.8.17    │                 │  10.8.8.16    │                 │  10.8.8.15    │
├───────────────┤                 ├───────────────┤                 ├───────────────┤
│ Redis :6379   │◄───────────────►│ Redis :6379   │◄───────────────►│ Redis :6379   │
│ Sentinel:26379│                 │ Sentinel:26379│                 │ Sentinel:26379│
│   (replica)   │                 │   (MASTER)    │                 │   (replica)   │
└───────────────┘                 └───────────────┘                 └───────────────┘
        │                                 │                                 │
        └─────────────────────────────────┴─────────────────────────────────┘
                              Replication + Sentinel Monitoring
```

---

## Contact

For issues with Redis cluster, contact the infrastructure team or check:
- Logs: `journalctl -u redis-server -f` on any Redis node
- Sentinel logs: `journalctl -u redis-sentinel -f`
- HAProxy status: `docker service logs redis-bridge_redis-bridge`

---

*Last updated: 2026-02-04*
*Redis Native VM Cluster v1.0*
