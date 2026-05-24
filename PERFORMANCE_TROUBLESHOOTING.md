# Website Performance Troubleshooting Guide

**Problem:** Website is loading slowly  
**Affected Stack:** Django + Gunicorn + Nginx + Cloudflare + AWS EC2

---

## Quick Diagnosis: Run These Commands First

```bash
# ============================================================================
# 1. CHECK SERVER RESPONSIVENESS (Latency from client to server)
# ============================================================================

# From your local machine (not SSH):
curl -w "\nTime to first byte: %{time_starttransfer}s\nTotal time: %{time_total}s\n" \
    -o /dev/null -s https://trendcrafters.global

# Expected: time_total < 2 seconds for homepage

# From EC2 server (check internal latency):
curl -w "\nTime to first byte: %{time_starttransfer}s\nTotal time: %{time_total}s\n" \
    -o /dev/null -s http://127.0.0.1:8000

# Expected: time_total < 0.5 seconds (internal should be fast)

# ============================================================================
# 2. CHECK CPU & MEMORY USAGE
# ============================================================================

# Overall system resources:
free -h
df -h

# Specific process usage:
ps aux | grep -E "gunicorn|nginx|python" | grep -v grep

# Real-time monitoring:
top -b -n 1 | head -20

# Check if any process is using 100% CPU:
top -b -n 1 | awk '$9 > 90 {print}'

# ============================================================================
# 3. CHECK DISK SPACE (Full disk = slow server)
# ============================================================================

df -h /

# If usage > 90%, you need to free up space:
du -sh /* | sort -rh | head -10

# ============================================================================
# 4. CHECK NETWORK CONNECTIVITY
# ============================================================================

# Ping from EC2 to internet
ping -c 4 8.8.8.8

# Check internet speed
# Install: sudo apt install speedtest-cli
speedtest-cli

# Expected: > 10 Mbps download for EC2 in AWS data center

# ============================================================================
# 5. CHECK DATABASE RESPONSE TIME (if using database)
# ============================================================================

# SQLite is slow for production. Check if in use:
ls -lah /path/to/project/db.sqlite3

# Size check:
du -sh /path/to/project/db.sqlite3

# If > 100 MB, SQLite is degrading. Consider PostgreSQL/MySQL.

# ============================================================================
# 6. CHECK GUNICORN WORKER PROCESSES
# ============================================================================

# View gunicorn processes:
ps aux | grep gunicorn | grep -v grep

# Count workers:
ps aux | grep gunicorn | grep -v grep | wc -l

# Should have 4-8 workers depending on CPU cores.
# Formula: (2 × CPU_cores) + 1

# Check CPU cores:
nproc

# ============================================================================
# 7. CHECK NGINX RESPONSE TIME
# ============================================================================

# View last 20 access logs with response times:
sudo tail -20 /var/log/nginx/trendcrafters_access.log

# Format shows response time in last column (in seconds)
# Example: "GET / HTTP/1.1" 200 3456 0.245

# If response times > 1 second consistently, that's the problem

# Analyze average response time:
sudo tail -100 /var/log/nginx/trendcrafters_access.log | \
    awk '{print $(NF)}' | \
    awk '{sum+=$1; count++} END {print "Average time: " sum/count " seconds"}'

# ============================================================================
# 8. CHECK FOR DATABASE QUERIES (N+1 Problem)
# ============================================================================

# Enable Django query logging temporarily
# Add to trendcrafters/settings.py:

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}

# Then check logs:
sudo journalctl -u gunicorn-trendcrafters -f

# Look for many duplicate SELECT queries (N+1 problem)

# Fix: Use Django ORM select_related() or prefetch_related()
# Example:
# BAD:  posts = Post.objects.all()  # Then accessing post.author in loop
# GOOD: posts = Post.objects.select_related('author')
```

---

## Common Causes & Solutions

### **Cause 1: Gunicorn Only Has 1 Worker (Default)**

```bash
# ============================================================================
# DIAGNOSIS
# ============================================================================

# Count Gunicorn workers:
ps aux | grep gunicorn | grep -v grep | wc -l

# If output is 1 or 2, you only have 1 worker process

# ============================================================================
# SOLUTION: Increase Worker Count
# ============================================================================

# Edit Gunicorn service file:
sudo nano /etc/systemd/system/gunicorn-trendcrafters.service

# Find the ExecStart line, change --workers 1 to:
# Recommended: (2 × CPU_cores) + 1

# Check CPU cores:
nproc

# Example for 2-core CPU:
ExecStart=/path/to/project/.venv/bin/gunicorn \
    -b 127.0.0.1:8000 \
    --workers 5 \
    --worker-class sync \
    --timeout 120 \
    trendcrafters.wsgi:application

# Apply changes:
sudo systemctl daemon-reload
sudo systemctl restart gunicorn-trendcrafters

# Verify workers increased:
ps aux | grep gunicorn | grep -v grep | wc -l

# Should now show 5+ processes
```

