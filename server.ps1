$server = New-Object System.Net.HttpListener
$server.Prefixes.Add('http://localhost:8080/')
$server.Start()
Write-Host "Server started on http://localhost:8080"
while ($server.IsListening) {
    $context = $server.GetContext()
    $request = $context.Request
    $response = $context.Response
    
    $localPath = $request.RawUrl
    if ($localPath -eq '/') { $localPath = '/index.html' }
    
    $filePath = Join-Path (Get-Location) $localPath
    
    if (Test-Path $filePath) {
        $content = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentLength64 = $content.Length
        
        if ($filePath -like '*.html') { $response.ContentType = 'text/html' }
        elseif ($filePath -like '*.js') { $response.ContentType = 'application/javascript' }
        elseif ($filePath -like '*.css') { $response.ContentType = 'text/css' }
        elseif ($filePath -like '*.json') { $response.ContentType = 'application/json' }
        
        $response.OutputStream.Write($content, 0, $content.Length)
    } else {
        $response.StatusCode = 404
    }
    $response.OutputStream.Close()
}
