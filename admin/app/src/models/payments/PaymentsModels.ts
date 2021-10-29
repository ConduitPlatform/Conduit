export interface Customer {
  _id?: string;
  userId: string;
  email: string;
  buyerName: string;
  phoneNumber: string;
  address: string;
  postCode: string;
  stripe: {
    customerId: string;
  };
  updatedAt?: string;
  createdAt?: string;
}

export interface Product {
  _id?: string;
  name: string;
  value: number;
  currency: string;
  isSubscription: boolean;
  recurring: 'day' | 'week' | 'month' | 'year' | any;
  recurringCount: number;
  stripe?: {
    subscriptionId: string;
    priceId: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  _id?: string;
  userId: string;
  provider: string;
  product: string;
  quantity: number;
  data: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subscription {
  _id?: string;
  product: string;
  userId: string;
  customerId: string;
  iamport: {
    nextPaymentId: string;
  };
  activeUntil: string;
  transactions: any;
  provider: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentSettings {
  active: boolean;
  stripe: {
    enabled: boolean;
    secret_key: string;
  };
}
