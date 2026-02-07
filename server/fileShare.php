<?php
/**
 * FileShareV1 backend endpoint
 * - Accepts file/folder uploads (folders pre-zipped on the client)
 * - Stores uploads on disk for 48 hours
 * - Serves downloads by unique ID
 */

declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Access-Control-Expose-Headers: X-Fileshare-Filename');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$uploadDir = __DIR__ . '/uploads';
$metaDir = $uploadDir . '/meta';
$expirationHours = 48;
$maxSize = 1024 * 1024 * 1024; // 1GB safety cap

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}
if (!is_dir($metaDir)) {
    mkdir($metaDir, 0755, true);
}

function jsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($payload);
    exit;
}

function isZipFile(?string $path): bool
{
    if (!$path) {
        return false;
    }

    $extension = strtolower((string) pathinfo($path, PATHINFO_EXTENSION));
    return $extension === 'zip';
}

function buildZipPreview(string $filePath, int $limit = 200): array
{
    $details = [
        'zipContents' => [],
        'zipTruncated' => false,
    ];

    if (!file_exists($filePath) || !extension_loaded('zip') || !class_exists('ZipArchive')) {
        return $details;
    }

    $zip = new ZipArchive();
    $flags = defined('ZipArchive::RDONLY') ? ZipArchive::RDONLY : 0;
    if ($zip->open($filePath, $flags) !== true) {
        return $details;
    }

    $entries = [];
    $total = (int) $zip->numFiles;
    for ($i = 0; $i < $total; $i++) {
        $name = $zip->getNameIndex($i);
        if ($name === false || substr($name, -1) === '/') {
            continue; // skip directory placeholders
        }

        $stat = $zip->statIndex($i);
        $entries[] = [
            'name' => $name,
            'size' => isset($stat['size']) ? (int) $stat['size'] : 0,
        ];

        if (count($entries) >= $limit) {
            for ($j = $i + 1; $j < $total; $j++) {
                $nextName = $zip->getNameIndex($j);
                if ($nextName !== false && substr($nextName, -1) !== '/') {
                    $details['zipTruncated'] = true;
                    break;
                }
            }
            break;
        }
    }

    $zip->close();
    $details['zipContents'] = $entries;
    return $details;
}

function baseUrl(): string
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $script = $_SERVER['SCRIPT_NAME'] ?? '/fileShare.php';
    return sprintf('%s://%s%s', $scheme, $host, $script);
}

function cleanupExpired(string $metaDir, int $expirationHours): void
{
    $metaFiles = glob(rtrim($metaDir, '/') . '/*.json');
    if (!$metaFiles) {
        return;
    }

    $now = new DateTimeImmutable();
    foreach ($metaFiles as $metaPath) {
        $data = json_decode((string) file_get_contents($metaPath), true);
        if (!$data || empty($data['expiresAt'])) {
            continue;
        }

        $expires = new DateTimeImmutable($data['expiresAt']);
        if ($expires < $now) {
            if (!empty($data['path']) && file_exists($data['path'])) {
                @unlink($data['path']);
            }
            @unlink($metaPath);
        }
    }
}

