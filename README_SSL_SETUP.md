# 🔒 TrendCrafters SSL/HTTPS Complete Setup Guide

**Production-Ready HTTPS Configuration + Performance Optimization**

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [What's Included](#whats-included)
3. [Architecture](#architecture)
4. [Pre-Deployment](#pre-deployment)
5. [Deployment Steps](#deployment-steps)
6. [Verification](#verification)
7. [Cloudflare Configuration](#cloudflare-configuration)
8. [Performance Optimization](#performance-optimization)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

---

## Overview

This package provides **complete SSL/HTTPS configuration** for your TrendCrafters Django application running on AWS EC2 with Nginx and Gunicorn.

### What You'll Get

- 🔒 **HTTPS/SSL encryption** via Let's Encrypt
- 🔄 **Auto-renewal** (automatic certificate refresh)
- 🎯 **HTTP→HTTPS redirect** (no redirect loops)
- ⚡ **Performance optimization** (caching + compression)
- 🔐 **Security headers** (HSTS, XSS, CSRF protection)
- 🌍 **Cloudflare integration** (Full Strict SSL mode)
- 📊 **Complete documentation** (troubleshooting guide included)

### Why This Matters

- **Security**: Encrypts all data between client and server
- **Trust**: Shows 🔒 padlock icon in browser
- **SEO**: Google prefers HTTPS sites
- **Compliance**: Required for handling sensitive data
- **Performance**: HTTP/2 over HTTPS is faster than HTTP/1.1

---

## What's Included

### Configuration Files

| File | Purpose |
|------|---------|
| `trendcrafters/settings.py` | Django SSL settings (updated) |
| `NGINX_SSL_CONFIG.md` | Complete Nginx configuration |
| `SSL_DEPLOYMENT_COMMANDS.md` | Step-by-step terminal guide |
| `PERFORMANCE_TROUBLESHOOTING.md` | Speed optimization guide |
| `QUICK_REFERENCE.md` | Commands cheatsheet |
| `INDEX.md` | Navigation guide |
| `README_SSL_SETUP.md` | This file |

### What Gets Installed

- **Certbot**: Certificate automation tool
- **Let's Encrypt Certificate**: Free, auto-renewable SSL/TLS
- **Nginx Configuration**: Updated HTTP/HTTPS handling

### What Stays The Same

- ✅ Django application code
- ✅ HTML/CSS/JavaScript content
- ✅ Database and user data
- ✅ API endpoints and logic
- ✅ Static files and media
- ✅ Template structure

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE CDN                           │
│              (Full Strict SSL mode)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                ┌──────▼──────┐
                │   HTTPS     │ (Port 443)
                │  (Encrypted)│
                └──────┬──────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
   ┌────▼────┐                  ┌────▼────┐
   │  Nginx  │                  │  Nginx  │
   │(HTTP→  │                  │(HTTPS)  │
   │ HTTPS)  │                  │SSL/TLS  │
   └────┬────┘                  └────┬────┘
        │ Port 80 (HTTP)              │ Port 443 (HTTPS)
        │ (Redirect only)             │ (Main server)
        │                             │
        └────────────┬────────────────┘
                     │
              ┌──────▼──────┐
              │  Gunicorn   │ Port 8000
              │  (Internal) │ (Not exposed)
              └──────┬──────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
   ┌────▼────┐          ┌───────────▼────┐
   │ Django  │          │  Static Files  │
   │  App    │          │  (CSS/JS/etc)  │
   └────┬────┘          └────────────────┘
        │
   ┌────▼────┐
   │ SQLite  │
   │Database │
   └─────────┘

Certificate: Let's Encrypt (Free, Auto-renews)
Encryption: TLS 1.2 + 1.3
Caching: Browser (30 days) + Cloudflare (1 hour)
```

---

## Pre-Deployment

### Requirements

- Ubuntu 22.04 on AWS EC2
- Django 4.2+ application
- Gunicorn + Nginx setup (already running)
- Domain pointing to your server (DNS configured)
- Cloudflare active (optional but recommended)

### Verification Checklist

```bash
# ✅ Verify each of these before starting

# 1. Gunicorn running?
ps aux | grep gunicorn | grep -v grep

# 2. Nginx installed?
which nginx

# 3. Domain resolves?
nslookup trendcrafters.global

# 4. AWS Security Group allows 80 + 443?
# (Check AWS Console → EC2 → Security Groups)

# 5. Project structure exists?
ls -la /path/to/project/manage.py
ls -la /path/to/project/trendcrafters/settings.py
ls -la /path/to/project/staticfiles/
```

---

## Deployment Steps

### Phase 1: Install Certbot (2 minutes)

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
certbot --version
```

### Phase 2: Get SSL Certificate (3 minutes)

```bash
# Stop Nginx temporarily (Certbot needs port 80)
sudo systemctl stop nginx

# Get certificate
sudo certbot certonly --standalone \
    -d trendcrafters.global \
    -d www.trendcrafters.global \
    --agree-tos \
    -m your-email@example.com \
    --non-interactive

# Verify certificate created
sudo ls -la /etc/letsencrypt/live/trendcrafters.global/
```

### Phase 3: Update Django Settings (2 minutes)

The file `trendcrafters/settings.py` has been updated with:

```python
# SSL/HTTPS Settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Security Headers
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Cloudflare Proxy Trust
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

**No code changes needed** - just deploy this file to your server:

```bash
cd /path/to/project
git pull origin main  # If using Git
# Or manually copy trendcrafters/settings.py

# Collect static files (important!)
python manage.py collectstatic --noinput

# Restart Gunicorn
sudo systemctl restart gunicorn-trendcrafters
```

### Phase 4: Configure Nginx (5 minutes)

Copy the complete configuration from `NGINX_SSL_CONFIG.md`:

```bash
# Backup current config
sudo cp /etc/nginx/sites-available/trendcrafters \
        /etc/nginx/sites-available/trendcrafters.backup

# Edit config
sudo nano /etc/nginx/sites-available/trendcrafters

# Paste entire content from NGINX_SSL_CONFIG.md
# IMPORTANT: Update these paths:
#   - /path/to/project/staticfiles → your actual path
#   - /path/to/project/media → your actual path

# Test configuration
sudo nginx -t
# Should show: "syntax is ok" and "test is successful"
```

### Phase 5: Start Services (2 minutes)

```bash
# Start Nginx
sudo systemctl start nginx

# Verify Nginx is running
sudo systemctl status nginx

# Restart Gunicorn to ensure it's using new Django settings
sudo systemctl restart gunicorn-trendcrafters
```

---

## Verification

### Test 1: HTTPS Connection

```bash
curl -I https://trendcrafters.global

# Expected output:
# HTTP/2 200
# server: nginx
# strict-transport-security: max-age=31536000
# date: ...
```

### Test 2: HTTP Redirect

```bash
curl -I -L http://trendcrafters.global

# Expected:
# HTTP/1.1 301 Moved Permanently
# Location: https://trendcrafters.global/
# ...
# HTTP/2 200 OK
```

### Test 3: Certificate Validity

```bash
sudo openssl x509 -in /etc/letsencrypt/live/trendcrafters.global/fullchain.pem -noout -dates

# Expected:
# notBefore=May 24 12:34:56 2026 GMT
# notAfter=Aug 22 12:34:56 2026 GMT (about 90 days later)
```

### Test 4: Static Files

```bash
curl -I https://trendcrafters.global/static/css/style.css

# Expected:
# HTTP/2 200 OK
# Cache-Control: public, immutable
# Expires: Sat, 24 Jun 2026 12:12:12 GMT
```

### Test 5: Browser Test

1. Open browser
2. Visit `https://trendcrafters.global`
3. Look for 🔒 padlock icon (secure)
4. Open Developer Tools (F12)
5. Check Console tab - no errors like "Mixed Content"

### Test 6: Certificate Renewal

```bash
# Test renewal (dry run - doesn't actually renew)
sudo certbot renew --dry-run

# Expected:
# Cert not due for renewal, but simulating renewal for dry run
# ...
# Congratulations, all renewals succeeded
```

### Test 7: Performance

```bash
# Measure response time
curl -w "Time to first byte: %{time_starttransfer}s\nTotal time: %{time_total}s\n" \
    -o /dev/null -s https://trendcrafters.global

# Expected: time_total < 2 seconds
```

---

## Cloudflare Configuration

### Step 1: Verify DNS Points to Your Server

```bash
# Your server IP:
curl http://169.254.169.254/latest/meta-data/public-ipv4

# Cloudflare should show this IP as orange/proxied
# (In Cloudflare Dashboard → DNS tab)
```

### Step 2: Set SSL/TLS Mode (Critical!)

1. Log in to **Cloudflare Dashboard**
2. Select your domain: `trendcrafters.global`
3. Go to **SSL/TLS** → **Overview**
4. Set encryption mode to **"Full (strict)"**
   - This requires valid certificate on origin (✅ Let's Encrypt)
   - Cloudflare ↔ Origin: HTTPS (encrypted)
   - Client ↔ Cloudflare: HTTPS (encrypted)

### Step 3: Enable Page Caching

1. Go to **Caching** tab
2. Set **Default Cache Level** to "Cache Everything"
3. Set **Browser Cache TTL** to 1 hour (or longer)
4. Enable **Automatic HTTPS Rewrites** (fixes mixed content)

### Step 4: Verify Configuration

```bash
# Check Cloudflare cache status
curl -I https://trendcrafters.global | grep CF-Cache-Status

# First request: MISS (not cached)
# Subsequent requests: HIT (cached by Cloudflare)
```

---

## Performance Optimization

### Quick Wins (15 minutes)

1. **Increase Gunicorn Workers**
   ```bash
   # Edit service file
   sudo nano /etc/systemd/system/gunicorn-trendcrafters.service
   
   # Change --workers 1 to:
   # --workers 5  (for 2-core CPU: formula is 2×cores + 1)
   
   # Apply
   sudo systemctl daemon-reload
   sudo systemctl restart gunicorn-trendcrafters
   ```

2. **Enable Static File Caching** (Already in Nginx config)
   ```nginx
   # 30-day browser cache
   expires 30d;
   add_header Cache-Control "public, immutable";
   ```

3. **Enable Gzip Compression** (Already in Nginx config)
   ```nginx
   gzip on;
   gzip_types text/plain text/css text/javascript application/json;
   ```

### See Also

For more optimization tips, see `PERFORMANCE_TROUBLESHOOTING.md`:
- Database query optimization
- AWS instance sizing
- Redis caching
- CDN for static files

---

## Troubleshooting

### Issue: Certificate Renewal Failed

```bash
# Check renewal status
sudo certbot certificates

# See renewal logs
sudo journalctl -u certbot -n 50

# Manual renewal
sudo certbot renew --force-renewal
```

### Issue: Mixed Content Warning

**Symptom:** Browser shows "This page contains insecure resources"

**Solution:**
1. Enable Cloudflare "Automatic HTTPS Rewrites"
2. Update hardcoded `http://` URLs to `https://`
3. Use protocol-relative URLs: `//example.com/image.jpg`

### Issue: ERR_TOO_MANY_REDIRECTS

**Symptom:** Browser shows redirect loop

**Solution:**
1. Check Nginx config has separate HTTP (port 80) and HTTPS (port 443) blocks
2. HTTP block should ONLY redirect (no proxy)
3. HTTPS block should proxy to Gunicorn

```nginx
# Wrong - causes loop
server {
    listen 80;
    location / {
        return 301 https://$host$request_uri;
        return 301 https://$host$request_uri;  # Loop!
    }
}

# Correct
server {
    listen 80;
    location / {
        return 301 https://$host$request_uri;  # Only once!
    }
}
```

### Issue: Port 443 Not Responding

```bash
# Check if Nginx listening on 443
sudo lsof -i :443

# Check for errors
sudo nginx -t
sudo tail -50 /var/log/nginx/trendcrafters_error.log

# Verify AWS Security Group allows 443
# (AWS Console → EC2 → Security Groups)

# Restart Nginx
sudo systemctl restart nginx
```

### Issue: Static Files Return 404

```bash
# Check static files exist
ls -la /path/to/project/staticfiles/

# If empty, collect them
python manage.py collectstatic --noinput

# Check Nginx config path matches
sudo grep "alias /path/to/project/staticfiles" /etc/nginx/sites-available/trendcrafters

# Check permissions
sudo ls -la /path/to/project/staticfiles/ | head -5
sudo chown -R ubuntu:www-data /path/to/project/staticfiles/
sudo chmod -R 755 /path/to/project/staticfiles/
```

### Issue: Gunicorn Not Responding

```bash
# Check Gunicorn running
sudo systemctl status gunicorn-trendcrafters

# Check Gunicorn logs
sudo journalctl -u gunicorn-trendcrafters -n 50

# Test Gunicorn directly
curl -I http://127.0.0.1:8000

# Restart
sudo systemctl restart gunicorn-trendcrafters
```

For more issues, see `PERFORMANCE_TROUBLESHOOTING.md` and `SSL_DEPLOYMENT_COMMANDS.md`.

---

## Maintenance

### Daily
- Monitor error logs: `sudo tail -f /var/log/nginx/trendcrafters_error.log`

### Weekly
- Verify Certbot timer: `sudo systemctl status certbot.timer`
- Check disk space: `df -h /`

### Monthly
- Test renewal: `sudo certbot renew --dry-run`
- Review logs for errors
- Update OS: `sudo apt update && sudo apt upgrade`

### Quarterly
- Review SSL configuration for security
- Check certificate expiry: `sudo certbot certificates`
- Verify backups exist

### Backups

```bash
# Backup certificates (do this monthly!)
sudo tar -czf ~/certs-backup-$(date +%Y%m%d).tar.gz /etc/letsencrypt/

# Backup Nginx config
sudo cp /etc/nginx/sites-available/trendcrafters ~/nginx-backup-$(date +%Y%m%d).conf

# Restore if needed
sudo tar -xzf ~/certs-backup-YYYYMMDD.tar.gz -C /
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Certificate expired | Renewal failed | `sudo certbot renew --force-renewal` |
| 502 Bad Gateway | Gunicorn down | `sudo systemctl restart gunicorn-trendcrafters` |
| Static files 404 | Wrong path in Nginx | Update `alias` path in Nginx config |
| Mixed content | HTTP resources on HTTPS page | Enable Cloudflare "Automatic HTTPS Rewrites" |
| Slow loading | Too few workers | Increase `--workers` in Gunicorn service |
| Redirect loop | HTTP block proxies instead of redirects | Fix Nginx HTTP block |
| Can't connect 443 | Port blocked | Check AWS Security Group |

---

## Success Checklist

Before considering SSL setup complete:

- [ ] HTTPS works: `curl -I https://trendcrafters.global` → 200 OK
- [ ] HTTP redirects: `curl -I http://trendcrafters.global` → 301 + 200
- [ ] Certificate valid: `sudo certbot certificates` → not expired
- [ ] Auto-renewal works: `sudo certbot renew --dry-run` → success
- [ ] Static files load: `curl -I https://trendcrafters.global/static/css/style.css` → 200
- [ ] No mixed content: Open site in browser, F12 Console → no errors
- [ ] Cloudflare cache: `curl -I https://trendcrafters.global` → `CF-Cache-Status: HIT`
- [ ] Performance OK: `curl -w %{time_total}` → < 2 seconds
- [ ] All services running: `sudo systemctl status nginx gunicorn-trendcrafters certbot.timer`

---

## Support & Resources

| Topic | Resource |
|-------|----------|
| Quick start | `QUICK_REFERENCE.md` |
| Nginx config | `NGINX_SSL_CONFIG.md` |
| Commands | `SSL_DEPLOYMENT_COMMANDS.md` |
| Performance | `PERFORMANCE_TROUBLESHOOTING.md` |
| Navigation | `INDEX.md` |

---

## Final Notes

✅ **You're all set!** Your website is now production-ready with:
- Secure HTTPS encryption
- Auto-renewing certificates
- Optimized performance
- Enterprise-grade security headers

🔐 **Your data is now encrypted** and your users can trust your site.

📈 **Your SEO is improved** - Google prefers HTTPS sites.

🚀 **Your performance is optimized** - HTTP/2 over HTTPS is faster than HTTP/1.1.

---

**Last Updated:** May 24, 2026  
**Status:** Production Ready ✅  
**Maintainer:** TrendCrafters Team
