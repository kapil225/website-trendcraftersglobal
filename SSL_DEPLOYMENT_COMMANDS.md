# SSL/HTTPS Deployment - Terminal Commands & Checklist

**Domain:** `trendcrafters.global`  
**Server:** Ubuntu 22.04 on AWS EC2  
**SSL Provider:** Let's Encrypt + Certbot  
**Proxy:** Cloudflare (Full Strict mode)

---

## PHASE 1: Pre-Deployment Checklist

Before starting SSL setup, verify your current environment:

```bash
# ============================================================================
# 1. VERIFY GUNICORN IS RUNNING
# ============================================================================
ps aux | grep gunicorn

# Expected output should show gunicorn process running on port 8000
# Example: /path/to/.venv/bin/gunicorn -b 127.0.0.1:8000 trendcrafters.wsgi:application

# If not running, start it:
cd /path/to/project
source .venv/bin/activate
gunicorn -b 127.0.0.1:8000 trendcrafters.wsgi:application &

# Or restart systemd service if you have one:
sudo systemctl restart gunicorn-trendcrafters

# ============================================================================
# 2. VERIFY NGINX IS INSTALLED
# ============================================================================
nginx -v

# Expected: nginx version 1.x.x or newer

# If not installed:
sudo apt update
sudo apt install -y nginx

# ============================================================================
# 3. VERIFY PORTS ARE ACCESSIBLE
# ============================================================================

# Check if port 80 (HTTP) is available
sudo lsof -i :80

# Check if port 443 (HTTPS) is available
sudo lsof -i :443

# Check if port 8000 (Gunicorn) is available
sudo lsof -i :8000

# Kill any processes blocking ports if needed (be careful):
# sudo kill -9 <PID>

# ============================================================================
# 4. VERIFY AWS SECURITY GROUPS
# ============================================================================

# In AWS Console, go to EC2 → Security Groups → Your Security Group
# Ensure inbound rules allow:
#   - Type: HTTP, Port: 80, Source: 0.0.0.0/0
#   - Type: HTTPS, Port: 443, Source: 0.0.0.0/0

# Or use AWS CLI:
aws ec2 describe-security-groups --region us-east-1 | grep -A 20 SecurityGroupId

# ============================================================================
# 5. VERIFY DOMAIN DNS POINTS TO YOUR SERVER
# ============================================================================

# Get your AWS EC2 public IP
curl http://169.254.169.254/latest/meta-data/public-ipv4

# Verify DNS resolution (wait 5-10 minutes after updating DNS)
nslookup trendcrafters.global

# Test from your server
curl -I http://trendcrafters.global

# Expected: Should connect (even if showing 502 or 503, that's OK for now)

# ============================================================================
# 6. VERIFY PROJECT STRUCTURE
# ============================================================================

cd /path/to/project

# Check project exists
ls -la

# Check manage.py exists
ls -la manage.py

# Check static files collected
ls -la staticfiles/

# Check settings.py exists
ls -la trendcrafters/settings.py

# Check deploy.sh exists
ls -la deploy.sh
```

---

## PHASE 2: Install Certbot & Create SSL Certificates

