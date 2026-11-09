import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { X, ShieldCheck, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import api from '../services/api';
import type { Order, PaymentRecord } from '../types/order';

interface PayPalCheckoutModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (payment: PaymentRecord) => void;
  recoveryOpportunityId?: number;
}

export const PayPalCheckoutModal: React.FC<PayPalCheckoutModalProps> = ({
  order,
  isOpen,
  onClose,
  onPaymentSuccess,
  recoveryOpportunityId,
}) => {
  const [clientId, setClientId] = useState<string>('');
  const [paypalMode, setPaypalMode] = useState<string>('sandbox');
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [completedPayment, setCompletedPayment] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setWarningMessage(null);
      setCompletedPayment(null);
      return;
    }

    const fetchConfig = async () => {
      setLoadingConfig(true);
      try {
        const response = await api.get('/payments/paypal/client-id');
        setClientId(response.data.client_id || '');
        setPaypalMode(response.data.mode || 'sandbox');
      } catch (err) {
        console.error('Failed to fetch PayPal client ID', err);
        setErrorMessage('Unable to load payment configuration.');
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchConfig();
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const handleSimulatedCapture = async () => {
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      let paypalOrderId: string;
      if (recoveryOpportunityId) {
        const createRes = await api.post(`/recovery/opportunities/${recoveryOpportunityId}/checkout`);
        paypalOrderId = createRes.data.data.paypal_order_id;
      } else {
        const createRes = await api.post(`/payments/paypal/${order.id}/create`);
        paypalOrderId = createRes.data.paypal_order_id;
      }

      // 2. Capture payment
      const captureRes = await api.post('/payments/paypal/capture', {
        paypal_order_id: paypalOrderId,
      });

      const payment = captureRes.data.payment;
      setCompletedPayment(payment);
      onPaymentSuccess(payment);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response;
        setErrorMessage(res?.data?.message || 'Payment processing failed.');
      } else {
        setErrorMessage('Network or server error during simulated checkout.');
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const isSimulatedPayment = completedPayment?.is_simulated || completedPayment?.paypal_order_id?.startsWith('SIMULATED-');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            PP
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">PayPal Checkout</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">Order:</span>
              <span className="text-xs font-mono font-semibold text-blue-400">
                {order.order_number}
              </span>
              {clientId ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1.5 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live PayPal {paypalMode === 'sandbox' ? 'Sandbox' : 'Production'}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-medium">
                  Local Simulation
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Order Amount Banner */}
        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Total to Pay</p>
            <p className="text-2xl font-bold font-mono text-white mt-0.5">
              ${parseFloat(String(order.total)).toFixed(2)}{' '}
              <span className="text-sm font-sans text-slate-400">{order.currency}</span>
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>{order.items?.length || 0} line item(s)</p>
            <div className="flex items-center gap-1 text-emerald-400 font-medium mt-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Verified Amount</span>
            </div>
          </div>
        </div>

        {/* Success View */}
        {completedPayment && (
          <div className="space-y-4 py-4 text-center">
            <div className="h-14 w-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Payment Verified & Captured!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Server-side capture successfully validated against Order #{order.order_number}
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs font-mono space-y-1.5 text-slate-300">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-slate-400 font-sans font-semibold">Settlement Verification:</span>
                {isSimulatedPayment ? (
                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-sans font-semibold">
                    LOCAL TEST SIMULATION
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-sans font-semibold flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse"></span>
                    GENUINE PAYPAL CAPTURE
                  </span>
                )}
              </div>
              <p>
                <span className="text-slate-500">PayPal Order ID:</span>{' '}
                <span className="text-blue-400">{completedPayment.paypal_order_id}</span>
              </p>
              <p>
                <span className="text-slate-500">Capture ID:</span>{' '}
                <span className="text-emerald-400">
                  {completedPayment.paypal_capture_id || 'COMPLETED'}
                </span>
              </p>
              <p>
                <span className="text-slate-500">Settled Amount:</span>{' '}
                <span className="text-white font-bold">
                  ${parseFloat(String(completedPayment.amount || order.total)).toFixed(2)} {completedPayment.currency || order.currency}
                </span>
              </p>
              <p>
                <span className="text-slate-500">Status:</span>{' '}
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-semibold">
                  {completedPayment.status}
                </span>
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-2 transition"
            >
              <span>Done & Return to Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Normal Payment Flow */}
        {!completedPayment && (
          <div className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {warningMessage && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{warningMessage}</span>
              </div>
            )}

            {isCapturing && (
              <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800 flex items-center justify-center gap-3 text-sm text-blue-300">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Verifying and capturing payment with PayPal API...</span>
              </div>
            )}

            {loadingConfig ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-xs">Initializing PayPal SDK...</span>
              </div>
            ) : clientId ? (
              <div className="min-h-[140px] pt-1 space-y-3">
                <PayPalScriptProvider
                  options={{
                    clientId: clientId,
                    currency: order.currency || 'USD',
                    intent: 'capture',
                  }}
                >
                  <PayPalButtons
                    style={{
                      layout: 'vertical',
                      color: 'gold',
                      shape: 'rect',
                      label: 'pay',
                      height: 44,
                    }}
                    createOrder={async () => {
                      setErrorMessage(null);
                      try {
                        if (recoveryOpportunityId) {
                          const response = await api.post(`/recovery/opportunities/${recoveryOpportunityId}/checkout`);
                          return response.data.data.paypal_order_id;
                        }
                        const response = await api.post(`/payments/paypal/${order.id}/create`);
                        return response.data.paypal_order_id;
                      } catch (err: unknown) {
                        const msg =
                          (err as { response?: { data?: { message?: string } } })?.response?.data
                            ?.message || 'Failed to initiate PayPal order.';
                        setErrorMessage(msg);
                        throw new Error(msg);
                      }
                    }}
                    onApprove={async (data) => {
                      setIsCapturing(true);
                      setErrorMessage(null);
                      try {
                        const response = await api.post('/payments/paypal/capture', {
                          paypal_order_id: data.orderID,
                        });
                        const payment = response.data.payment;
                        setCompletedPayment(payment);
                        onPaymentSuccess(payment);
                      } catch (err: unknown) {
                        const msg =
                          (err as { response?: { data?: { message?: string } } })?.response?.data
                            ?.message || 'Payment capture failed.';
                        setErrorMessage(msg);
                      } finally {
                        setIsCapturing(false);
                      }
                    }}
                    onError={(err) => {
                      console.error('PayPal Buttons Error', err);
                      setErrorMessage('PayPal checkout encountered an error. Please try again.');
                    }}
                    onCancel={() => {
                      setWarningMessage('PayPal checkout was cancelled.');
                    }}
                  />
                </PayPalScriptProvider>

                {/* Optional test simulation button for development/offline environments */}
                <div className="pt-2 border-t border-slate-800/80 text-center">
                  <button
                    type="button"
                    disabled={isCapturing}
                    onClick={handleSimulatedCapture}
                    className="text-[11px] text-slate-400 hover:text-slate-200 underline hover:no-underline transition disabled:opacity-50"
                  >
                    Run local simulation fallback test
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" />
                    PayPal Sandbox Credentials Pending
                  </p>
                  <p>
                    `PAYPAL_CLIENT_ID` is not yet configured in <code className="px-1 py-0.5 rounded bg-slate-900">backend/.env</code>.
                    You can test the full verification pipeline using simulated capture or provide credentials to test the real PayPal popup.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isCapturing}
                  onClick={handleSimulatedCapture}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-blue-500/20"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Execute Test Capture & Verification</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PayPalCheckoutModal;
