param(
  [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host "==> AgroMarket local startup" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
  if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example" -ForegroundColor Yellow
  } else {
    throw ".env or .env.example not found in repo root."
  }
}

if (-not $SkipDocker) {
  Write-Host "==> Starting infrastructure containers..." -ForegroundColor Cyan
  docker compose up -d postgres redis mongodb elasticsearch rabbitmq zookeeper kafka ai-python
}

Write-Host "==> Running user-service SQL migrations..." -ForegroundColor Cyan
pnpm db:user:migrate

Write-Host "==> Trying listing-service migration (non-blocking if baseline db)..." -ForegroundColor Cyan
try {
  $env:LISTING_DATABASE_URL = "postgresql://agromarket:agromarket@localhost:5432/agromarket"
  pnpm --filter @agromarket/listing-service db:migrate
} catch {
  Write-Host "listing-service migrate skipped: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "==> Launching backend services in new terminal..." -ForegroundColor Cyan
$backendCmd = @"
cd /d "$root"
pnpm turbo run dev --concurrency 20 --filter=@agromarket/api-gateway --filter=@agromarket/user-service --filter=@agromarket/listing-service --filter=@agromarket/offer-service --filter=@agromarket/messaging-service --filter=@agromarket/notification-service --filter=@agromarket/search-service --filter=@agromarket/payment-service --filter=@agromarket/admin-service --filter=@agromarket/ai-service
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd | Out-Null

Write-Host "==> Launching mobile Expo server in new terminal..." -ForegroundColor Cyan
$mobileCmd = @"
cd /d "$root"
pnpm dev:mobile
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $mobileCmd | Out-Null

Write-Host ""
Write-Host "Local startup triggered." -ForegroundColor Green
Write-Host "- Expo: http://localhost:8081"
Write-Host "- API Gateway health: http://localhost:3000/health"
Write-Host ""
Write-Host "Tip: scripts\start-local.ps1 -SkipDocker  (if containers already running)"
