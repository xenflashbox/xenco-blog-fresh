PostgreSQL Connection Summary

  External Access (via PgBouncer + SSL)

  Host: db.xencolabs.com
  Port: 5433
  SSL: Required (TLS 1.3 / AES-256-GCM)
  ┌────────────┬─────────────────────────────────────────────────────────────────────────────────────┐
  │  Database  │                                   Connection URL                                    │
  ├────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ Payload    │ postgresql://payload:payload_db_secure_2025db.xencolabs.com:5433/payload?sslmode=require       │
  ├────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ DevMaestro │ postgresql://devmaestro:devmaestro_secure_2025@db.xencolabs.com:5433/devmaestro?sslmode=require │
  ├────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ MCP Forge  │ postgresql://mcpforge:mcpforge_secure_2025@db.xencolabs.com:5433/mcpforge?sslmode=require     │
  ├────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
  │ FightClub  │ postgresql://fightclub:fightclub_secure_2025@db.xencolabs.com:5433/fightclub?sslmode=require │
  └────────────┴─────────────────────────────────────────────────────────────────────────────────────┘
  
   DATABASE_URL_DEVMAESTRO=postgresql://devmaestro:devmaestro_secure_2025@postgres:5432/devmaestro?sslmode=disable
  ---
  Internal Access (Direct - Behind Firewall)

  Host: payload-postgres_postgres (Docker service name)
  Port: 5432
  SSL: Not required (internal overlay network)
  ┌────────────┬────────────────────────────────────────────────────────────────────────────────────┐
  │  Database  │                                   Connection URL                                   │
  ├────────────┼────────────────────────────────────────────────────────────────────────────────────┤
  │ Payload    │ postgresql://payload:payload_db_secure_2025@payload-postgres_postgres:5432/payload │
  ├────────────┼────────────────────────────────────────────────────────────────────────────────────┤
  │ DevMaestro │ postgresql://devmaestro:<password>@payload-postgres_postgres:5432/devmaestro       │
  ├────────────┼────────────────────────────────────────────────────────────────────────────────────┤
  │ MCP Forge  │ postgresql://mcpforge:<password>@payload-postgres_postgres:5432/mcpforge           │
  ├────────────┼────────────────────────────────────────────────────────────────────────────────────┤
  │ FightClub  │ postgresql://fightclub:fightclub_secure_2025@payload-postgres_postgres:5432/fightclub │
  └────────────┴────────────────────────────────────────────────────────────────────────────────────┘
  ---
  Admin API Endpoints
  ┌─────────────────────────┬──────────────────────────────────────────────────────────────┬────────────────────────────────────────────┐
  │         Service         │                           Endpoint                           │                    Auth                    │
  ├─────────────────────────┼──────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
  │ Domain Webhook Health   │ GET https://admin-api.xencolabs.com/domains/health           │ None                                       │
  ├─────────────────────────┼──────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
  │ List CMS Domains        │ GET https://admin-api.xencolabs.com/domains/domains          │ None                                       │
  ├─────────────────────────┼──────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
  │ Sync Domains to Traefik │ POST https://admin-api.xencolabs.com/domains/webhook/domains │ X-Webhook-Secret: payload-domain-sync-2025 │
  └─────────────────────────┴──────────────────────────────────────────────────────────────┴────────────────────────────────────────────┘
  ---
  CloudBeaver SQL Manager

  URL: https://sql.xencolabs.com
  Credentials: Set during initial setup

  ---
  Testing Connectivity

  External (from outside firewall):
  # Test with SSL
  psql "postgresql://payload:<password>@db.xencolabs.com:5433/payload?sslmode=require"

  # Verify SSL connection
  openssl s_client -connect db.xencolabs.com:5433 -starttls postgres

  Internal (from swarm node or container):
  # Direct connection (no SSL)
  psql -h payload-postgres_postgres -U payload -d payload

  # From any container on payload-internal network
  docker run --rm --network payload-postgres_payload-internal postgres:17-alpine \
    psql -h payload-postgres_postgres -U payload -d payload

  ---
  Network Details
  ┌─────────────────────────┬───────────────────────────────────┐
  │        Component        │            IP/Network             │
  ├─────────────────────────┼───────────────────────────────────┤
  │ External IP (PgBouncer) │ 216.129.110.53                    │
  ├─────────────────────────┼───────────────────────────────────┤
  │ Traefik Proxy IP        │ 216.129.110.58                    │
  ├─────────────────────────┼───────────────────────────────────┤
  │ Internal Network        │ payload-postgres_payload-internal │
  ├─────────────────────────┼───────────────────────────────────┤
  │ PgBouncer Port          │ 5433 (external) → 5432 (internal) │
  └─────────────────────────┴───────────────────────────────────┘


● Hairpin NAT is fully working! Both tests passed:
  ┌──────────────────────┬────────────────────────────────────────────────┬─────────────────────────┐
  │         Test         │                      URL                       │         Result          │
  ├──────────────────────┼────────────────────────────────────────────────┼─────────────────────────┤
  │ Admin API            │ https://admin-api.xencolabs.com/domains/health │ ✅ {"status": "ok"}     │
  ├──────────────────────┼────────────────────────────────────────────────┼─────────────────────────┤
  │ PgBouncer/PostgreSQL │ db.xencolabs.com:5433                          │ ✅ Hairpin NAT working! │
  └──────────────────────┴────────────────────────────────────────────────┴─────────────────────────┘
  You can now test all external URLs from inside your network. Internal clients will properly route through the firewall and back to your internal services.

