import type { Order, PaymentRecord } from './order';

export type RecoveryPriority = 'low' | 'medium' | 'high' | 'critical';
export type RecoveryStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_FLIGHT' | 'RECOVERED' | 'EXPIRED';

export interface AuditLogItem {
  action: string;
  actor: string;
  user_id?: number;
  details?: string;
  reason?: string;
  timestamp: string;
  paypal_order_id?: string;
}

export interface EligibilitySignals {
  cart_value_tier: 'standard' | 'medium' | 'high';
  hours_since_dropoff: number;
  attempt_count: number;
  last_failure_reason: string;
  is_multi_item?: boolean;
}

export interface RecoveryOpportunity {
  id: number;
  user_id: number;
  order_id: number;
  latest_payment_id?: number | null;
  recovered_payment_id?: number | null;
  recovery_score: number;
  priority: RecoveryPriority;
  status: RecoveryStatus;
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