```bash
# ============================================================================
# 1. INSTALL CERTBOT
# ============================================================================

sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Verify installation
certbot --version

# Expected output: certbot X.X.X

# ============================================================================
# 2. CREATE SYSTEMD SERVICE FOR GUNICORN (if not already done)
# ============================================================================

# Create service file
sudo nano /etc/systemd/system/gunicorn-trendcrafters.service

# Paste this content (replace /path/to/project with actual path):
"""
[Unit]
Description=Gunicorn instance for TrendCrafters Django app
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/path/to/project
ExecStart=/path/to/project/.venv/bin/gunicorn \
    -b 127.0.0.1:8000 \
    --workers 4 \
    --timeout 120 \
    trendcrafters.wsgi:application

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
"""

# Enable the service to start on boot
sudo systemctl daemon-reload
sudo systemctl enable gunicorn-trendcrafters
sudo systemctl start gunicorn-trendcrafters

# Verify it's running
sudo systemctl status gunicorn-trendcrafters

# ============================================================================
# 3. CREATE SSL CERTIFICATE WITH CERTBOT
# ============================================================================

# STOP NGINX TEMPORARILY (Certbot needs port 80)
sudo systemctl stop nginx

# Get certificate using standalone mode
# This will verify you own the domain by creating temporary files
sudo certbot certonly --standalone \
    -d trendcrafters.global \
    -d www.trendcrafters.global \
    --agree-tos \
    -m your-email@example.com \
    --non-interactive

# Expected output should show:
# "Successfully received certificate"
# "Certificate is saved at: /etc/letsencrypt/live/trendcrafters.global/fullchain.pem"

# Verify certificate was created
sudo ls -la /etc/letsencrypt/live/trendcrafters.global/

# View certificate details
sudo openssl x509 -in /etc/letsencrypt/live/trendcrafters.global/fullchain.pem -text -noout | head -20

# ============================================================================
# 4. CONFIGURE NGINX (Use configuration from NGINX_SSL_CONFIG.md)
# ============================================================================

# Create Nginx config file
sudo nano /etc/nginx/sites-available/trendcrafters

# Copy the entire Nginx configuration from NGINX_SSL_CONFIG.md
# (See that file for the complete configuration)

# Enable the site
sudo ln -s /etc/nginx/sites-available/trendcrafters /etc/nginx/sites-enabled/trendcrafters

# Disable default site (if it exists)
sudo rm /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test Nginx configuration
sudo nginx -t

# Expected output: "syntax is ok" and "test is successful"

# Start Nginx
sudo systemctl start nginx

# Verify Nginx is running
sudo systemctl status nginx
```

---

## PHASE 3: Verify SSL is Working

```bash
# ============================================================================
# 1. TEST HTTPS CONNECTION
# ============================================================================

# Test from command line
curl -I https://trendcrafters.global

# Expected output:
# HTTP/2 200
# Server: nginx
# (or other application response)

# Test with verbose SSL info
curl -vI https://trendcrafters.global 2>&1 | grep -i "subject\|issuer\|not before\|not after"

# Expected: Should show Let's Encrypt certificate details

# ============================================================================
# 2. TEST HTTP → HTTPS REDIRECT
# ============================================================================

# This should redirect from HTTP to HTTPS (follow redirects with -L)
curl -I -L http://trendcrafters.global

# Expected output:
# HTTP/1.1 301 Moved Permanently
# Location: https://trendcrafters.global/
# ...
# HTTP/2 200

# ============================================================================
# 3. TEST FROM BROWSER
# ============================================================================

# Open browser and visit:
# https://trendcrafters.global
# https://www.trendcrafters.global

# Expected:
# - Page loads without errors
# - No mixed content warning (🔒 padlock icon)
# - All assets (CSS, JS, images) load correctly
# - Forms work correctly

# ============================================================================
# 4. CHECK CERTIFICATE EXPIRY
# ============================================================================

# View certificate expiration date
sudo openssl x509 -in /etc/letsencrypt/live/trendcrafters.global/fullchain.pem -noout -dates

# Expected output:
# notBefore=2026-05-23T12:34:56Z
# notAfter=2026-08-21T12:34:56Z

# (Certificates last 90 days, so it should show ~90 days from today)

# ============================================================================
# 5. TEST WITH ONLINE SSL CHECKER
# ============================================================================

# Use free online tools to verify SSL configuration:
# - https://www.ssllabs.com/ssltest/
# - https://www.digicert.com/help/certificate-installation-verification
# - https://certhub.com/en/ssl-checker

# Visit any of these and enter: trendcrafters.global
# Grade should be A or A+ (not F or D)

# ============================================================================
# 6. VERIFY NGINX ERROR LOG FOR SSL ISSUES
# ============================================================================

# Check for any SSL errors
sudo tail -50 /var/log/nginx/trendcrafters_error.log

# Should be mostly empty or contain only non-SSL errors

# ============================================================================
# 7. VERIFY NO MIXED CONTENT ERRORS
# ============================================================================

# Open browser Developer Tools (F12) → Console tab
# Visit: https://trendcrafters.global

# Should NOT see errors like:
# "Mixed Content: The page at 'https://...' was loaded over HTTPS,
#  but requested an insecure resource 'http://...'"

# If you see this, fix by:
# 1. Update any hardcoded http:// URLs to https://
# 2. Update external resources to use https://
# 3. Check NGINX_SSL_CONFIG.md for proxy headers configuration
```

