# NFS Migration Summary

## ✅ Completed Tasks

### 1. NFS Server Setup (10.8.8.108)
- ✅ Created `/home/xen/create-nfs-share.sh` helper script
- ✅ Created NFS shares for all 19 apps with standard subdirectories
- ✅ Single NFS export: `/nfs/swarm` → 10.0.0.0/8

### 2. Data Migration
- ✅ **Verdaccio**: Migrated 3.4GB (storage + backups + conf)
- ⚠️  **Traefik**: Empty dirs migrated, but `acme.json` (SSL certs) needs manual copy

### 3. Updated Stack Files
Created NFS-enabled stack files in `/home/xen/`:
- ✅ `blogcraft-stack-nfs.yml`
- ✅ `resumecoach-stack-nfs.yml`
- ✅ `promptmarketer-stack-nfs.yml`
- ✅ `landingcraft-stack-nfs.yml`

---

## 📊 Before vs After

### Old Way (10.8.8.14)
```
28 separate NFS exports in /etc/exports
Bind mounts: source: /srv/app-uploads
Each app needs 3 entries in /etc/exports
```

### New Way (10.8.8.108)
```
1 NFS export: /nfs/swarm
NFS volumes in stack files (auto-mount)
Zero manual mounting required
```

---

## 🎯 How to Use NFS for New Apps

### Option 1: Use the Helper Script
```bash
cd /home/xen
./create-nfs-share.sh myapp uploads cache public data
```

### Option 2: Docker Auto-Creates Subdirs
Just ensure parent exists:
```bash
sudo mkdir -p /nfs/swarm/myapp
sudo chown nobody:nogroup /nfs/swarm/myapp
```

Then in your stack file, Docker creates subdirs automatically:
```yaml
volumes:
  myapp-uploads:
    driver: local
    driver_opts:
      type: nfs
      o: addr=10.8.8.108,rw,sync,nfsvers=4
      device: ":/nfs/swarm/myapp/uploads"  # Auto-created
```

---

## 📋 NFS Shares Created

| App | Path | Subdirectories |
|-----|------|----------------|
| blogcraft | /nfs/swarm/blogcraft | uploads, cache, public, data |
| reresume | /nfs/swarm/reresume | uploads, cache, public, data |
| promptmarketer | /nfs/swarm/promptmarketer | uploads, cache, public, data |
| landingcraft | /nfs/swarm/landingcraft | uploads, cache, public, data |
| launchcraft | /nfs/swarm/launchcraft | uploads, cache, public, data |
| legalcraft | /nfs/swarm/legalcraft | uploads, cache, public, data |
| lexi-explains | /nfs/swarm/lexi-explains | uploads, cache, public, data |
| mcp-forge | /nfs/swarm/mcp-forge | uploads, cache, public, data |
| fightclub-tech | /nfs/swarm/fightclub-tech | uploads, cache, public, data |
| ewp | /nfs/swarm/ewp | uploads, cache, public, data |
| dev-maestro | /nfs/swarm/dev-maestro | uploads, cache, public, data |
| dm-backend | /nfs/swarm/dm-backend | uploads, cache, public, data |
| wordpress-swarm | /nfs/swarm/wordpress-swarm | uploads, cache, public, data |
| xencolabs | /nfs/swarm/xencolabs | uploads, cache, public, data |
| snackable-tiktok | /nfs/swarm/snackable-tiktok | uploads, cache, public, data |
| sonomagrove-suites | /nfs/swarm/sonomagrove-suites | uploads, cache, public, data |
| winecountry-corner | /nfs/swarm/winecountry-corner | uploads, cache, public, data |
| **verdaccio** | /nfs/swarm/verdaccio | storage, backups, conf, plugins |
| **traefik** | /nfs/swarm/traefik | acme, logs, tmp, dynamic |

---

## ⚠️ Action Items

### Traefik SSL Certificates
The `acme.json` file (375KB, root-only permissions) couldn't be copied automatically.

**To manually migrate:**
```bash
# On 10.8.8.14 (old server)
sudo cat /srv/traefik-acme/acme.json > /tmp/acme.json
scp /tmp/acme.json xen@10.8.8.108:/tmp/

# On 10.8.8.108 (new server)
sudo mv /tmp/acme.json /nfs/swarm/traefik/acme/
sudo chmod 600 /nfs/swarm/traefik/acme/acme.json
sudo chown root:root /nfs/swarm/traefik/acme/acme.json
```

**Or:** Let Traefik regenerate certificates on first deployment (takes ~2 minutes)

---

## 🚀 Deployment Steps

### For Each App (e.g., Blogcraft)

1. **Copy updated stack file to management node:**
   ```bash
   scp /home/xen/blogcraft-stack-nfs.yml xen@10.8.8.14:/home/xen/Docker/apps/blogcraft-c1sdk/
   ```

2. **Deploy the stack:**
   ```bash
   cd /home/xen/Docker/apps/blogcraft-c1sdk/
   docker stack deploy -c blogcraft-stack-nfs.yml blogcraft
   ```

3. **Verify NFS mounts:**
   ```bash
   docker exec $(docker ps -q -f name=blogcraft) df -h | grep nfs
   ```

4. **Check app health:**
   ```bash
   docker service ls | grep blogcraft
   docker service logs blogcraft_blogcraft-c1-frontend --tail 50
   ```

---

## 📁 Files Created

| File | Location | Purpose |
|------|----------|---------|
| `create-nfs-share.sh` | /home/xen/ | Helper script for adding new apps |
| `blogcraft-stack-nfs.yml` | /home/xen/ | Updated blogcraft stack |
| `resumecoach-stack-nfs.yml` | /home/xen/ | Updated resumecoach stack |
| `promptmarketer-stack-nfs.yml` | /home/xen/ | Updated promptmarketer stack |
| `landingcraft-stack-nfs.yml` | /home/xen/ | Updated landingcraft stack |
| `setup_swarm_nfs_node.sh` | /home/xen/ | Original server bootstrap script |
| `NFS_MIGRATION_SUMMARY.md` | /home/xen/ | This file |

---

## 🔧 Example Stack File Changes

### Before (Bind Mount)
```yaml
volumes:
  - type: bind
    source: /srv/blogcraft-uploads
    target: /app/public/uploads
```

### After (NFS Volume)
```yaml
volumes:
  - nfs-blogcraft-uploads:/app/public/uploads

volumes:
  nfs-blogcraft-uploads:
    driver: local
    driver_opts:
      type: nfs
      o: addr=10.8.8.108,rw,sync,nfsvers=4
      device: ":/nfs/swarm/blogcraft/uploads"
```

---

## 🎉 Benefits

✅ **No more manual NFS exports** - One export serves all apps
✅ **No per-node mounting** - Docker handles it automatically
✅ **Cleaner stack files** - Self-documenting NFS config
✅ **Easy to add apps** - Just create directory or use script
✅ **Works across all nodes** - Any replica on any node accesses same data
✅ **Future-proof** - Easy to migrate to different NFS server if needed

---

## 📞 Next Steps

1. Test with one app (e.g., blogcraft) before migrating others
2. Manually copy Traefik SSL certs if needed
3. Update remaining apps one at a time
4. Decommission old NFS on 10.8.8.14 after validation
