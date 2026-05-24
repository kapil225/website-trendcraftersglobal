# 🚀 SSL/HTTPS Setup - Quick Reference Card

**Print this out or bookmark it!**

---

## 5-Step Deployment

```bash
# Step 1: Install Certbot (2 min)
sudo apt update && sudo apt install -y certbot python3-certbot-nginx

# Step 2: Stop Nginx temporarily (1 min)
sudo systemctl stop nginx

# Step 3: Get SSL Certificate (3 min)
sudo certbot certonly --standalone \
    -d trendcrafters.global -d www.trendcrafters.global \
    --agree-tos -m your-email@example.com --non-interactive

# Step 4: Configure Nginx (5 min)
# 4a. Backup old config
sudo cp /etc/nginx/sites-available/trendcrafters /etc/nginx/sites-available/trendcrafters.backup

# 4b. Edit Nginx config (see NGINX_SSL_CONFIG.md for full config)
sudo nano /etc/nginx/sites-available/trendcrafters

# 4c. Test config
sudo nginx -t

# Step 5: Start and Verify (2 min)
sudo systemctl start nginx
curl -I https://trendcrafters.global
```

---

## 🎯 Verification Commands

Run after each step to verify:

```bash
# After Step 3: Certificate exists?
sudo ls -la /etc/letsencrypt/live/trendcrafters.global/

# After Step 4: Nginx config valid?
sudo nginx -t

# After Step 5: HTTPS working?
curl -I https://trendcrafters.global
# Expected: HTTP/2 200

# After Step 5: HTTP redirects to HTTPS?
curl -I -L http://trendcrafters.global
# Expected: HTTP/1.1 301 then HTTP/2 200

# Auto-renewal enabled?
sudo systemctl status certbot.timer
# Expected: active (waiting)
```

---

## 🔑 SSL Certificate Paths

Save these for reference:

```
Certificate:  /etc/letsencrypt/live/trendcrafters.global/fullchain.pem
Private Key:  /etc/letsencrypt/live/trendcrafters.global/privkey.pem
Config Dir:   /etc/letsencrypt/
Backup:       /etc/letsencrypt/archive/
```

For Nginx config:
```nginx
ssl_certificate /etc/letsencrypt/live/trendcrafters.global/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/trendcrafters.global/privkey.pem;
```

---

## 📋 Essential Commands Cheatsheet

### Service Management
```bash
# Restart Nginx
sudo systemctl restart nginx

# Reload Nginx (no disconnect)
sudo systemctl reload nginx

# Restart Gunicorn
sudo systemctl restart gunicorn-trendcrafters

# Check service status
sudo systemctl status nginx
sudo systemctl status gunicorn-trendcrafters
sudo systemctl status certbot.timer
```

### SSL Management
```bash
# View all certificates
sudo certbot certificates

# Check certificate expiry
sudo openssl x509 -in /etc/letsencrypt/live/trendcrafters.global/fullchain.pem -noout -dates

# Test renewal (dry run)
sudo certbot renew --dry-run

# Manual renewal
sudo certbot renew

# Get detailed certificate info
sudo openssl x509 -in /etc/letsencrypt/live/trendcrafters.global/fullchain.pem -text -noout
```

### Testing
```bash
# Test HTTPS
curl -I https://trendcrafters.global

# Follow redirects
curl -I -L http://trendcrafters.global

# Test response time
curl -w "Time: %{time_total}s\n" -o /dev/null -s https://trendcrafters.global

# Test certificate
curl -vI https://trendcrafters.global 2>&1 | grep -E "subject|issuer|not"

# Stress test (100 requests, 10 concurrent)
ab -n 100 -c 10 https://trendcrafters.global/
```

### Logs
```bash
# Nginx error log
sudo tail -50 /var/log/nginx/trendcrafters_error.log

# Nginx access log
sudo tail -50 /var/log/nginx/trendcrafters_access.log

# Gunicorn logs
sudo journalctl -u gunicorn-trendcrafters -n 50 --no-pager

# Certbot logs
sudo journalctl -u certbot -n 50 --no-pager

# Real-time monitoring
sudo tail -f /var/log/nginx/trendcrafters_error.log
```

---

## ⚠️ Emergency Commands

### If website is down:

```bash
# 1. Check services
sudo systemctl status nginx
sudo systemctl status gunicorn-trendcrafters

# 2. Restart services
sudo systemctl restart nginx
sudo systemctl restart gunicorn-trendcrafters

# 3. Check error logs
sudo tail -100 /var/log/nginx/trendcrafters_error.log

# 4. Verify port 443 is open
sudo lsof -i :443

# 5. Verify port 8000 is open
sudo lsof -i :8000

# 6. If Nginx config is broken, restore backup
sudo cp /etc/nginx/sites-available/trendcrafters.backup /etc/nginx/sites-available/trendcrafters
sudo nginx -t
sudo systemctl reload nginx
```