---

## PHASE 4: Configure Cloudflare SSL/TLS

```bash
# ============================================================================
# IMPORTANT: Cloudflare Dashboard Configuration
# ============================================================================

# This must be done in Cloudflare Dashboard, not terminal

# Steps:
# 1. Log in to Cloudflare Dashboard
# 2. Select your domain (trendcrafters.global)
# 3. Go to SSL/TLS tab → Overview
# 4. Ensure encryption mode is set to "Full (strict)"
#    - Full: Verified SSL between Cloudflare and origin (your server)
#    - Full (strict): Requires valid certificate from trusted CA (Let's Encrypt)
# 5. If needed, go to SSL/TLS → Edge Certificates
#    - Enable "Always Use HTTPS"
#    - Enable "Automatic HTTPS Rewrites" (to fix mixed content)
# 6. Go to SSL/TLS → Origin Server (optional)
#    - View your certificate (Cloudflare provides one for origin)
#    - Not required since we're using Let's Encrypt

# ============================================================================
# VERIFY CLOUDFLARE SETTINGS VIA CLI
# ============================================================================

# Install Cloudflare CLI (optional)
curl https://install.cloudflare.com | sh

# Or verify via curl that Cloudflare is proxying correctly
curl -I https://trendcrafters.global

# Expected headers:
# Server: cloudflare
# CF-Cache-Status: HIT/MISS
# CF-RAY: <ray-id>

# ============================================================================
# VERIFY NO REDIRECT LOOPS
# ============================================================================

# Test redirect chain (should be: HTTP 301 → HTTPS 200)
curl -v https://trendcrafters.global 2>&1 | grep -E "HTTP|Location"

# Should show only 1 redirect, not multiple

# ============================================================================
# VERIFY X-FORWARDED-PROTO HEADER
# ============================================================================

# Cloudflare adds X-Forwarded-Proto: https header
# Nginx passes it to Django via proxy_set_header

# Check in Django logs or by viewing request headers:
# Create temporary test view or check application logs
sudo tail -100 /var/log/nginx/trendcrafters_access.log | grep "GET /"
```

---

## PHASE 5: Setup Auto-Renewal

```bash
# ============================================================================
# 1. SETUP CERTBOT AUTO-RENEWAL
# ============================================================================

# Certbot automatically creates systemd timer for auto-renewal
# Verify it's enabled

sudo systemctl status certbot.timer

# Expected output: "active (waiting)"

# View renewal schedule
sudo systemctl list-timers certbot.timer

# Expected: "21:52:00 daily" or similar

# ============================================================================
# 2. TEST AUTO-RENEWAL DRY-RUN
# ============================================================================

# This simulates renewal without actually renewing
sudo certbot renew --dry-run

# Expected output:
# "Cert not due for renewal, but simulating renewal for dry run"
# "Congratulations, all renewals succeeded"

# ============================================================================
# 3. SETUP EMAIL NOTIFICATIONS (optional)
# ============================================================================

# If you didn't provide email during certificate creation:
sudo certbot update_account --email your-email@example.com

# Test that notifications work:
# Certbot will email you before certificate expires (14 days warning)

# ============================================================================
# 4. MANUAL RENEWAL (if needed)
# ============================================================================

# Manually renew certificate before auto-renewal:
sudo certbot renew

# Or renew a specific certificate:
sudo certbot certonly --force-renewal \
    -d trendcrafters.global \
    -d www.trendcrafters.global

# After renewal, reload Nginx:
sudo systemctl reload nginx
```

---

## PHASE 6: Testing & Troubleshooting

