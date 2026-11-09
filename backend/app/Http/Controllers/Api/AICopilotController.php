<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BusinessRecommendation;
use App\Services\AnalyticsService;
use App\Services\GeminiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AICopilotController extends Controller
{
    protected AnalyticsService $analyticsService;
    protected GeminiService $geminiService;

    public function __construct(AnalyticsService $analyticsService, GeminiService $geminiService)
    {
        $this->analyticsService = $analyticsService;
        $this->geminiService = $geminiService;
    }

    /**
     * Get comprehensive merchant analytics overview for dashboard metrics.
     */
    public function getOverview(Request $request): JsonResponse
    {
        $metrics = $this->analyticsService->getMerchantMetrics($request->user()->id);

        $latestRecommendation = BusinessRecommendation::where('user_id', $request->user()->id)
            ->latest('created_at')
            ->first();

        return response()->json([
            'metrics' => $metrics,
            'latest_recommendation' => $latestRecommendation,
        ]);
    }

    /**
     * Query the Gemini Copilot with store metrics context and persist generated recommendations.
     */
    public function ask(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'question' => ['nullable', 'string', 'max:500'],
        ]);

        $userId = $request->user()->id;
        $question = $validated['question'] ?? 'Provide an executive business summary and 3 strategic recommendations to improve my store performance.';

        // 1. Deterministic metrics aggregation
        $metrics = $this->analyticsService->getMerchantMetrics($userId);

        // 2. AI insight generation
        $result = $this->geminiService->generateBusinessInsights($metrics, $question);

        // 3. Persist recommendations into database
        $savedRecommendations = [];
        foreach ($result['recommendations'] as $recData) {
            $recommendation = BusinessRecommendation::create([
                'user_id' => $userId,
                'title' => $recData['title'],
                'description' => $recData['description'],
                'supporting_metric' => $recData['supporting_metric'],
                'suggested_action' => $recData['suggested_action'],
                'priority' => $recData['priority'],
            ]);
            $savedRecommendations[] = $recommendation;
        }

        return response()->json([
            'question' => $question,
            'metrics_summary' => $metrics,
            'analysis' => $result['analysis'],
            'recommendations' => $savedRecommendations,
        ]);
    }

    /**
     * Retrieve all saved business recommendations for the merchant.
     */
    public function getRecommendations(Request $request): JsonResponse
    {
        $recommendations = BusinessRecommendation::where('user_id', $request->user()->id)
            ->latest('created_at')
            ->get();

        return response()->json([
            'data' => $recommendations,
        ]);
    }
}
