# VPS Production EakMail

Host: `eak.salonilona.eu` / IP: `101.99.74.214`  
User: `root`  
Port SSH: `20203` (atau 22 via domain)  
SSH Key: `~/.ssh/id_rsa_eakmail`  
Path project: `/www/wwwroot/eak.salonilona.eu`  
PM2 app: `eakmail-backend`  

## Connect SSH

```bash
ssh -i ~/.ssh/id_rsa_eakmail -p 20203 root@101.99.74.214
```

## Paths penting

```
Node.js / npm   : /www/server/nodejs/v20.18.3/bin
psql            : /www/server/pgsql/bin/psql
project root    : /www/wwwroot/eak.salonilona.eu
backend         : /www/wwwroot/eak.salonilona.eu/EakMail-backend
frontend dist   : /www/wwwroot/eak.salonilona.eu/EakMail-frontend/dist
.env            : /www/wwwroot/eak.salonilona.eu/EakMail-backend/.env
```

## Deploy update (urutan wajib)

```bash
export PATH="/www/server/nodejs/v20.18.3/bin:$PATH"
NODE=/www/server/nodejs/v20.18.3/bin/node
BACKEND=/www/wwwroot/eak.salonilona.eu/EakMail-backend

cd /www/wwwroot/eak.salonilona.eu
git pull origin main

cd $BACKEND

# Jika ada schema change (prisma/schema.prisma berubah):
$NODE node_modules/.bin/prisma db push --accept-data-loss

# Jika ada perubahan shared-types/src/dto.ts:
# Edit langsung dist/dto.d.ts via Python (npm run build tidak bisa spawn sh):
python3 -c "
f = '/www/wwwroot/eak.salonilona.eu/packages/shared-types/dist/dto.d.ts'
content = open(f).read()
# ... tambah field di sini ...
open(f, 'w').write(content)
"

# Build backend (npm run tidak bisa spawn sh — pakai node tsc langsung)
$NODE node_modules/typescript/bin/tsc -p tsconfig.json

# Restart
pm2 restart eakmail-backend
```

## Perintah umum

```bash
export PATH="/www/server/nodejs/v20.18.3/bin:$PATH"

# Lihat log live
pm2 logs eakmail-backend --lines 30

# Lihat log dari file (lebih reliable)
tail -50 /root/.pm2/logs/eakmail-backend-out.log
tail -50 /root/.pm2/logs/eakmail-backend-error.log

# Status proses
pm2 list

# Build frontend
cd /www/wwwroot/eak.salonilona.eu/EakMail-frontend
npm run build
```

## Catatan penting

- **Jangan** `prisma migrate deploy` — shadow DB tidak tersedia, pakai `prisma db push` saja
- Schema change butuh `prisma generate` + `npm run build` setelah `db push`
- `pm2` hanya tersedia setelah export PATH di atas
