@echo off
cd /d "%~dp0"

REM PM2: WhatsApp (3010) + server-api (3001) + ngrok (túnel 3001)
pm2 start ecosystem.config.cjs