---

### **Cause 2: Static Files Not Being Cached (Downloaded Every Time)**

```bash
# ============================================================================
# DIAGNOSIS
# ============================================================================

# Check if browser caches static files:
curl -I https://trendcrafters.global/static/css/style.css | grep -i cache

# If no "Cache-Control" or "max-age" header, files aren't cached

# ============================================================================
# SOLUTION: Enable Browser Caching in Nginx
# ============================================================================

# Edit Nginx config:
sudo nano /etc/nginx/sites-available/trendcrafters

# Update static file location block:

location /static/ {
    alias /path/to/project/staticfiles/;
    
    # Cache for 30 days
    expires 30d;
    add_header Cache-Control "public, immutable";
    
    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/json;
    gzip_min_length 1000;
}

# Reload Nginx:
sudo systemctl reload nginx

# Verify caching headers:
curl -I https://trendcrafters.global/static/css/style.css

# Should show:
# Cache-Control: public, immutable
# Content-Encoding: gzip (if text file)
```

---

### **Cause 3: Cloudflare Caching Not Enabled**

```bash
# ============================================================================
# DIAGNOSIS: Check Cloudflare Cache Status
# ============================================================================

curl -I https://trendcrafters.global | grep CF-Cache-Status

# Expected output:
# CF-Cache-Status: HIT (page was cached)
# CF-Cache-Status: MISS (page was not cached)

# If always MISS, caching is not working

# ============================================================================
# SOLUTION: Enable Cloudflare Caching
# ============================================================================

# This requires Cloudflare Dashboard (not terminal):

# 1. Go to Cloudflare Dashboard → Your Domain
# 2. Go to "Caching" tab
# 3. Set "Default Cache Level" to "Cache Everything"
# 4. Go to "Rules" or "Page Rules"
# 5. Create rule:
#    - URL: https://trendcrafters.global/*
#    - Setting: Cache Level = Cache Everything
#    - Cache TTL = 1 hour (or longer)

# 6. Go to "Browser Cache TTL"
#    Set to 1 hour or longer (default is often 30 minutes)

# 7. Enable "Argo Smart Routing" (if on paid plan)

# Then test:
curl -I https://trendcrafters.global | grep CF-Cache-Status

# Should see HIT status on subsequent requests
```

---

### **Cause 4: Database Queries Are Slow**

```bash
# ============================================================================
# DIAGNOSIS: Check Database File Size & Performance
# ============================================================================

# If using SQLite:
ls -lh /path/to/project/db.sqlite3

# SQLite gets slow with large files (> 100 MB)

# Enable query logging:
cd /path/to/project
source .venv/bin/activate

python manage.py shell

# In Django shell:
from django.db import connection
from django.db import reset_queries
from django.conf import settings

settings.DEBUG = True

# Run a query from your view code
# Then check:
from django.db import connection
for query in connection.queries:
    print(query['time'], query['sql'])

# ============================================================================
# SOLUTION A: Optimize Queries (No Database Migration)
# ============================================================================

# In your views, use select_related() and prefetch_related()

# BAD CODE (causes N+1):
posts = Post.objects.all()
for post in posts:
    print(post.author.name)  # 1 query per post!

# GOOD CODE (optimized):
posts = Post.objects.select_related('author')
for post in posts:
    print(post.author.name)  # Only 2 queries total!

# Update your views in main/views.py:
# Find queries and add .select_related() or .prefetch_related()

# ============================================================================
# SOLUTION B: Migrate to PostgreSQL (Recommended for Production)
# ============================================================================

# For now, if staying on SQLite, optimize it:

# Check database integrity:
cd /path/to/project
source .venv/bin/activate
python manage.py dbshell

# In SQLite shell:
PRAGMA integrity_check;
VACUUM;
ANALYZE;
.quit

# Restart Gunicorn:
sudo systemctl restart gunicorn-trendcrafters
```

---

### **Cause 5: Nginx Buffering Issues**

