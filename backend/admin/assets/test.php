<?php
header('Content-Type: text/plain');
echo "Assets directory is accessible!\n";
echo "Current directory: " . __DIR__ . "\n";
echo "CSS file exists: " . (file_exists(__DIR__ . '/css/admin.css') ? 'YES' : 'NO') . "\n";
echo "CSS file path: " . __DIR__ . '/css/admin.css' . "\n";

