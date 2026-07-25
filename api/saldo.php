<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Fungsi baca data dari /info/accounts.json
function getAccounts() {
    $file = __DIR__ . '/info/accounts.json';
    if (!file_exists($file)) {
        return ['error' => 'File accounts.json tidak ditemukan'];
    }
    $data = file_get_contents($file);
    return json_decode($data, true) ?: [];
}

// Fungsi cari akun berdasarkan Gmail & Password
function findAccount($gmail, $password) {
    $accounts = getAccounts();
    if (isset($accounts['error'])) return null;
    
    foreach ($accounts as $acc) {
        if ($acc['Gmail'] === $gmail && $acc['Password'] === $password) {
            return $acc;
        }
    }
    return null;
}

// Fungsi cari akun berdasarkan Gmail saja (untuk master)
function findAccountByGmail($gmail) {
    $accounts = getAccounts();
    if (isset($accounts['error'])) return null;
    
    foreach ($accounts as $acc) {
        if ($acc['Gmail'] === $gmail) {
            return $acc;
        }
    }
    return null;
}

// ========== ROUTING ==========
$action = $_GET['action'] ?? '';

if ($action === 'login') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['status' => 'error', 'message' => 'Method harus POST']);
        exit;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $gmail = $input['gmail'] ?? '';
    $password = $input['password'] ?? '';
    
    if (empty($gmail) || empty($password)) {
        echo json_encode(['status' => 'error', 'message' => 'Gmail dan password wajib diisi']);
        exit;
    }
    
    $account = findAccount($gmail, $password);
    if ($account) {
        // Kirim data (tanpa password, tapi dengan role)
        echo json_encode([
            'status' => 'success',
            'message' => 'Login berhasil',
            'data' => [
                'Gmail' => $account['Gmail'],
                'Saldo' => $account['Saldo'],
                'Role' => $account['Role'] ?? 'user',
                'QRIS' => $account['QRIS'] ?? null,
                'Dana' => $account['Dana'] ?? null
            ]
        ]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Gmail atau password salah']);
    }
    exit;
}

if ($action === 'saldo') {
    $gmail = $_GET['gmail'] ?? '';
    if (empty($gmail)) {
        echo json_encode(['status' => 'error', 'message' => 'Gmail wajib diisi']);
        exit;
    }
    
    $account = findAccountByGmail($gmail);
    if ($account) {
        echo json_encode([
            'status' => 'success',
            'data' => [
                'Gmail' => $account['Gmail'],
                'Saldo' => $account['Saldo'],
                'Role' => $account['Role'] ?? 'user',
                'QRIS' => $account['QRIS'] ?? null,
                'Dana' => $account['Dana'] ?? null
            ]
        ]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Akun tidak ditemukan']);
    }
    exit;
}

// ========== NEW: GET ALL ACCOUNTS (khusus master) ==========
if ($action === 'all-accounts') {
    $gmail = $_GET['gmail'] ?? '';
    if (empty($gmail)) {
        echo json_encode(['status' => 'error', 'message' => 'Gmail wajib diisi']);
        exit;
    }
    
    // Cek apakah user adalah master
    $account = findAccountByGmail($gmail);
    if (!$account || ($account['Role'] ?? 'user') !== 'master') {
        echo json_encode(['status' => 'error', 'message' => 'Akses ditolak. Hanya master yang bisa melihat semua akun.']);
        exit;
    }
    
    $accounts = getAccounts();
    if (isset($accounts['error'])) {
        echo json_encode(['status' => 'error', 'message' => $accounts['error']]);
        exit;
    }
    
    // Hapus password dari response
    $safeAccounts = array_map(function($acc) {
        unset($acc['Password']);
        return $acc;
    }, $accounts);
    
    echo json_encode([
        'status' => 'success',
        'data' => $safeAccounts
    ]);
    exit;
}

// Default response
echo json_encode(['status' => 'error', 'message' => 'Aksi tidak dikenali']);
?>
