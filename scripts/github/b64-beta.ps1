gh secret delete ENV_FILE_BASE64 --env beta --repo vxture/vxture-Arda 2>$null
$c = Get-Content -Raw "d:\MyWebSite\vxturestudio\vxture-Arda\deploy\beta.env"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($c))
$b64 | gh secret set ENV_FILE_BASE64 --env beta --repo vxture/vxture-Arda
Write-Host "ENV_FILE_BASE64 set for beta"
