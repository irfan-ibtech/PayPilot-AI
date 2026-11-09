<?php

namespace Database\Seeders;

use App\Models\BusinessRecommendation;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with demo merchant products, orders, and telemetry.
     */
    public function run(): void
    {
        $merchant = User::updateOrCreate(
            ['email' => 'demo@paypilot.ai'],
            [
                'name' => 'Demo Merchant',
                'password' => Hash::make('password123'),
            ]
        );

        $sampleProducts = [
            [
                'name' => 'Wireless Headphones',
                'description' => 'Premium active noise-cancelling over-ear wireless headphones.',
                'unit_price' => 45.00,
                'currency' => 'USD',
            ],
            [
                'name' => 'Phone Case',
                'description' => 'Slim shockproof silicone case designed for everyday impact resistance.',
                'unit_price' => 12.00,
                'currency' => 'USD',
            ],
            [
                'name' => 'Mechanical Keyboard',
                'description' => 'Compact 75% hot-swappable mechanical keyboard with RGB backlighting.',
                'unit_price' => 85.00,
                'currency' => 'USD',
            ],
            [
                'name' => 'USB-C Charging Hub',
                'description' => '7-in-1 multi-port adapter with 100W Power Delivery pass-through and 4K HDMI.',
                'unit_price' => 29.50,
                'currency' => 'USD',
            ],
            [
                'name' => 'Ergonomic Mousepad',
                'description' => 'Memory foam wrist-rest desk pad with textured non-slip rubber base.',
                'unit_price' => 18.00,
                'currency' => 'USD',
            ],
        ];

        $productModels = [];
        foreach ($sampleProducts as $productData) {
            $productModels[$productData['name']] = $merchant->products()->updateOrCreate(
                ['name' => $productData['name']],
                $productData
            );
        }

        // 12 Orders spread over the last 7 days
        // 8 PAID, 3 PENDING, 1 FAILED
        $orderTemplates = [
            // Day 6 ago
            [
                'days_ago' => 6,
                'status' => 'PAID',
                'items' => [
                    ['name' => 'Wireless Headphones', 'qty' => 1],
                    ['name' => 'Phone Case', 'qty' => 1],
                ],
            ],
            [
                'days_ago' => 6,
                'status' => 'PAID',
                'items' => [
                    ['name' => 'Mechanical Keyboard', 'qty' => 1],
                ],
            ],
            // Day 5 ago
            [
                'days_ago' => 5,
                'status' => 'PAID',
                'items' => [
                    ['name' => 'USB-C Charging Hub', 'qty' => 2],
                ],
            ],
            [
                'days_ago' => 5,
                'status' => 'FAILED',
                'items' => [
                    ['name' => 'Wireless Headphones', 'qty' => 2],
                ],
            ],
            // Day 4 ago
            [
                'days_ago' => 4,
                'status' => 'PAID',
                'items' => [
                    ['name' => 'Mechanical Keyboard', 'qty' => 1],
                    ['name' => 'Ergonomic Mousepad', 'qty' => 1],
                ],
            ],
            // Day 3 ago
            [
                'days_ago' => 3,
                'status' => 'PAID',
                'items' => [
                    ['name' => 'Wireless Headphones', 'qty' => 1],
                    ['name' => 'USB-C Charging Hub', 'qty' => 1],
                ],
            ],
            [
                'days_ago' => 3,
                'status' => 'PENDING',
                'items' => [
                    ['name' => 'Mechanical Keyboard', 'qty' => 2],
                ],
            ],
            // Day 2 ago
            [
                'days_ago' => 2,
                'status' => 'PAID',
                'items' => [
                    ['name' => 'Phone Case', 'qty' => 3],
                    ['name' => 'Ergonomic Mousepad', 'qty' => 1],
                ],
            ],
            // Day 1 ago
            [
                'days_ago' => 1,
                'status' => 'PAID',
                'items' => [
                    ['name' => 'Mechanical Keyboard', 'qty' => 1],
                    ['name' => 'Phone Case', 'qty' => 2],
                ],
            ],
            [
                'days_ago' => 1,
                'status' => 'PENDING',
                'items' => [
                    ['name' => 'Wireless Headphones', 'qty' => 1],
                ],
            ],
            // Today
            [
                'days_ago' => 0,
                'status' => 'PAID',
                'items' => [
                    ['name' => 'Wireless Headphones', 'qty' => 2],
                    ['name' => 'Ergonomic Mousepad', 'qty' => 2],
                ],
            ],
            [
                'days_ago' => 0,
                'status' => 'PENDING',
                'items' => [
                    ['name' => 'USB-C Charging Hub', 'qty' => 1],
                    ['name' => 'Phone Case', 'qty' => 1],
                ],
            ],
        ];

        foreach ($orderTemplates as $index => $template) {
            $createdAt = Carbon::now()->subDays($template['days_ago'])->subHours(rand(1, 10))->subMinutes(rand(5, 50));
            $orderNumber = 'PP-' . strtoupper(Str::random(8));

            $subtotal = 0.00;
            $itemsData = [];

            foreach ($template['items'] as $itemRef) {
                $p = $productModels[$itemRef['name']];
                $qty = $itemRef['qty'];
                $price = (float) $p->unit_price;
                $lineTotal = round($qty * $price, 2);
                $subtotal += $lineTotal;

                $itemsData[] = [
                    'product_id' => $p->id,
                    'product_name' => $p->name,
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'line_total' => $lineTotal,
                ];
            }

            $order = Order::create([
                'user_id' => $merchant->id,
                'order_number' => $orderNumber,
                'subtotal' => $subtotal,
                'total' => $subtotal,
                'currency' => 'USD',
                'status' => $template['status'],
                'notes' => "Seeded order #{$orderNumber}",
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            foreach ($itemsData as $itemRow) {
                $order->items()->create(array_merge($itemRow, [
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]));
            }

            // Create Payment record for PAID and FAILED orders
            if ($template['status'] === 'PAID') {
                Payment::create([
                    'order_id' => $order->id,
                    'user_id' => $merchant->id,
                    'provider' => 'paypal',
                    'paypal_order_id' => 'PP-SIM-' . strtoupper(Str::random(10)),
                    'paypal_capture_id' => 'CAPTURE-SIM-' . strtoupper(Str::random(12)),
                    'amount' => $order->total,
                    'currency' => 'USD',
                    'status' => 'COMPLETED',
                    'payload' => [
                        'status' => 'COMPLETED',
                        'simulated' => true,
                        'source' => 'DatabaseSeeder',
                    ],
                    'captured_at' => $createdAt,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]);
            } elseif ($template['status'] === 'FAILED') {
                Payment::create([
                    'order_id' => $order->id,
                    'user_id' => $merchant->id,
                    'provider' => 'paypal',
                    'paypal_order_id' => 'PP-SIM-' . strtoupper(Str::random(10)),
                    'paypal_capture_id' => null,
                    'amount' => $order->total,
                    'currency' => 'USD',
                    'status' => 'FAILED',
                    'payload' => [
                        'status' => 'FAILED',
                        'error' => 'INSTRUMENT_DECLINED',
                    ],
                    'captured_at' => null,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]);
            }
        }

        // Seed initial business recommendation
        BusinessRecommendation::create([
            'user_id' => $merchant->id,
            'title' => 'Recover Unpaid Orders via PayPal Express Invoicing',
            'description' => 'You currently have 3 pending orders awaiting checkout completion. Sending automated PayPal 1-click payment links will substantially recover abandoned revenue.',
            'supporting_metric' => '3 Pending Orders (~$215 recoverable)',
            'suggested_action' => 'Deploy 1-click PayPal paylinks to pending carts',
            'priority' => 'high',
        ]);
    }
}
