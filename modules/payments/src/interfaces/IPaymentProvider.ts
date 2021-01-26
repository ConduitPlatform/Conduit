export interface IPaymentProvider {
  createPayment(
    productName: string,
    currency: string,
    unitAmount: number
  ): Promise<any>;
}
