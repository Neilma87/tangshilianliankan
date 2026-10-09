$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8765/')
$listener.Start()
Write-Host 'Serving on http://localhost:8765/'
$root = 'c:\Users\alice\Documents\trae_projects\xiaoxiaole\web-game'
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
}
while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
  $path = Join-Path $root ($rel -replace '/', '\')
  if ((-not (Test-Path $path)) -or (Test-Path $path -PathType Container)) {
    $ctx.Response.StatusCode = 404
    $b = [Text.Encoding]::UTF8.GetBytes('not found')
    $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    $ctx.Response.Close()
    continue
  }
  $ext = [IO.Path]::GetExtension($path)
  if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] } else { $ctx.Response.ContentType = 'application/octet-stream' }
  $ctx.Response.Headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
  $bytes = [IO.File]::ReadAllBytes($path)
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.Close()
}
