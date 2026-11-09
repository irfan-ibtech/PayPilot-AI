<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'order_id',
        'payment_id',
        'recovery_opportunity_id',
        'event_type',
        'source',
        'summary',
        'payload',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function recoveryOpportunity(): BelongsTo
    {
        return $this->belongsTo(RecoveryOpportunity::class);
    }

    /**
     * Record an immutable payment/recovery event.
     */
    public static function log(
        int $userId,
        int $orderId,
        string $eventType,
        string $source,
        string $summary,
        ?array $payload = null,
        ?int $paymentId = null,
        ?int $recoveryOpportunityId = null
    ): self {
        return self::create([
            'user_id' => $userId,
            'order_id' => $orderId,
            'payment_id' => $paymentId,
            'recovery_opportunity_id' => $recoveryOpportunityId,
            'event_type' => $eventType,
            'source' => $source,
            'summary' => $summary,
            'payload' => $payload,
            'occurred_at' => now(),
        ]);
    }
}
