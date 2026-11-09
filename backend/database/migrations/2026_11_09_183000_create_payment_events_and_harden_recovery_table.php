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
        // 1. Create immutable Payment Events timeline table
        if (!Schema::hasTable('payment_events')) {
            Schema::create('payment_events', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->foreignId('order_id')->constrained()->cascadeOnDelete();
                $table->foreignId('payment_id')->nullable()->constrained('payments')->nullOnDelete();
                $table->foreignId('recovery_opportunity_id')->nullable()->constrained('recovery_opportunities')->nullOnDelete();
                $table->string('event_type', 64)->index();
                $table->string('source', 32)->index(); // PAYPAL_API, BACKEND_ENGINE, MERCHANT_ACTION, AI_AGENT
                $table->text('summary');
                $table->json('payload')->nullable();
                $table->timestamp('occurred_at')->useCurrent();
                $table->timestamps();

                $table->index(['order_id', 'occurred_at']);
                $table->index(['user_id', 'occurred_at']);
            });
        }

        // 2. Extend recovery_opportunities with formal strategy & state machine columns
        Schema::table('recovery_opportunities', function (Blueprint $table) {
            if (!Schema::hasColumn('recovery_opportunities', 'strategy_key')) {
                $table->string('strategy_key', 64)->nullable()->after('priority');
            }
            if (!Schema::hasColumn('recovery_opportunities', 'workflow_state')) {
                $table->string('workflow_state', 64)->default('DETECTED')->after('status');
            }
            if (!Schema::hasColumn('recovery_opportunities', 'recovery_time_seconds')) {
                $table->unsignedInteger('recovery_time_seconds')->nullable()->after('recovered_at');
            }
        });

        // 3. Extend orders with explicit checkout drop-off timestamp
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'checkout_abandoned_at')) {
                $table->timestamp('checkout_abandoned_at')->nullable()->after('is_demo_seed');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_events');

        Schema::table('recovery_opportunities', function (Blueprint $table) {
            if (Schema::hasColumn('recovery_opportunities', 'strategy_key')) {
                $table->dropColumn('strategy_key');
            }
            if (Schema::hasColumn('recovery_opportunities', 'workflow_state')) {
                $table->dropColumn('workflow_state');
            }
            if (Schema::hasColumn('recovery_opportunities', 'recovery_time_seconds')) {
                $table->dropColumn('recovery_time_seconds');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'checkout_abandoned_at')) {
                $table->dropColumn('checkout_abandoned_at');
            }
        });
    }
};
