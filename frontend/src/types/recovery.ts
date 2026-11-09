import type { Order, PaymentRecord } from './order';

export type RecoveryPriority = 'low' | 'medium' | 'high' | 'critical';
export type RecoveryStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_FLIGHT' | 'RECOVERED' | 'EXPIRED';
export type RecoveryStrategy = 'FRESH_CHECKOUT' | 'RETRY_TRANSIENT' | 'MERCHANT_REVIEW' | 'RECONCILE_FIRST' | 'INELIGIBLE';
export type RecoveryWorkflowState =
  | 'DETECTED'
  | 'ANALYZING'
  | 'AWAITING_MERCHANT_APPROVAL'
  | 'APPROVED'
  | 'CHECKOUT_PREPARED'
  | 'CUSTOMER_ACTION_PENDING'
  | 'VERIFYING'
  | 'RECOVERED'
  | 'DISMISSED';

export interface AuditLogItem {
  action: string;
  actor: string;
  user_id?: number;
  details?: string;
  reason?: string;
  timestamp: string;
  paypal_order_id?: string;
}

export interface ScoreBreakdown {
  base: number;
  recency_adjustment: number;
  hours_elapsed: number;
  cart_tier_adjustment: number;
  cart_total: string;
  attempt_history_adjustment: number;
  attempt_count: number;
  historical_rate_adjustment: number;
  merchant_historical_rate: string;
}

export interface EligibilitySignals {
  cart_value_tier: 'standard' | 'medium' | 'high';
  hours_since_dropoff: number;
  attempt_count: number;
  last_failure_reason: string;
  is_multi_item?: boolean;
  strategy?: RecoveryStrategy | string;
  score_breakdown?: ScoreBreakdown;
}

export interface PaymentEventItem {
  id: number;
  user_id: number;
  order_id: number;
  payment_id?: number | null;
  recovery_opportunity_id?: number | null;
  event_type: string;
  source: string;
  summary: string;
  payload?: any;
  occurred_at: string;
}

export interface RecoveryOpportunity {
  id: number;
  user_id: number;
  order_id: number;
  latest_payment_id?: number | null;
  recovered_payment_id?: number | null;
  recovery_score: number;
  priority: RecoveryPriority;
  strategy_key?: RecoveryStrategy | string;
  status: RecoveryStatus;
  workflow_state?: RecoveryWorkflowState | string;
  failure_reason_summary: string | null;
  eligibility_signals: EligibilitySignals | null;
  ai_summary: string | null;
  ai_reasoning: string | null;
  ai_recommended_action: string | null;
  customer_message_draft: string | null;
  ai_confidence: number | null;
  approved_at: string | null;
  rejected_at: string | null;
  recovered_at: string | null;
  recovery_time_seconds?: number | null;
  audit_trail: AuditLogItem[] | null;
  order: Order;
  latest_payment?: PaymentRecord | null;
  recovered_payment?: PaymentRecord | null;
  created_at: string;
  updated_at: string;
}

export interface RecoveryMetrics {
  total_opportunities: number;
  pending_review: number;
  approved_for_recovery: number;
  in_flight: number;
  recovered_count: number;
  rejected_count: number;
  potential_recoverable_revenue: number;
  potential_revenue?: number;
  formatted_potential_revenue: string;
  recovered_revenue: number;
  formatted_recovered_revenue: string;
  recovery_rate: number;
}
