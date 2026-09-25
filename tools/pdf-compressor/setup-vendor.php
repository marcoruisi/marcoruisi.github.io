<?php
declare(strict_types=1);
header('Content-Type: text/html; charset=utf-8');

$vendorDir = __DIR__ . '/vendor';

$files = [
    'jspdf.umd.min.js' => [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
        'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js',
    ],
    'pdf.min.mjs' => [
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs',
        'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.min.mjs',
    ],
    'pdf.worker.min.mjs' => [
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs',
        'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs',
    ],
];

if (!is_dir($vendorDir) && !mkdir($vendorDir, 0755, true) && !is_dir($vendorDir)) {
    exit('Could not create vendor directory.');
}

function download_url(string $url): string|false {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_USERAGENT => 'MRC Tools Vendor Installer/1.0',
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (is_string($body) && $code >= 200 && $code < 300 && strlen($body) > 10000) {
            return $body;
        }
    }

    if (ini_get('allow_url_fopen')) {
        $context = stream_context_create([
            'http' => [
                'timeout' => 60,
                'follow_location' => 1,
                'user_agent' => 'MRC Tools Vendor Installer/1.0',
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ],
        ]);
        $body = @file_get_contents($url, false, $context);
        if (is_string($body) && strlen($body) > 10000) {
            return $body;
        }
    }

    return false;
}

$results = [];
$allOk = true;

foreach ($files as $filename => $urls) {
    $destination = $vendorDir . '/' . $filename;

    if (is_file($destination) && filesize($destination) > 10000) {
        $results[$filename] = 'Already installed';
        continue;
    }

    $downloaded = false;

    foreach ($urls as $url) {
        $body = download_url($url);
        if ($body !== false && file_put_contents($destination, $body) !== false) {
            $downloaded = true;
            break;
        }
    }

    if ($downloaded) {
        $results[$filename] = 'Installed';
    } else {
        $results[$filename] = 'FAILED';
        $allOk = false;
    }
}
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MRC PDF Compressor Setup</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.5}
.ok{color:#198754}.bad{color:#b42318}code{background:#f2f2f2;padding:2px 5px;border-radius:4px}
</style>
</head>
<body>
<h1>PDF Compressor setup</h1>
<?php foreach ($results as $file => $result): ?>
<p><strong><?= htmlspecialchars($file) ?></strong>: <span class="<?= $result === 'FAILED' ? 'bad' : 'ok' ?>"><?= htmlspecialchars($result) ?></span></p>
<?php endforeach; ?>

<?php if ($allOk): ?>
<p class="ok"><strong>Setup complete.</strong> The PDF Compressor now uses local libraries.</p>
<p><a href="./index.html">Open PDF Compressor</a></p>
<p>You can now delete <code>setup-vendor.php</code>.</p>
<?php else: ?>
<p class="bad"><strong>Setup incomplete.</strong> The server could not download one or more vendor files. Check outbound HTTPS access and try again.</p>
<?php endif; ?>
</body>
</html>
