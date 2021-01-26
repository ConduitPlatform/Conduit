export interface IPaymentProvider {
  createPayment(
    productName: string,
    currency: string,
    unitAmount: number
  ): Promise<any>;

  cancelPayment(paymentId: string): Promise<boolean>;

  refundPayment(paymentId: string): Promise<boolean>;
}