import crypto from 'crypto';
import mongoose from 'mongoose';
import { FoodOrder } from '../../../modules/food/orders/models/order.model.js';
import { FoodTransaction } from '../../../modules/food/orders/models/foodTransaction.model.js';
import * as foodTransactionService from '../../../modules/food/orders/services/foodTransaction.service.js';
import { config } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import { notifyRestaurantNewOrder } from '../../../modules/food/orders/services/order.helpers.js';

/**
 * ✅ NEW: Centralized Razorpay Webhook Handler (Core Layer)
 * Manages atomic updates for order payments and refunds across all modules.
 */
export const handleRazorpayWebhook = async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const secret = config.razorpayWebhookSecret;

    // 1. Verify Signature using raw body buffer
    if (!signature || !secret || !req.rawBody) {
        logger.warn('Razorpay Webhook: Missing signature or rawBody buffer.');
        return res.status(400).send('Invalid signature');
    }

    const expected = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('hex');

    if (expected !== signature) {
        logger.warn('Razorpay Webhook: Signature verification failed.');
        return res.status(400).send('Invalid signature');
    }

    const { event, payload } = req.body;
    logger.info(`Razorpay Webhook Received: ${event}`);

    try {
        // --- 🟢 Handle Payment Captured (Success) ---
        if (event === 'payment.captured' || event === 'payment_link.paid' || event === 'payment_link.captured') {
            const isPaymentLink = event.startsWith('payment_link');
            const entity = isPaymentLink ? payload.payment_link.entity : payload.payment.entity;
            
            let order = null;
            let rzPaymentId = isPaymentLink ? (payload.payment?.entity?.id || null) : entity.id;

            if (isPaymentLink) {
                const paymentLinkId = entity.id;
                // Find order via FoodTransaction ledger
                const tx = await FoodTransaction.findOne({ "payment.qr.paymentLinkId": paymentLinkId }).lean();
                if (tx && tx.orderId) {
                    order = await FoodOrder.findOneAndUpdate(
                        { _id: tx.orderId, "payment.status": { $ne: 'paid' } },
                        { $set: { "payment.status": 'paid', "payment.method": 'razorpay_qr', "payment.razorpay.paymentId": rzPaymentId } },
                        { new: true }
                    );
                }
            } else {
                const rzOrderId = entity.order_id;
                // Atomic update to mark as paid if not already
                order = await FoodOrder.findOneAndUpdate(
                    { 
                        "payment.razorpay.orderId": rzOrderId, 
                        "payment.status": { $ne: 'paid' } 
                    },
                    { 
                        $set: { 
                            "payment.status": 'paid', 
                            "payment.razorpay.paymentId": rzPaymentId 
                        } 
                    },
                    { new: true }
                );
            }

            if (order) {
                try {
                    await foodTransactionService.updateTransactionStatus(order._id, 'captured', {
                        status: 'captured',
                        razorpayPaymentId: rzPaymentId,
                        note: `Payment status synced via Webhook (${event})`
                    });
                } catch (ledgerErr) {
                    logger.error(`Webhook Ledger Error (Order ${order.orderId}): ${ledgerErr.message}`);
                }
                
                // NOTIFY RESTAURANT: So their panel buzzes in real-time
                void notifyRestaurantNewOrder(order).catch(err => {
                    logger.error(`Webhook Notification Error (Order ${order.orderId}): ${err.message}`);
                });

                logger.info(`Webhook [${event}]: Synced Order ${order.orderId} (Status=paid)`);
            } else {
                logger.warn(`Webhook [${event}]: Order not found or already paid for entity: ${entity.id}`);
            }
        }

        // --- 🔴 Handle Refund Processed ---
        if (event === 'refund.processed') {
            const refundObj = payload.refund.entity;
            const rzPaymentId = refundObj.payment_id;
            const rzRefundId = refundObj.id;
            const refundAmount = refundObj.amount / 100; // to major unit

            // Sync refund fields in the order
            const order = await FoodOrder.findOneAndUpdate(
                { 
                    "payment.razorpay.paymentId": rzPaymentId,
                    "payment.refund.status": { $ne: 'processed' }
                },
                { 
                    $set: { 
                        "payment.status": 'refunded',
                        "payment.refund": {
                            status: 'processed',
                            amount: refundAmount,
                            refundId: rzRefundId,
                            processedAt: new Date()
                        }
                    } 
                },
                { new: true }
            );

            if (order) {
                logger.info(`Webhook [refund.processed]: Synced Order ${order.orderId} (Refunded)`);
            } else {
                // ✅ ADDED: Log warn if order not found for refund
                logger.warn(`Webhook [refund.processed]: Order not found or already refunded for RZ-Payment: ${rzPaymentId}`);
            }
        }

        res.status(200).json({ status: 'ok' });
    } catch (err) {
        logger.error(`Razorpay Webhook Logic Error: ${err.message}`);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
