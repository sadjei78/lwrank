# Load environment variables from .env file
# Usage: .\load-env.ps1

if (Test-Path ".env") {
    Get-Content .env | ForEach-Object { 
        if($_ -match "^([^#][^=]+)=(.*)$") { 
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process") 
            Write-Host "Loaded: $($matches[1])"
        } 
    }
    Write-Host "Environment variables loaded successfully!" -ForegroundColor Green
} else {
    Write-Host "Error: .env file not found!" -ForegroundColor Red
}
