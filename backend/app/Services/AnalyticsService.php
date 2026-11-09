<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AnalyticsService
{
    /**
     * Compute comprehensive, deterministic transaction metrics for a merchant.
     */
    public function getMerchantMetrics(int $userId): array
    {
        // 1. Orders breakdown
        $ordersQuery = Order::where('user_id', $userId);

        $totalOrders = (clone $ordersQuery)->count();
        $paidOrders = (clone $ordersQuery)->where('status', 'PAID')->count();
        $pendingOrders = (clone $ordersQuery)->where('status', 'PENDING')->count();
        $failedOrders = (clone $ordersQuery)->where('status', 'FAILED')->count();

        // 2. Revenue metrics
        $totalRevenue = (float) ((clone $ordersQuery)->where('status', 'PAID')->sum('total') ?? 0.0);
        $conversionRate = $totalOrders > 0 ? round(($paidOrders / $totalOrders) * 100, 1) : 0.0;
        $aov = $paidOrders > 0 ? round($totalRevenue / $paidOrders, 2) : 0.0;

        // 3. PayPal Payment Metrics
        $paymentsQuery = Payment::where('user_id', $userId);
        $totalPayPalCapturedVolume = (float) ((clone $paymentsQuery)->where('status', 'COMPLETED')->sum('amount') ?? 0.0);
        $totalPayPalTransactions = (clone $paymentsQuery)->count();

        // 4. Top-Selling Products by Revenue
        $topProducts = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.user_id', $userId)
            ->where('orders.status', 'PAID')
            ->select(
                'order_items.product_name',
                DB::raw('SUM(order_items.quantity) as total_units_sold'),
                DB::raw('SUM(order_items.line_total) as total_revenue_generated')
            )
            ->groupBy('order_items.product_name')
            ->orderByDesc('total_revenue_generated')
            ->limit(5)
            ->get()
            ->map(function ($item) {
                return [
                    'product_name' => $item->product_name,
                    'total_units_sold' => (int) $item->total_units_sold,
                    'total_revenue_generated' => round((float) $item->total_revenue_generated, 2),
                ];
            })
            ->toArray();

        // 5. Recent Daily Volume (Last 7 Days)
        $sevenDaysAgo = Carbon::now()->subDays(6)->startOfDay();

        $dailyRecords = DB::table('orders')
            ->where('user_id', $userId)
            ->where('status', 'PAID')
            ->where('created_at', '>=', $sevenDaysAgo)
            ->select(
                DB::raw('DATE(created_at) as order_date'),
                DB::raw('COUNT(*) as orders_count'),
                DB::raw('SUM(total) as daily_total')
            )
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('order_date')
            ->get()
            ->keyBy('order_date');

        $dailyVolume = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = Carbon::now()->subDays($i)->format('Y-m-d');
            $dayName = Carbon::now()->subDays($i)->format('D');
            $record = $dailyRecords->get($date);

            $dailyVolume[] = [
                'date' => $date,
                'day' => $dayName,
                'orders_count' => $record ? (int) $record->orders_count : 0,
                'daily_total' => $record ? round((float) $record->daily_total, 2) : 0.0,
            ];
        }

        return [
            'total_revenue' => round($totalRevenue, 2),
            'formatted_revenue' => '$' . number_format($totalRevenue, 2),
            'total_orders' => $totalOrders,
            'paid_orders' => $paidOrders,
            'pending_orders' => $pendingOrders,
            'failed_orders' => $failedOrders,
            'conversion_rate' => $conversionRate,
            'average_order_value' => $aov,
            'formatted_aov' => '$' . number_format($aov, 2),
            'paypal_metrics' => [
                'total_captured_volume' => round($totalPayPalCapturedVolume, 2),
                'formatted_captured_volume' => '$' . number_format($totalPayPalCapturedVolume, 2),
                'total_transactions' => $totalPayPalTransactions,
            ],
            'top_selling_products' => $topProducts,
            'daily_volume' => $dailyVolume,
        ];
    }
}
