<?php

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// ==============================
// HANDLE OPTIONS / PREFLIGHT
// ==============================
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ==============================
// ONLY GET
// ==============================
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);

    echo json_encode([
        "response" => false,
        "message" => "Method tidak diizinkan"
    ]);

    exit;
}

// ==============================
// API CONFIG
// ==============================
// Jangan taruh API KEY langsung di frontend.
//
// Ganti value di bawah dengan credential Ordersosmed kamu.
// Lebih aman jika hosting mendukung environment variable.
$API_ID = getenv("ORDERSOSMED_API_ID");
$API_KEY = getenv("ORDERSOSMED_API_KEY");
$SECRET_KEY = getenv("ORDERSOSMED_SECRET_KEY");

// Fallback jika environment variable belum tersedia.
// HAPUS bagian ini jika sudah menggunakan environment variable.
if (!$API_ID) {
    $API_ID = "11313";
}

if (!$API_KEY) {
    $API_KEY = "ISI_API_KEY_DI_SERVER";
}

if (!$SECRET_KEY) {
    $SECRET_KEY = "ISI_SECRET_KEY_DI_SERVER";
}

// ==============================
// VALIDASI CONFIG
// ==============================
if (
    empty($API_ID) ||
    empty($API_KEY) ||
    empty($SECRET_KEY) ||
    $API_KEY === "ISI_API_KEY_DI_SERVER" ||
    $SECRET_KEY === "ISI_SECRET_KEY_DI_SERVER"
) {
    http_response_code(500);

    echo json_encode([
        "response" => false,
        "message" => "Konfigurasi API belum lengkap di server."
    ]);

    exit;
}

// ==============================
// REQUEST KE ORDERSOSMED
// ==============================
$url = "https://ordersosmed.id/api-1/service";

$postData = http_build_query([
    "api_id" => $API_ID,
    "api_key" => $API_KEY,
    "secret_key" => $SECRET_KEY
]);

$ch = curl_init($url);

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $postData,

    CURLOPT_HTTPHEADER => [
        "Content-Type: application/x-www-form-urlencoded"
    ],

    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 30,

    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2
]);

$response = curl_exec($ch);

$curlError = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

// ==============================
// CURL ERROR
// ==============================
if ($response === false || !empty($curlError)) {

    http_response_code(502);

    echo json_encode([
        "response" => false,
        "message" => "Gagal menghubungi Ordersosmed.",
        "error" => $curlError
    ]);

    exit;
}

// ==============================
// PARSE JSON
// ==============================
$result = json_decode($response, true);

if (!is_array($result)) {

    http_response_code(502);

    echo json_encode([
        "response" => false,
        "message" => "Response dari Ordersosmed bukan JSON.",
        "raw" => substr($response, 0, 500)
    ]);

    exit;
}

// ==============================
// API ORDERSOSMED GAGAL
// ==============================
if (
    !isset($result["response"]) ||
    $result["response"] !== true
) {

    http_response_code(400);

    echo json_encode([
        "response" => false,
        "message" => $result["message"] ?? "Gagal mengambil layanan.",
        "data" => $result["data"] ?? []
    ]);

    exit;
}

// ==============================
// NORMALISASI DATA
// ==============================
$categories = [];

foreach (($result["data"] ?? []) as $service) {

    $category = $service["category_name"] ?? "Lainnya";

    if (!isset($categories[$category])) {
        $categories[$category] = [];
    }

    /*
     * Ordersosmed:
     *
     * price = harga per 1000
     *
     * Contoh:
     *
     * price = 50000
     *
     * 50000 / 1000 = Rp50 per unit
     */

    $pricePerUnit = ((float)($service["price"] ?? 0)) / 1000;

    $type = $service["type"] ?? "primary";

    $isComment =
        $type === "custom_comments" ||
        $type === "custom_comments_package";

    $categories[$category][] = [

        "id" => $service["id"] ?? null,

        "name" =>
            $service["service_name"]
            ?? ("Layanan " . ($service["id"] ?? "")),

        "pricePerFollower" => $pricePerUnit,

        "diskon" => null,

        "min" => (int)($service["min"] ?? 1),

        "max" => (int)($service["max"] ?? 0),

        "refill" =>
            isset($service["refill"])
            ? filter_var(
                $service["refill"],
                FILTER_VALIDATE_BOOLEAN
            )
            : false,

        "type" => $type,

        "category_id" =>
            $service["category_id"] ?? null,

        "category_name" =>
            $service["category_name"] ?? $category,

        "desc" =>
            $service["description"] ?? "-",

        "comment" => $isComment,

        "average" => "-"
    ];
}

// ==============================
// RESPONSE FRONTEND
// ==============================
http_response_code(200);

echo json_encode([
    "response" => true,
    "data" => $categories,
    "updated_at" => date("c")
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

exit;
?>