```bash
# ============================================================================
# SOLUTION: Optimize Nginx Buffer Settings
# ============================================================================

# Edit Nginx config:
sudo nano /etc/nginx/sites-available/trendcrafters

# In the proxy location, add/update:

location / {
    proxy_pass http://127.0.0.1:8000;
    
    # Optimize buffers for large responses
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 24 4k;
    proxy_busy_buffers_size 8k;
    proxy_max_temp_file_size 2048m;
    proxy_temp_file_write_size 32k;
    
    # Connection settings
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # Other proxy headers...
}

# Reload Nginx:
sudo systemctl reload nginx
```

---

### **Cause 6: Gzip Compression Not Enabled**

```bash
# ============================================================================
# DIAGNOSIS: Check if Gzip is Enabled
# ============================================================================

curl -I -H "Accept-Encoding: gzip" https://trendcrafters.global | grep -i encoding

# Should show: Content-Encoding: gzip

# ============================================================================
# SOLUTION: Enable Gzip in Nginx
# ============================================================================

# Edit main Nginx config:
sudo nano /etc/nginx/nginx.conf

# In the http {} section, ensure these settings exist:

http {
    # Enable Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_proxied any;
    
    # Compress these types
    gzip_types 
        text/plain 
        text/css 
        text/xml 
        text/javascript 
        application/x-javascript 
        application/xml+rss 
        application/javascript 
        application/json;
    
    # Compression level (1-9, higher = smaller but slower)
    gzip_comp_level 6;
}

# Test Nginx config:
sudo nginx -t

# Reload:
sudo systemctl reload nginx

# Verify gzip works:
curl -I -H "Accept-Encoding: gzip" https://trendcrafters.global | grep -i encoding
```

---

### **Cause 7: AWS EC2 Instance Too Small**

```bash
# ============================================================================
# DIAGNOSIS: Check Instance Size & Performance
# ============================================================================

# Check instance type:
curl -s http://169.254.169.254/latest/meta-data/instance-type

# Expected for production: t3.medium or larger
# t2.micro / t3.micro = very slow for real traffic

# Check CPU usage:
top -b -n 1 | head -20

# If CPU > 80% constantly, upgrade instance

# Check network throughput:
# AWS EC2 Dashboard → Your Instance → Network tab

# ============================================================================
# SOLUTION: Upgrade Instance Type (AWS Console)
# ============================================================================

# 1. Stop the instance
# 2. Right-click → Instance Settings → Change Instance Type
# 3. Select t3.small or t3.medium
# 4. Click Apply
# 5. Start the instance

# OR use AWS CLI:

aws ec2 stop-instances --instance-ids i-1234567890abcdef0 --region us-east-1
aws ec2 modify-instance-attribute --instance-id i-1234567890abcdef0 --instance-type "{\"Value\": \"t3.medium\"}" --region us-east-1
aws ec2 start-instances --instance-ids i-1234567890abcdef0 --region us-east-1
```

---

### **Cause 8: DNS Resolution Slow (Cloudflare)**

```bash
# ============================================================================
# DIAGNOSIS: Check DNS Resolution Speed
# ============================================================================

time nslookup trendcrafters.global

# Should complete in < 100ms

# Detailed timing:
dig trendcrafters.global

# Look at "Query time" (should be < 50ms)

# ============================================================================
# SOLUTION: Use Faster DNS
# ============================================================================

# Configure EC2 to use Cloudflare's DNS (faster):
sudo nano /etc/resolv.conf

# Add:
nameserver 1.1.1.1
nameserver 1.0.0.1

# Make permanent:
sudo nano /etc/netplan/00-installer-config.yaml

# Update with:
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - YOUR_IP/24
      gateway4: YOUR_GATEWAY
      nameservers:
        addresses: [1.1.1.1, 1.0.0.1]

# Apply changes:
sudo netplan apply

# Test:
dig trendcrafters.global | grep "Query time"
```

---

## Performance Audit Checklist

Run these commands to get a complete performance report:

