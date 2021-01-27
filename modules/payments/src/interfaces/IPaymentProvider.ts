export interface IPaymentProvider {
  createPayment(
    productName: string,
    currency: string,
    unitAmount: number,
    userId?: string
  ): Promise<any>;

  cancelPayment(paymentId: string, userId?: string): Promise<boolean>;

  refundPayment(paymentId: string, userId?: string): Promise<boolean>;
}