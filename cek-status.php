<?php
header("Content-Type: application/json");
error_reporting(0);

$input = json_decode(file_get_contents("php://input"), true);
$order_id = $input["order_id"] ?? null;

if (!$order_id) {
    echo json_encode(["response" => false, "error" => "order_id wajib diisi"]);
    exit;
}

$api_url = "https://ordersosmed.id/api-1/status";
$api_id = "11313";
$api_key = "509a318e2a7225c109810cd1d130a5fa310b9e935c60b0ae90d5af688dd71e84";
$secret_key = "509a318e2a7225c109810cd1d130a5fa310b9e935c60b0ae90d5af688dd71e84";

$ch = curl_init($api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "api_id: $api_id",
    "api_key: $api_key",
    "secret_key: $secret_key"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["order_id" => $order_id]));

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// Debug
if ($error) {
    echo json_encode(["response" => false, "error" => "Curl error: $error"]);
    exit;
}

if ($httpcode !== 200) {
    echo json_encode([
        "response" => false,
        "error" => "HTTP Code: $httpcode",
        "raw" => $response
    ]);
    exit;
}

// Coba parse JSON
$json = json_decode($response, true);
if ($json === null) {
    echo json_encode([
        "response" => false,
        "error" => "Respon bukan JSON",
        "raw" => $response   // <--- tampilkan isi asli dari API
    ]);
    exit;
}

echo $response;
