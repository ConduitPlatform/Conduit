export interface IPaymentProvider {
  createPayment(
    currency: string,
    unitAmount: number
  ): Promise<any>;
}