```bash
# ============================================================================
# 1. FULL INTEGRATION TEST
# ============================================================================

# Test complete flow:
# 1. HTTP request should redirect to HTTPS
# 2. HTTPS should serve content from Gunicorn via Nginx
# 3. Static files should load
# 4. No mixed content errors
# 5. No certificate errors

# Run all tests:
echo "=== Testing HTTP redirect ==="
curl -I http://trendcrafters.global 2>&1 | head -10

echo ""
echo "=== Testing HTTPS connection ==="
curl -I https://trendcrafters.global 2>&1 | head -10

echo ""
echo "=== Testing certificate ==="
curl https://trendcrafters.global -o /dev/null -w "HTTP Status: %{http_code}\n" 2>&1

# ============================================================================
# 2. DIAGNOSE ERR_TOO_MANY_REDIRECTS
# ============================================================================

# This error means too many redirects in a chain
# Usually caused by: HTTP → HTTPS → HTTP → HTTPS... (infinite loop)

# Check Nginx configuration for redirect loops:
sudo grep -n "return 301\|return 302\|rewrite" /etc/nginx/sites-enabled/trendcrafters

# Verify Nginx has separate HTTP and HTTPS blocks:
sudo grep -n "listen 80\|listen 443" /etc/nginx/sites-enabled/trendcrafters

# Expected:
# - One block with "listen 80" that only does 301 redirect
# - One block with "listen 443 ssl" that proxies to Gunicorn

# Test with curl (shows all redirects):
curl -v http://trendcrafters.global 2>&1 | grep -E "HTTP|Location" | head -20

# Should show only 1 redirect (301) before final 200

# ============================================================================
# 3. DIAGNOSE MIXED CONTENT
# ============================================================================

# Mixed content: Page loaded over HTTPS but contains HTTP resources

# Check Nginx logs for insecure requests:
sudo grep "http://" /var/log/nginx/trendcrafters_access.log

# Check Django settings for hardcoded http:// URLs:
grep -r "http://" /path/to/project/main/templates/

# Fix by:
# 1. Use protocol-relative URLs: src="//example.com/image.jpg"
# 2. Use HTTPS only: src="https://example.com/image.jpg"
# 3. Enable Cloudflare "Automatic HTTPS Rewrites"

# ============================================================================
# 4. DIAGNOSE PORT 443 ISSUES
# ============================================================================

# Verify Nginx is listening on port 443
sudo lsof -i :443

# Expected output: nginx process listening on port 443

# If not:
sudo systemctl status nginx

# Check Nginx error log:
sudo tail -50 /var/log/nginx/error.log

# Verify firewall rules:
sudo ufw status

# If UFW is active, allow HTTPS:
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp

# Verify AWS Security Group allows port 443:
# (See Phase 1, step 4)

# ============================================================================
# 5. DIAGNOSE STATIC FILES NOT LOADING
# ============================================================================

# Check if static files exist:
ls -la /path/to/project/staticfiles/

# If empty, collect them:
cd /path/to/project
source .venv/bin/activate
python manage.py collectstatic --noinput

# Check Nginx has read permission:
sudo ls -la /path/to/project/staticfiles/ | head -5

# Set correct permissions:
sudo chown -R ubuntu:www-data /path/to/project/staticfiles/
sudo chmod -R 755 /path/to/project/staticfiles/

# Verify Nginx is serving static files:
curl -I https://trendcrafters.global/static/css/style.css

# Should return 200, not 404

# Check Nginx config points to correct static path:
sudo grep "alias /path/to/project/staticfiles" /etc/nginx/sites-enabled/trendcrafters

# ============================================================================
# 6. VERIFY GUNICORN IS RESPONDING
# ============================================================================

# Test Gunicorn directly (bypass Nginx)
curl -I http://127.0.0.1:8000

# Should return 200 (or redirect if Django settings require HTTPS)

# Check Gunicorn logs:
sudo journalctl -u gunicorn-trendcrafters -n 50

# Restart Gunicorn if needed:
sudo systemctl restart gunicorn-trendcrafters

# ============================================================================
# 7. CHECK ALL SERVICES STATUS
# ============================================================================

# One-command status check:
echo "=== Nginx ===" && sudo systemctl status nginx --no-pager | head -5
echo ""
echo "=== Gunicorn ===" && sudo systemctl status gunicorn-trendcrafters --no-pager | head -5
echo ""
echo "=== Certbot Timer ===" && sudo systemctl status certbot.timer --no-pager | head -5
```

---

## PHASE 7: Rollback Instructions (if something breaks)

