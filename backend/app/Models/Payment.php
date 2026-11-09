<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'user_id',
        'provider',
        'paypal_order_id',
        'paypal_capture_id',
        'amount',
        'currency',
        'attempt_number',
        'idempotency_key',
        'status',
        'failure_reason',
        'is_recovery_attempt',
        'is_demo_seed',
        'payload',
        'captured_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'attempt_number' => 'integer',
            'is_recovery_attempt' => 'boolean',
            'is_demo_seed' => 'boolean',
            'payload' => 'array',
            'captured_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function events(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PaymentEvent::class)->orderBy('occurred_at', 'asc');
    }
}