cleanupExpired($metaDir, $expirationHours);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (($_POST['action'] ?? '') !== 'upload') {
        jsonResponse(['success' => false, 'error' => 'Invalid action'], 400);
    }

    if (!isset($_FILES['file'])) {
        jsonResponse(['success' => false, 'error' => 'Missing file payload'], 400);
    }

    $upload = $_FILES['file'];
    if ($upload['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(['success' => false, 'error' => 'Upload failed (error code ' . $upload['error'] . ')'], 400);
    }

    if ($upload['size'] > $maxSize) {
        jsonResponse(['success' => false, 'error' => 'File exceeds maximum allowed size'], 413);
    }

    $originalName = $upload['name'] ?: 'fileshare.bin';
    $safeName = preg_replace('/[^A-Za-z0-9_.-]/', '_', $originalName);
    $id = bin2hex(random_bytes(6));
    $storedName = $id . '__' . ($safeName ?: 'fileshare.bin');
    $targetPath = rtrim($uploadDir, '/') . '/' . $storedName;

    if (!move_uploaded_file($upload['tmp_name'], $targetPath)) {
        jsonResponse(['success' => false, 'error' => 'Unable to save uploaded file'], 500);
    }

    $expiresAt = (new DateTimeImmutable('+' . $expirationHours . ' hours'))->format(DateTimeInterface::ATOM);
    $meta = [
        'id' => $id,
        'filename' => $originalName,
        'storedName' => $storedName,
        'path' => $targetPath,
        'size' => filesize($targetPath),
        'expiresAt' => $expiresAt,
        'uploadedAt' => (new DateTimeImmutable())->format(DateTimeInterface::ATOM)
    ];

    file_put_contents(rtrim($metaDir, '/') . '/' . $id . '.json', json_encode($meta, JSON_PRETTY_PRINT));

    jsonResponse([
        'success' => true,
        'data' => [
            'id' => $id,
            'filename' => $originalName,
            'downloadUrl' => baseUrl() . '?id=' . $id,
            'expiresAt' => $expiresAt,
            'size' => $meta['size'],
        ],
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['id'])) {
    $isInfoRequest = isset($_GET['info']);
    $id = preg_replace('/[^a-zA-Z0-9]/', '', (string) $_GET['id']);
    if (!$id) {
        if ($isInfoRequest) {
            jsonResponse(['success' => false, 'error' => 'Invalid file id'], 400);
        }
        http_response_code(400);
        echo 'Invalid download id';
        exit;
    }

    $metaPath = rtrim($metaDir, '/') . '/' . $id . '.json';
    if (!file_exists($metaPath)) {
        if ($isInfoRequest) {
            jsonResponse(['success' => false, 'error' => 'File not found'], 404);
        }
        http_response_code(404);
        echo 'File not found';
        exit;
    }

    $meta = json_decode((string) file_get_contents($metaPath), true);
    if (!$meta || empty($meta['path']) || !file_exists($meta['path'])) {
        @unlink($metaPath);
        if ($isInfoRequest) {
            jsonResponse(['success' => false, 'error' => 'File not found'], 404);
        }
        http_response_code(404);
        echo 'File not found';
        exit;
    }

    $expires = new DateTimeImmutable($meta['expiresAt']);
    if ($expires < new DateTimeImmutable()) {
        @unlink($meta['path']);
        @unlink($metaPath);
        if ($isInfoRequest) {
            jsonResponse(['success' => false, 'error' => 'Link expired'], 410);
        }
        http_response_code(410);
        echo 'Link expired';
        exit;
    }

    if ($isInfoRequest) {
        $info = [
            'id' => $meta['id'] ?? $id,
            'filename' => $meta['filename'] ?? 'file',
            'size' => $meta['size'] ?? (file_exists($meta['path']) ? filesize($meta['path']) : 0),
            'expiresAt' => $meta['expiresAt'],
            'uploadedAt' => $meta['uploadedAt'] ?? '',
            'isZip' => false,
        ];

        $isZip = isZipFile($meta['path'] ?? '') || isZipFile($meta['storedName'] ?? '');
        $info['isZip'] = $isZip;

        if ($isZip) {
            $zipPreview = buildZipPreview($meta['path']);
            $info = array_merge($info, $zipPreview);
        }

        jsonResponse(['success' => true, 'data' => $info]);
    }

    header('Content-Type: application/octet-stream');
    header('Content-Length: ' . $meta['size']);
    header('Content-Disposition: attachment; filename="' . $meta['filename'] . '"');
    header('X-Fileshare-Filename: ' . $meta['filename']);
    readfile($meta['path']);
    exit;
}

jsonResponse(['success' => false, 'error' => 'Unsupported request'], 405);
