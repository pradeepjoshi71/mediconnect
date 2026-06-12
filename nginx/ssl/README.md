# SSL Certificate Setup — MediConnect Nginx

Place your SSL certificates in this directory before running `docker-compose up`.

## Required Files

| File             | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `fullchain.pem`  | Full certificate chain (server cert + intermediates)     |
| `privkey.pem`    | Private key (keep secret — never commit to git)          |

---

## Option A — Let's Encrypt (Recommended for Public Domains)

```bash
# 1. Install certbot on the host
sudo apt install certbot

# 2. Obtain certificate (before starting nginx)
sudo certbot certonly --standalone \
  --email admin@yourdomain.com \
  --agree-tos \
  -d yourdomain.com \
  -d www.yourdomain.com

# 3. Copy certs to this directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./nginx/ssl/fullchain.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem   ./nginx/ssl/privkey.pem

# 4. Set up auto-renewal cron
echo "0 3 * * * root certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /path/to/mediconnect/nginx/ssl/fullchain.pem && docker exec mediconnect-nginx nginx -s reload" | sudo tee /etc/cron.d/certbot-renew
```

---

## Option B — Self-Signed (Internal / Hospital Intranet)

```bash
# Generate a self-signed certificate (valid for 10 years)
openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
  -keyout ./nginx/ssl/privkey.pem \
  -out    ./nginx/ssl/fullchain.pem \
  -subj   "/C=IN/ST=Karnataka/L=Bangalore/O=Hospital/OU=IT/CN=mediconnect.local"
```

> **Note:** Browsers will show a security warning for self-signed certs.
> Add the cert to your hospital's trusted root CA store to suppress the warning.

---

## Option C — Cloud Load Balancer (SSL Termination Upstream)

If your deployment uses AWS ALB, GCP Load Balancer, or Cloudflare:

1. SSL is terminated at the load balancer — nginx only handles HTTP internally.
2. **Comment out the HTTPS server block** in `nginx/nginx.conf`.
3. **Comment out the HTTP→HTTPS redirect block** too.
4. The 80-port HTTP-only server block handles all traffic.
5. Remove the SSL volume mount from `docker-compose.yml` nginx service.

---

## Security Notes

```text
nginx/ssl/
  ├── fullchain.pem   ← safe to back up, not secret
  └── privkey.pem     ← SECRET — add to .gitignore, restrict permissions
```

```bash
# Restrict private key permissions
chmod 600 ./nginx/ssl/privkey.pem
chmod 644 ./nginx/ssl/fullchain.pem
```

The `nginx/ssl/` directory is already in `.gitignore` — **never commit private keys to git**.