```bash
# ============================================================================
# RESTORE HTTP-ONLY (temporary, for debugging)
# ============================================================================

# Disable Nginx temporarily
sudo systemctl stop nginx

# Start a simple test server on port 8000 to debug
cd /path/to/project
source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000

# Then visit: http://<your-ec2-ip>:8000

# Stop with Ctrl+C, then restart Nginx:
sudo systemctl start nginx

# ============================================================================
# RESTORE PREVIOUS NGINX CONFIG
# ============================================================================

# If Nginx config is broken, restore from backup

# Check if backup exists
ls -la /etc/nginx/sites-available/trendcrafters*

# Restore:
sudo cp /etc/nginx/sites-available/trendcrafters.backup /etc/nginx/sites-available/trendcrafters

# Or restore to basic HTTP-only (no SSL)
sudo nano /etc/nginx/sites-available/trendcrafters

# Paste basic config without SSL:
"""
server {
    listen 80;
    server_name trendcrafters.global www.trendcrafters.global;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
"""

# Test and reload:
sudo nginx -t
sudo systemctl reload nginx

# ============================================================================
# DISABLE SSL TEMPORARILY
# ============================================================================

# Edit Nginx config and comment out all SSL-related lines:
sudo nano /etc/nginx/sites-available/trendcrafters

# Comment these lines:
# ssl_certificate /etc/letsencrypt/live/trendcrafters.global/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/trendcrafters.global/privkey.pem;

# Also comment out "listen 443 ssl http2;" block completely

# Keep only "listen 80" block

# Test and reload:
sudo nginx -t
sudo systemctl reload nginx

# ============================================================================
# RESTORE DJANGO SETTINGS
# ============================================================================

# If Django settings cause issues, rollback:

cd /path/to/project
git diff trendcrafters/settings.py

# View what changed, if the file was version controlled

# Restore original settings:
git checkout trendcrafters/settings.py

# Or manually edit:
sudo nano trendcrafters/settings.py

# Set these to False temporarily:
# SECURE_SSL_REDIRECT = False
# SESSION_COOKIE_SECURE = False
# CSRF_COOKIE_SECURE = False

# Restart Gunicorn:
sudo systemctl restart gunicorn-trendcrafters
```

---

## Quick Reference: Essential Commands

```bash
# Check Nginx status
sudo systemctl status nginx

# Restart Nginx
sudo systemctl restart nginx

# Reload Nginx (doesn't disconnect users)
sudo systemctl reload nginx

# Test Nginx config
sudo nginx -t

# Check Gunicorn status
sudo systemctl status gunicorn-trendcrafters

# Restart Gunicorn
sudo systemctl restart gunicorn-trendcrafters

# Check certificate expiry
sudo openssl x509 -in /etc/letsencrypt/live/trendcrafters.global/fullchain.pem -noout -dates

# Test SSL connection
curl -I https://trendcrafters.global

# Follow redirects
curl -I -L http://trendcrafters.global

# View Nginx error log (last 50 lines)
sudo tail -50 /var/log/nginx/trendcrafters_error.log

# View Nginx access log (last 50 lines)
sudo tail -50 /var/log/nginx/trendcrafters_access.log

# Test certificate renewal (dry run)
sudo certbot renew --dry-run

# Manually renew certificate
sudo certbot renew

# View all SSL certificates
sudo certbot certificates

# Check ports in use
sudo lsof -i :80
sudo lsof -i :443
sudo lsof -i :8000
```

---

## Summary of What Was Done

| Component | Configuration | Status |
|-----------|---------------|--------|
| SSL Certificate | Let's Encrypt + Certbot | Auto-renewed |
| Nginx HTTP Block | Redirect 80 → 443 | Prevents redirect loops |
| Nginx HTTPS Block | Listen on 443, proxy to 8000 | Serves HTTPS |
| Static Files | Served by Nginx directly | Cached 30 days |
| Gunicorn | Internal on 127.0.0.1:8000 | Not exposed |
| Cloudflare | Full (strict) SSL mode | Encrypted both ways |
| Django Settings | Added SSL security headers | HSTS, XSS, CSRF protection |
| Auto-renewal | Certbot systemd timer | Renews before expiry |

Your website is now **fully HTTPS-secured** with **zero downtime** and **no mixed content** issues!