### Rollback to HTTP-only:

```bash
# Edit Nginx config
sudo nano /etc/nginx/sites-available/trendcrafters

# Replace entire content with:
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

# Reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔐 Security Checklist

- [ ] Certificate obtained from Let's Encrypt
- [ ] Certificate renews automatically (Certbot timer enabled)
- [ ] HTTPS works on port 443
- [ ] HTTP redirects to HTTPS (port 80 → 443)
- [ ] No mixed content warnings (F12 → Console)
- [ ] Static files load correctly
- [ ] Cloudflare SSL mode set to "Full (strict)"
- [ ] HSTS header enabled (1 year duration)
- [ ] XSS protection header enabled
- [ ] CSRF cookies secure

---

## 📊 Performance Checklist

- [ ] Gunicorn has 5+ worker processes
- [ ] Static files have 30-day cache header
- [ ] Gzip compression enabled
- [ ] Cloudflare cache enabled ("Cache Everything")
- [ ] Database queries optimized (select_related/prefetch_related)
- [ ] Response time < 2 seconds

---

## 📞 Support Resources

| Issue | Resource |
|-------|----------|
| SSL/HTTPS setup | `SSL_DEPLOYMENT_COMMANDS.md` |
| Nginx config | `NGINX_SSL_CONFIG.md` |
| Performance slow | `PERFORMANCE_TROUBLESHOOTING.md` |
| Complete guide | `README_SSL_SETUP.md` |
| Navigation | `INDEX.md` |

---

## 🔄 Maintenance Schedule

### Daily
- Monitor error logs for issues
- Check if website loads (curl or browser)

### Weekly
- Verify Certbot timer is active
- Check disk space usage

### Monthly
- Test certificate renewal: `sudo certbot renew --dry-run`
- Review Nginx logs for errors
- Update apt packages: `sudo apt update && sudo apt upgrade`

### Quarterly
- Review SSL configuration
- Check for security updates
- Verify backups exist

### Annually
- Review and update security headers
- Update dependencies in requirements.txt
- Plan for instance upgrades if needed

---

## 💾 Backup Commands

```bash
# Backup certificates
sudo tar -czf ~/certs-backup-$(date +%Y%m%d).tar.gz /etc/letsencrypt/

# Backup Nginx config
sudo cp /etc/nginx/sites-available/trendcrafters ~/nginx-config-backup-$(date +%Y%m%d).conf

# Backup Django settings
cp trendcrafters/settings.py ~/django-settings-backup-$(date +%Y%m%d).py

# Backup database
cp db.sqlite3 ~/db-backup-$(date +%Y%m%d).sqlite3

# Restore certificates
sudo tar -xzf ~/certs-backup-YYYYMMDD.tar.gz -C /
```

---

## 🎓 Key Concepts

| Term | Meaning |
|------|---------|
| **SSL/TLS** | Encryption protocol for secure connections |
| **Certificate** | Digital proof your domain is yours |
| **Let's Encrypt** | Free certificate authority |
| **Certbot** | Tool to automate certificate management |
| **HTTPS** | HTTP over SSL/TLS (secure) |
| **HTTP/2** | Faster protocol for encrypted connections |
| **HSTS** | Header forcing HTTPS for future visits |
| **Mixed Content** | Page with both HTTP and HTTPS resources |
| **Redirect Loop** | Server keeps redirecting to itself (bad) |
| **Port 443** | Standard port for HTTPS |
| **Port 80** | Standard port for HTTP |

---

## 🆘 If Still Stuck

1. **Check logs first:**
   ```bash
   sudo tail -50 /var/log/nginx/trendcrafters_error.log
   ```

2. **Run diagnostics:**
   ```bash
   # From PERFORMANCE_TROUBLESHOOTING.md
   /tmp/diagnose.sh
   ```

3. **Google the error message**
   - Copy exact error from logs
   - Search: `nginx error_message_here`

4. **Check documentation:**
   - `README_SSL_SETUP.md` - Detailed troubleshooting section
   - `PERFORMANCE_TROUBLESHOOTING.md` - Performance issues

---

## ✅ Success Indicators

✅ Website loads on HTTPS  
✅ No certificate errors  
✅ HTTP redirects to HTTPS  
✅ No mixed content warnings  
✅ Static files load quickly  
✅ Auto-renewal is enabled  
✅ Certificate valid for ~90 days  
✅ All services running  

**You're done!** 🎉

---

**Last Updated:** May 24, 2026  
**Status:** Production Ready ✅
