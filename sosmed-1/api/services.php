<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Shine Shop - Ordersosmed Service API Proxy
|--------------------------------------------------------------------------
| Frontend -> services.php -> ordersosmed.id
|
| API KEY dan SECRET KEY HANYA ADA DI SERVER.
|--------------------------------------------------------------------------
*/

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

// ===============================
// KONFIGURASI API
// ===============================

$api_id = '11313';
$api_key = '23941803d5391da4e45a1bf4ebca52064fa17a53574d1c3655a0173dd7530fb1';
$secret_key = 'Alvino11';

$api_url = 'https://ordersosmed.id/api-1/service';

// ===============================
// REQUEST KE PROVIDER
// ===============================

$postData = [
    'api_id'     => $api_id,
    'api_key'    => $api_key,
    'secret_key' => $secret_key
];

$ch = curl_init($api_url);

curl_setopt_array($ch, [
    CURLOPT_POST            => true,
    CURLOPT_POSTFIELDS      => http_build_query($postData),
    CURLOPT_RETURNTRANSFER  => true,
    CURLOPT_TIMEOUT         => 20,
    CURLOPT_CONNECTTIMEOUT  => 10,
    CURLOPT_SSL_VERIFYPEER  => true,
    CURLOPT_SSL_VERIFYHOST  => 2,
    CURLOPT_HTTPHEADER      => [
        'Content-Type: application/x-www-form-urlencoded',
        'Accept: application/json'
    ]
]);

$response = curl_exec($ch);
$curlError = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

// ===============================
// ERROR CURL
// ===============================

if ($response === false || $curlError) {
    http_response_code(502);

    echo json_encode([
        'response' => false,
        'error' => 'Gagal terhubung ke server provider.',
        'detail' => $curlError
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

// ===============================
// PARSE RESPONSE
// ===============================

$data = json_decode($response, true);

if (!is_array($data)) {
    http_response_code(502);

    echo json_encode([
        'response' => false,
        'error' => 'Response provider bukan JSON yang valid.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

// Provider mengembalikan gagal
if (isset($data['response']) && $data['response'] !== true) {
    http_response_code(502);

    echo json_encode([
        'response' => false,
        'error' => 'Provider menolak request.',
        'provider' => $data
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

// ===============================
// KONVERSI DATA PROVIDER
// KE FORMAT YANG DIPAKAI FRONTEND
// ===============================

$hasil = [];

if (!empty($data['data']) && is_array($data['data'])) {

    foreach ($data['data'] as $service) {

        $category = trim((string)($service['category_name'] ?? ''));
        $serviceId = (string)($service['id'] ?? '');

        if ($category === '' || $serviceId === '') {
            continue;
        }

        $name = (string)($service['service_name'] ?? '');
        $type = strtolower((string)($service['type'] ?? ''));

        $price = (float)($service['price'] ?? 0);
        $min = (int)($service['min'] ?? 0);
        $max = (int)($service['max'] ?? 0);

        $description = (string)($service['description'] ?? '');

        /*
         * custom_comments = layanan komentar
         */
        $isComment = ($type === 'custom_comments');

        /*
         * Jika nanti mau markup harga,
         * ubah perhitungan di sini.
         *
         * Contoh:
         * $sellingPrice = $price * 1.2;
         */

        $sellingPrice = $price;

        $item = [
            'id' => $serviceId,

            'name' => $name,

            'pricePerFollower' => $sellingPrice,

            'min' => $min,
            'max' => $max,

            'comment' => $isComment,

            'desc' => $description,

            'average' => '-',

            /*
             * Harga provider disimpan internal
             * hanya jika nanti diperlukan backend.
             */
            'refill' => (bool)($service['refill'] ?? false),

            'type' => $type
        ];

        if (!isset($hasil[$category])) {
            $hasil[$category] = [];
        }

        $hasil[$category][] = $item;
    }
}

// ===============================
// RESPONSE
// ===============================

echo json_encode(
    $hasil,
    JSON_UNESCAPED_UNICODE |
    JSON_UNESCAPED_SLASHES
);
