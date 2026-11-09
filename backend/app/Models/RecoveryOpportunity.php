<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecoveryOpportunity extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'order_id',
        'latest_payment_id',
        'recovered_payment_id',
        'recovery_score',
        'priority',
        'status',
        'failure_reason_summary',
        'eligibility_signals',
        'ai_summary',
        'ai_reasoning',
        'ai_recommended_action',
        'customer_message_draft',
        'ai_confidence',
        'approved_at',
        'rejected_at',
        'recovered_at',
        'audit_trail',
    ];

    protected function casts(): array
    {
        return [
            'recovery_score' => 'integer',
            'ai_confidence' => 'integer',
            'eligibility_signals' => 'array',
            'audit_trail' => 'array',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'recovered_at' => 'datetime',
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

    public function latestPayment(): BelongsTo
    {
        return $this->belongsTo(Payment::class, 'latest_payment_id');
    }

    public function recoveredPayment(): BelongsTo
    {
        return $this->belongsTo(Payment::class, 'recovered_payment_id');
    }
}
