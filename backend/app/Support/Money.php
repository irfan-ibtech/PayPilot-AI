<?php

namespace App\Support;

use InvalidArgumentException;

class Money
{
    public const DEFAULT_SCALE = 2;

    /**
     * Determine minor unit decimal scale based on ISO-4217 currency standards.
     */
    public static function getScaleForCurrency(?string $currency = 'USD'): int
    {
        $curr = strtoupper(trim($currency ?? 'USD'));
        return match ($curr) {
            // Zero-decimal currencies
            'JPY', 'KRW', 'VND', 'CLP', 'PYG', 'UGX', 'BIF', 'DJF', 'GNF', 'KMF', 'RWF' => 0,
            // Three-decimal currencies
            'BHD', 'KWD', 'OMR', 'JOD', 'TND', 'LYD', 'IQD' => 3,
            // Standard two-decimal currencies (USD, EUR, GBP, CAD, AUD, etc.)
            default => 2,
        };
    }

    /**
     * Standardize any numeric input into an arbitrary-precision string without float drift.
     */
    public static function format(string|int|float|null $amount, ?string $currency = 'USD'): string
    {
        $scale = self::getScaleForCurrency($currency);

        if ($amount === null || $amount === '') {
            return $scale === 0 ? '0' : '0.' . str_repeat('0', $scale);
        }

        $raw = trim((string) $amount);

        // Strip non-standard currency symbols or commas if present
        $raw = str_replace([',', '$', '€', '£'], '', $raw);

        if (!is_numeric($raw)) {
            throw new InvalidArgumentException("Invalid monetary amount: {$amount}");
        }

        // Avoid scientific notation conversion in PHP
        if (stripos($raw, 'e') !== false) {
            $raw = number_format((float) $raw, 8, '.', '');
        }

        // bcadd with 0 truncates/formats strictly to target scale
        return bcadd($raw, '0', $scale);
    }

    /**
     * Add two amounts with arbitrary precision.
     */
    public static function add(string|int|float|null $a, string|int|float|null $b, ?string $currency = 'USD'): string
    {
        $scale = self::getScaleForCurrency($currency);
        return bcadd(self::format($a, $currency), self::format($b, $currency), $scale);
    }

    /**
     * Subtract $b from $a with arbitrary precision.
     */
    public static function sub(string|int|float|null $a, string|int|float|null $b, ?string $currency = 'USD'): string
    {
        $scale = self::getScaleForCurrency($currency);
        return bcsub(self::format($a, $currency), self::format($b, $currency), $scale);
    }

    /**
     * Multiply quantity by unit price with arbitrary precision.
     */
    public static function mul(string|int|float|null $a, string|int|float|null $b, ?string $currency = 'USD'): string
    {
        $scale = self::getScaleForCurrency($currency);
        // Multiply with intermediate scale (+2) and round to currency scale
        $multiplier = is_numeric($b) ? (string) $b : '0';
        $result = bcmul(self::format($a, $currency), $multiplier, $scale + 2);
        return self::format($result, $currency);
    }

    /**
     * Divide $a by $b with arbitrary precision.
     */
    public static function div(string|int|float|null $a, string|int|float|null $b, ?string $currency = 'USD'): string
    {
        $scale = self::getScaleForCurrency($currency);
        $divisor = self::format($b, $currency);
        $zero = $scale === 0 ? '0' : '0.' . str_repeat('0', $scale);

        if (bccomp($divisor, $zero, $scale) === 0) {
            return $zero;
        }

        $result = bcdiv(self::format($a, $currency), $divisor, $scale + 2);
        return self::format($result, $currency);
    }

    /**
     * Compare two amounts:
     * Returns 0 if equal, 1 if $a > $b, -1 if $a < $b.
     */
    public static function comp(string|int|float|null $a, string|int|float|null $b, ?string $currency = 'USD'): int
    {
        $scale = self::getScaleForCurrency($currency);
        return bccomp(self::format($a, $currency), self::format($b, $currency), $scale);
    }

    /**
     * Check if two amounts are mathematically equal.
     */
    public static function equals(string|int|float|null $a, string|int|float|null $b, ?string $currency = 'USD'): bool
    {
        return self::comp($a, $b, $currency) === 0;
    }

    /**
     * Check if amount is strictly greater than zero.
     */
    public static function isPositive(string|int|float|null $amount, ?string $currency = 'USD'): bool
    {
        $scale = self::getScaleForCurrency($currency);
        $zero = $scale === 0 ? '0' : '0.' . str_repeat('0', $scale);
        return bccomp(self::format($amount, $currency), $zero, $scale) > 0;
    }

    /**
     * Convert decimal amount to integer minor units (e.g. cents for USD, yen for JPY).
     */
    public static function toMinorUnits(string|int|float|null $amount, ?string $currency = 'USD'): int
    {
        $scale = self::getScaleForCurrency($currency);
        $multiplier = bcpow('10', (string) $scale, 0);
        $formatted = self::format($amount, $currency);
        return (int) bcmul($formatted, $multiplier, 0);
    }

    /**
     * Backwards-compatible alias for toMinorUnits.
     */
    public static function toCents(string|int|float|null $amount): int
    {
        return self::toMinorUnits($amount, 'USD');
    }

    /**
     * Convert integer minor units back to currency-scaled decimal string.
     */
    public static function fromMinorUnits(int $minorUnits, ?string $currency = 'USD'): string
    {
        $scale = self::getScaleForCurrency($currency);
        $divisor = bcpow('10', (string) $scale, 0);
        return bcdiv((string) $minorUnits, $divisor, $scale);
    }

    /**
     * Backwards-compatible alias for fromMinorUnits.
     */
    public static function fromCents(int $cents): string
    {
        return self::fromMinorUnits($cents, 'USD');
    }
}
