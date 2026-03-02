#!/usr/bin/env python3
"""
Domain Webhook Server for Payload CMS
Listens for domain changes and updates Traefik labels automatically

Usage:
    python3 domain-webhook-server.py

Endpoints:
    POST /webhook/domains - Triggered when domains change in Payload
    GET /health - Health check
    GET /domains - List current configured domains

Environment:
    WEBHOOK_SECRET - Secret token for authentication
    STACK_FILE - Path to docker-stack-payload.yml
    DATABASE_URL - PostgreSQL connection string
"""

import os
import json
import subprocess
import logging
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

# Try to import psycopg2, fall back gracefully
try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

# Configuration
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', 'payload-domain-sync-2025')
STACK_FILE = os.environ.get('STACK_FILE', '/home/xen/docker/apps/payload-swarm/docker-stack-payload.yml')
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://payload:payload@payload-postgres_postgres:5432/payload')
PRIMARY_DOMAIN = 'publish.xencolabs.com'
PORT = 9099

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_domains_from_db():
    """Fetch domains from the sites_domains table using direct PostgreSQL connection"""
    if not HAS_PSYCOPG2:
        logger.error("psycopg2 not installed - cannot connect to database")
        return []

    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        query = """
            SELECT DISTINCT
                CASE
                    WHEN domain LIKE 'www.%%' THEN SUBSTRING(domain FROM 5)
                    ELSE domain
                END as base_domain
            FROM sites_domains
            WHERE domain NOT LIKE 'cms.%%'
            ORDER BY base_domain;
        """

        cur.execute(query)
        rows = cur.fetchall()
        domains = [row[0] for row in rows if row[0]]

        cur.close()
        conn.close()

        return domains

    except Exception as e:
        logger.error(f"Error fetching domains from database: {e}")
        return []

def build_traefik_rule(domains):
    """Build Traefik router rule from domain list"""
    rules = [f"Host(`{PRIMARY_DOMAIN}`)"]

    for domain in domains:
        if domain:
            rules.append(f"Host(`cms.{domain}`)")

    return ' || '.join(rules)

def update_stack_file(rule):
    """Update the docker stack file with new Traefik rule"""
    try:
        # Backup
        subprocess.run(['cp', STACK_FILE, f'{STACK_FILE}.bak'], check=True)

        # Read current file
        with open(STACK_FILE, 'r') as f:
            content = f.read()

        # Find and replace the rule line
        pattern = r'traefik\.http\.routers\.payload-swarm\.rule=[^"]*"'
        replacement = f'traefik.http.routers.payload-swarm.rule={rule}"'

        new_content = re.sub(pattern, replacement, content)

        with open(STACK_FILE, 'w') as f:
            f.write(new_content)

        logger.info("Stack file updated successfully")
        return True
    except Exception as e:
        logger.error(f"Error updating stack file: {e}")
        return False

def deploy_stack():
    """Deploy the updated stack using docker socket"""
    try:
        result = subprocess.run(
            ['docker', 'stack', 'deploy', '-c', STACK_FILE, 'payload-swarm', '--with-registry-auth'],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            logger.info(f"Deploy output: {result.stdout}")
            return True
        else:
            logger.error(f"Deploy failed: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"Error deploying stack: {e}")
        return False

class WebhookHandler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        path = urlparse(self.path).path

        if path == '/health':
            self.send_json(200, {
                'status': 'ok',
                'service': 'domain-webhook',
                'database_available': HAS_PSYCOPG2
            })

        elif path == '/domains':
            domains = get_domains_from_db()
            rule = build_traefik_rule(domains)
            self.send_json(200, {
                'primary': PRIMARY_DOMAIN,
                'domains': [f'cms.{d}' for d in domains],
                'total': len(domains) + 1,
                'rule': rule
            })

        else:
            self.send_json(404, {'error': 'Not found'})

    def do_POST(self):
        path = urlparse(self.path).path

        # Check authentication
        auth_header = self.headers.get('X-Webhook-Secret', '')
        if auth_header != WEBHOOK_SECRET:
            logger.warning(f"Unauthorized request from {self.client_address}")
            self.send_json(401, {'error': 'Unauthorized'})
            return

        if path == '/webhook/domains':
            logger.info("Domain sync triggered via webhook")

            # Get domains
            domains = get_domains_from_db()
            logger.info(f"Found {len(domains)} base domains")

            if not domains:
                self.send_json(500, {'error': 'Failed to fetch domains from database'})
                return

            # Build rule
            rule = build_traefik_rule(domains)
            logger.info(f"Built rule with {len(domains) + 1} hosts")

            # Update stack file
            if not update_stack_file(rule):
                self.send_json(500, {'error': 'Failed to update stack file'})
                return

            # Deploy
            if not deploy_stack():
                self.send_json(500, {'error': 'Failed to deploy stack'})
                return

            self.send_json(200, {
                'success': True,
                'domains_synced': len(domains) + 1,
                'message': 'Traefik labels updated and stack redeployed'
            })

        else:
            self.send_json(404, {'error': 'Not found'})

    def log_message(self, format, *args):
        logger.info(f"{self.client_address[0]} - {args[0]}")

def main():
    if not HAS_PSYCOPG2:
        logger.warning("psycopg2 not available - database queries will fail")
        logger.warning("Install with: pip install psycopg2-binary")

    server = HTTPServer(('0.0.0.0', PORT), WebhookHandler)
    logger.info(f"Domain Webhook Server starting on port {PORT}")
    logger.info(f"Database URL: {DATABASE_URL.replace(DATABASE_URL.split(':')[2].split('@')[0], '***')}")
    logger.info(f"Endpoints:")
    logger.info(f"  GET  /health - Health check")
    logger.info(f"  GET  /domains - List configured domains")
    logger.info(f"  POST /webhook/domains - Sync domains (requires X-Webhook-Secret header)")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        server.shutdown()

if __name__ == '__main__':
    main()
