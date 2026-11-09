<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
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

        foreach ($sampleProducts as $productData) {
            $merchant->products()->updateOrCreate(
                ['name' => $productData['name']],
                $productData
            );
        }
    }
}
