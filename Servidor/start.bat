@echo off
cd /d "%~dp0"
pm2 start ecosystem.config.cjs
pause
