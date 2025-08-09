# Supabase CLI helper script
# Usage: .\supabase-cli.ps1 [command] [args...]
# Example: .\supabase-cli.ps1 db push

# Load environment variables
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object { 
        if($_ -match "^([^#][^=]+)=(.*)$") { 
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process") 
        } 
    }
}

# Get the command and arguments
$command = $args[0]
$arguments = $args[1..$args.Length]

# Run supabase command with password
if ($command -eq "db" -and $arguments[0] -eq "push") {
    supabase db push --password $env:SUPABASE_DB_PASSWORD @arguments
} elseif ($command -eq "migration" -and $arguments[0] -eq "list") {
    supabase migration list --password $env:SUPABASE_DB_PASSWORD @arguments
} else {
    # For other commands, just pass through
    supabase @args
}
