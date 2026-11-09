<?php

return [
    'gemini' => [
        'api_key' => env('GEMINI_API_KEY', ''),
        'model' => env('GEMINI_MODEL', 'gemini-3.1-flash-lite'),
        'endpoint' => 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}',
        'timeout' => 15,
        'connect_timeout' => 5,
    ],
    // Backwards-compatible root aliases for config('ai.gemini_api_key')
    'gemini_api_key' => env('GEMINI_API_KEY', ''),
    'gemini_model' => env('GEMINI_MODEL', 'gemini-3.1-flash-lite'),
];
