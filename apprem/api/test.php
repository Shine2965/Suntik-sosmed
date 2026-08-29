<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$info = [
  'success' => true,
  'message' => 'Proxy PHP OK',
  'php_version' => PHP_VERSION,
  'curl_enabled' => function_exists('curl_init'),
  'time' => date('Y-m-d H:i:s'),
  'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown'
];

echo json_encode($info, JSON_PRETTY_PRINT);
