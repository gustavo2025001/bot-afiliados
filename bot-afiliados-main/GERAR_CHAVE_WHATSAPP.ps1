# Gera uma chave AES-256 aleatória para criptografar os tokens do WhatsApp no Supabase.
# Execute no PowerShell do SEU computador. Não envie a chave para ninguém.
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$key = -join ($bytes | ForEach-Object { $_.ToString('x2') })
Write-Host "WHATSAPP_TOKEN_ENCRYPTION_KEY=$key"
Write-Host "\nCopie o valor e salve em Supabase > Edge Functions > Secrets. Não coloque no GitHub."
