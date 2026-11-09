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
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('is_demo_seed')->default(false)->after('notes');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->unsignedInteger('attempt_number')->default(1)->after('currency');
            $table->string('idempotency_key')->nullable()->unique()->after('attempt_number');
            $table->text('failure_reason')->nullable()->after('status');
            $table->boolean('is_recovery_attempt')->default(false)->after('failure_reason');
            $table->boolean('is_demo_seed')->default(false)->after('is_recovery_attempt');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn([
                'attempt_number',
                'idempotency_key',
                'failure_reason',
                'is_recovery_attempt',
                'is_demo_seed',
            ]);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('is_demo_seed');
        });
    }
};
