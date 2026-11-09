<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('recovery_opportunities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('latest_payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->foreignId('recovered_payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->unsignedSmallInteger('recovery_score')->default(50);
            $table->string('priority')->default('medium'); // low, medium, high, critical
            $table->string('status')->default('PENDING'); // PENDING, APPROVED, REJECTED, IN_FLIGHT, RECOVERED, EXPIRED
            $table->text('failure_reason_summary')->nullable();
            $table->json('eligibility_signals')->nullable();
            $table->text('ai_summary')->nullable();
            $table->text('ai_reasoning')->nullable();
            $table->text('ai_recommended_action')->nullable();
            $table->text('customer_message_draft')->nullable();
            $table->unsignedSmallInteger('ai_confidence')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('recovered_at')->nullable();
            $table->json('audit_trail')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['order_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('recovery_opportunities');
    }
};
