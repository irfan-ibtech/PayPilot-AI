<?php

namespace App\Support;

use InvalidArgumentException;

class Money
{
    public const SCALE = 2;

    /**
     * Standardize any numeric input into a scale-2 string representation.
     */
    public static function format(string|int|float|null $amount): string
    {
        if ($amount === null || $amount === '') {
            return '0.00';
        }

        if (is_numeric($amount)) {
            return number_format((float) $amount, self::SCALE, '.', '');
        }

        throw new InvalidArgumentException("Invalid monetary amount: {$amount}");
    }

    /**
     * Add two amounts with arbitrary precision.
     */
    public static function add(string|int|float|null $a, string|int|float|null $b): string
    {
        return bcadd(self::format($a), self::format($b), self::SCALE);
    }

    /**
     * Subtract $b from $a with arbitrary precision.
     */
    public static function sub(string|int|float|null $a, string|int|float|null $b): string
    {
        return bcsub(self::format($a), self::format($b), self::SCALE);
    }

    /**
     * Multiply two amounts with arbitrary precision.
     */
    public static function mul(string|int|float|null $a, string|int|float|null $b): string
    {
        // Multiply using higher scale internally then truncate/format to 2 decimals
        $result = bcmul(self::format($a), (string) $b, self::SCALE + 2);
        return self::format($result);
    }

    /**
     * Divide $a by $b with arbitrary precision.
     */
    public static function div(string|int|float|null $a, string|int|float|null $b): string
    {
        $divisor = self::format($b);
        if (bccomp($divisor, '0.00', self::SCALE) === 0) {
            return '0.00';
        }

        $result = bcdiv(self::format($a), $divisor, self::SCALE + 2);
        return self::format($result);
    }

    /**
     * Compare two amounts:
     * Returns 0 if equal, 1 if $a > $b, -1 if $a < $b.
     */
    public static function comp(string|int|float|null $a, string|int|float|null $b): int
    {
        return bccomp(self::format($a), self::format($b), self::SCALE);
    }

    /**
     * Check if two amounts are mathematically equal.
     */
    public static function equals(string|int|float|null $a, string|int|float|null $b): bool
    {
        return self::comp($a, $b) === 0;
    }

    /**
     * Check if amount is strictly greater than zero.
     */
    public static function isPositive(string|int|float|null $amount): bool
    {
        return bccomp(self::format($amount), '0.00', self::SCALE) > 0;
    }

    /**
     * Convert decimal amount to integer cents (e.g., "19.99" -> 1999).
     */
    public static function toCents(string|int|float|null $amount): int
    {
        $formatted = self::format($amount);
        return (int) bcmul($formatted, '100', 0);
    }

    /**
     * Convert integer cents to scale-2 decimal amount (e.g., 1999 -> "19.99").
     */
    public static function fromCents(int $cents): string
    {
        return bcdiv((string) $cents, '100', self::SCALE);
    }
}
