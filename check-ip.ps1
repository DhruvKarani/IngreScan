#!/usr/bin/env pwsh
# Quick script to check your current LAN IP address
# Run this before starting your app if you've changed networks

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  YOUR CURRENT LAN IP ADDRESS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ip = Get-NetIPAddress -AddressFamily IPv4 | 
    Where-Object { $_.InterfaceAlias -notlike '*Loopback*' -and ($_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*') } | 
    Select-Object -First 1

if ($ip) {
    Write-Host "Current IP: " -NoNewline
    Write-Host $ip.IPAddress -ForegroundColor Green
    Write-Host "Interface:  $($ip.InterfaceAlias)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "[OK] Update this IP in:" -ForegroundColor Yellow
    Write-Host "   src/constants/config.js (line 15 - SERVER_LAN_IP)" -ForegroundColor White
    Write-Host ""
    Write-Host "[!] Then restart your Expo app" -ForegroundColor Yellow
} else {
    Write-Host "[ERROR] No LAN IP found. Are you connected to WiFi/Ethernet?" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