```bash
# ============================================================================
# COMPLETE PERFORMANCE AUDIT
# ============================================================================

echo "=== SYSTEM RESOURCES ==="
echo "CPU Cores: $(nproc)"
echo "Memory:"
free -h
echo ""
echo "Disk Space:"
df -h /
echo ""

echo "=== GUNICORN ==="
echo "Worker Count: $(ps aux | grep gunicorn | grep -v grep | wc -l)"
ps aux | grep gunicorn | grep -v grep | head -3
echo ""

echo "=== NGINX ==="
sudo systemctl status nginx | grep Active
sudo lsof -i :443 | head -3
echo ""

echo "=== DATABASE ==="
echo "SQLite Size (if used):"
ls -lh /path/to/project/db.sqlite3 2>/dev/null || echo "Not found (maybe using PostgreSQL)"
echo ""

echo "=== RESPONSE TIME FROM INTERNET ==="
curl -w "Time to first byte: %{time_starttransfer}s\nTotal time: %{time_total}s\n" \
    -o /dev/null -s https://trendcrafters.global
echo ""

echo "=== CLOUDFLARE CACHE STATUS ==="
curl -I https://trendcrafters.global | grep -E "CF-Cache-Status|Cache-Control"
echo ""

echo "=== STATIC FILES CACHING ==="
curl -I https://trendcrafters.global/static/css/style.css 2>/dev/null | grep -i "cache\|gzip" || echo "Static files not cached"
echo ""

echo "=== NGINX ERROR LOG (Last 10 lines) ==="
sudo tail -10 /var/log/nginx/trendcrafters_error.log
echo ""

echo "=== GUNICORN LOGS ==="
sudo journalctl -u gunicorn-trendcrafters -n 5 --no-pager
```

---

## Performance Optimization Priority Order

**Priority 1 (Do These First):**
1. Increase Gunicorn workers to `(2 × CPU_cores) + 1`
2. Enable browser caching for static files (30 days)
3. Enable Gzip compression in Nginx

**Priority 2 (If still slow):**
4. Enable Cloudflare caching (set "Cache Everything")
5. Optimize database queries (select_related, prefetch_related)
6. Migrate from SQLite to PostgreSQL

**Priority 3 (If still slow or for scale):**
7. Upgrade EC2 instance size (t3.medium or larger)
8. Enable Nginx response caching
9. Add Redis for session/cache layer

**Priority 4 (Advanced):**
10. Use CDN for static files (CloudFront)
11. Add application monitoring (New Relic, DataDog)
12. Profile and optimize Python code

---

## Testing & Verification

```bash
# ============================================================================
# PERFORMANCE TESTING TOOLS
# ============================================================================

# Test 1: Simple page load test
curl -w "Response time: %{time_total}s\n" -o /dev/null -s https://trendcrafters.global

# Test 2: Concurrent connections (stress test)
# Install: sudo apt install apache2-utils
ab -n 100 -c 10 https://trendcrafters.global/

# Test 3: Detailed performance metrics
# Install: sudo apt install curl
curl -vvv https://trendcrafters.global 2>&1 | grep -E "time_|Connect time"

# Test 4: Google PageSpeed Insights (from browser)
# Visit: https://pagespeed.web.dev/
# Enter: https://trendcrafters.global

# Test 5: GTmetrix (from browser)
# Visit: https://gtmetrix.com/
# Enter: https://trendcrafters.global
```

---

## Getting More Details

If none of these fixes work, run this diagnostic script:

```bash
# Create diagnostic script
cat > /tmp/diagnose.sh << 'EOF'
#!/bin/bash

echo "╔════════════════════════════════════════════════════════╗"
echo "║     TRENDCRAFTERS WEBSITE PERFORMANCE DIAGNOSTIC       ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# System
echo "📊 SYSTEM INFO"
echo "Uptime: $(uptime -p)"
echo "Load: $(cat /proc/loadavg | awk '{print $1, $2, $3}')"
echo "CPU Cores: $(nproc)"
echo "Memory Available: $(free -h | awk '/^Mem/ {print $7}')"
echo "Disk Used: $(df -h / | awk 'NR==2 {print $5}')"
echo ""

# Services
echo "🔧 SERVICE STATUS"
echo "Nginx: $(systemctl is-active nginx)"
echo "Gunicorn: $(systemctl is-active gunicorn-trendcrafters)"
echo ""

# Performance
echo "⚡ PERFORMANCE"
echo "Gunicorn Workers: $(ps aux | grep gunicorn | grep -v grep | wc -l)"
echo "Nginx Workers: $(ps aux | grep nginx | grep -v grep | wc -l)"
echo ""

# Recent errors
echo "❌ RECENT ERRORS (Nginx)"
sudo tail -5 /var/log/nginx/trendcrafters_error.log 2>/dev/null || echo "No errors"
echo ""

echo "✅ All diagnostics complete!"
EOF

chmod +x /tmp/diagnose.sh
/tmp/diagnose.sh
```

Run this if you need more specific help!

