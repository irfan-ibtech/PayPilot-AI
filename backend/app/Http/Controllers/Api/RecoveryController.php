<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RecoveryOpportunity;
use App\Services\RecoveryAgentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecoveryController extends Controller
{
    protected RecoveryAgentService $recoveryService;

    public function __construct(RecoveryAgentService $recoveryService)
    {
        $this->recoveryService = $recoveryService;
    }

    /**
     * Display a listing of revenue recovery opportunities.
     */
    public function index(Request $request): JsonResponse
    {
        $query = RecoveryOpportunity::with(['order.items', 'latestPayment', 'recoveredPayment'])
            ->where('user_id', $request->user()->id);

        if ($status = $request->query('status')) {
            $query->where('status', strtoupper($status));
        }

        $opportunities = $query->orderByDesc('recovery_score')
            ->latest('created_at')
            ->get();

        return response()->json([
            'data' => $opportunities,
        ]);
    }

    /**
     * Retrieve aggregated AI recovery telemetry and pipeline metrics.
     */
    public function metrics(Request $request): JsonResponse
    {
        $metrics = $this->recoveryService->getRecoveryDashboardMetrics($request->user()->id);

        return response()->json([
            'data' => $metrics,
        ]);
    }

    /**
     * Trigger autonomous scan of merchant drop-offs to discover new recovery opportunities.
     */
    public function scan(Request $request): JsonResponse
    {
        $discovered = $this->recoveryService->scanOpportunities($request->user()->id);

        return response()->json([
            'message' => count($discovered) > 0
                ? 'Scan completed: ' . count($discovered) . ' new recovery opportunities identified.'
                : 'Scan completed: No new unmanaged drop-offs detected.',
            'discovered_count' => count($discovered),
            'data' => $discovered,
        ]);
    }

    /**
     * Display the specified recovery opportunity.
     */
    public function show(Request $request, $id): JsonResponse
    {
        $opportunity = RecoveryOpportunity::with(['order.items', 'latestPayment', 'recoveredPayment'])
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        return response()->json([
            'data' => $opportunity,
        ]);
    }

    /**
     * Approve a recovery opportunity and lock outreach copy.
     */
    public function approve(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'custom_message' => ['nullable', 'string', 'max:2000'],
        ]);

        $opportunity = RecoveryOpportunity::where('user_id', $request->user()->id)
            ->findOrFail($id);

        try {
            $updated = $this->recoveryService->approve(
                $opportunity,
                $request->user()->id,
                $validated['custom_message'] ?? null
            );

            return response()->json([
                'message' => 'Recovery opportunity approved successfully.',
                'data' => $updated,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Reject or dismiss a recovery opportunity.
     */
    public function reject(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $opportunity = RecoveryOpportunity::where('user_id', $request->user()->id)
            ->findOrFail($id);

        try {
            $updated = $this->recoveryService->reject(
                $opportunity,
                $request->user()->id,
                $validated['reason'] ?? null
            );

            return response()->json([
                'message' => 'Recovery opportunity dismissed.',
                'data' => $updated,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Initialize PayPal recovery checkout attempt for approved opportunity.
     */
    public function launchCheckout(Request $request, $id): JsonResponse
    {
        $opportunity = RecoveryOpportunity::with('order')
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        try {
            $result = $this->recoveryService->prepareRecoveryCheckout(
                $opportunity,
                $request->user()->id
            );

            return response()->json([
                'message' => 'Recovery checkout initialized successfully.',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Recovery checkout initialization failed: ' . $e->getMessage(),
            ], 400);
        }
    }
}
