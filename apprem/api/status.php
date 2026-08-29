<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$api_key = $input['api_key'] ?? 'd18db436519ea72a85bc49ff62f82b82';
$invoice = $input['invoice'] ?? '';

if ($invoice === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'invoice wajib']);
    exit;
}

$ch = curl_init('https://premku.com/api/status');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Accept: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'api_key' => $api_key,
        'invoice' => $invoice
    ]),
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Proxy error: ' . $error]);
    exit;
}

http_response_code($httpCode ?: 200);
echo $response ?: json_encode(['success' => false, 'message' => 'Empty response']);
