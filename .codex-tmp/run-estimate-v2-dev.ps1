$ErrorActionPreference = 'Stop'

Set-Location 'C:\Users\ehrha\Documents\ace-crm-working'

$envLines = Get-Content '.env.local'

function Get-EnvValue([string]$name) {
  $line = $envLines | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if (-not $line) {
    throw "Missing $name in .env.local"
  }
  return $line.Split('=', 2)[1]
}

$env:NEXT_PUBLIC_SUPABASE_URL = Get-EnvValue 'NEXT_PUBLIC_SUPABASE_URL'
$env:SUPABASE_SERVICE_ROLE_KEY = Get-EnvValue 'SUPABASE_SERVICE_ROLE_KEY'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = Get-EnvValue 'NEXT_PUBLIC_SUPABASE_ANON_KEY'

npm.cmd run dev *>&1 | Tee-Object -FilePath '.codex-tmp\estimate-v2-roomtype-dev.log'
