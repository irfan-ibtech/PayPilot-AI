export interface OrderItem {
  id?: number;
  product_id?: number | null;
  product_name: string;
  name?: string;
  quantity: number;
  unit_price: number | string;
  line_total?: number | string;
}

export interface PaymentRecord {
  id: number;
  order_id: number;
  provider: string;
  paypal_order_id: string;
  paypal_capture_id?: string | null;
  amount: number | string;
  currency: string;
  status: string;
  captured_at?: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  user_id: number;
  order_number: string;
  subtotal: number | string;
  total: number | string;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  notes?: string | null;
  items?: OrderItem[];
  payment?: PaymentRecord | null;
  payments?: PaymentRecord[];
  created_at: string;
}
