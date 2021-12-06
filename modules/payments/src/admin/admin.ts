import ConduitGrpcSdk, {
  GrpcServer,
  constructConduitRoute,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  RouteOptionType,
  ConduitString,
  ConduitNumber,
  ConduitBoolean,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { StripeHandlers } from '../handlers/stripe';
import { populateArray } from '../utils/populateArray';
import {
  Product,
  PaymentsCustomer,
  Transaction,
  Subscription,
  User,
} from '../models';

const escapeStringRegexp = require('escape-string-regexp');

export class AdminHandlers {

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly stripeHandlers: StripeHandlers | null
  ) {
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getProducts: this.getProducts.bind(this),
        createProduct: this.createProduct.bind(this),
        editProduct: this.editProduct.bind(this),
        getCustomers: this.getCustomers.bind(this),
        createCustomer: this.createCustomer.bind(this),
        getTransactions: this.getTransactions.bind(this),
        getSubscriptions: this.getSubscriptions.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  private getRegisteredRoutes(): any[] {
    return [
      constructConduitRoute(
        {
          path: '/products',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetProducts', {
          productDocuments: [Product.getInstance().fields],
          totalCount: ConduitNumber.Required,
        }),
        'getProducts'
      ),
      constructConduitRoute(
        {
          path: '/products',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: ConduitString.Required,
            currency: ConduitString.Required,
            value: ConduitNumber.Required,
            isSubscription: ConduitBoolean.Optional,
            recurring: ConduitString.Required,
            recurringCount: ConduitNumber.Required,
          },
        },
        new ConduitRouteReturnDefinition('CreateProduct', Product.getInstance().fields),
        'createProduct'
      ),
      constructConduitRoute(
        {
          path: '/products/:id',
          action: ConduitRouteActions.UPDATE, // works as PATCH (frontend compat)
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          bodyParams: {
            name: ConduitString.Required,
            currency: ConduitString.Required,
            value: ConduitNumber.Required,
            isSubscription: ConduitBoolean.Optional,
            recurring: ConduitString.Required,
            recurringCount: ConduitNumber.Required,
            stripe: {
              subscriptionId: ConduitString.Required,
              priceId: ConduitString.Required,
            },
          },
        },
        new ConduitRouteReturnDefinition('EditProduct', {
          updatedProduct: Product.getInstance().fields,
        }),
        'editProduct'
      ),
      constructConduitRoute(
        {
          path: '/customer',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetCustomers', {
          customerDocuments: [PaymentsCustomer.getInstance().fields],
          totalCount: ConduitNumber.Required,
        }),
        'getCustomers'
      ),
      constructConduitRoute(
        {
          path: '/customer',
          action: ConduitRouteActions.POST,
          bodyParams: {
            userId: ConduitString.Required,
            email: ConduitString.Required,
            phoneNumber: ConduitString.Required,
            buyerName: ConduitString.Optional,
            address: ConduitString.Optional,
            postCode: ConduitString.Optional,
            stripe: {
                customerId: ConduitString.Optional,
            },
          },
        },
        new ConduitRouteReturnDefinition('CreateCustomer', PaymentsCustomer.getInstance().fields),
        'createCustomer'
      ),
      constructConduitRoute(
        {
          path: '/transactions',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetTransactions', {
          transactionDocuments: [Transaction.getInstance().fields],
          totalCount: ConduitNumber.Required,
        }),
        'getTransactions'
      ),
      constructConduitRoute(
        {
          path: '/subscriptions',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            search: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetSubscriptions', {
          subscriptionDocuments: [Subscription.getInstance().fields],
          totalCount: ConduitNumber.Required,
        }),
        'getSubscriptions'
      ),
    ];
  }

  async getProducts(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query:any = {};
    let identifier;
    if (!isNil(call.request.params.search)) {
      identifier = escapeStringRegexp(call.request.params.search);
      query['name'] = { $regex: `.*${identifier}.*`, $options:'i'};
    }
    const productDocumentsPromise = Product.getInstance()
      .findMany(
        query,
        undefined,
        skip,
        limit,
      );
    const totalCountPromise = Product.getInstance().countDocuments(query);

    const [productDocuments, totalCount] = await Promise.all([
      productDocumentsPromise,
      totalCountPromise,
    ]).catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    return { productDocuments, totalCount };
  }

  async createProduct(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let productDoc: any = {
      name: call.request.params.name,
      currency: call.request.params.currency,
      value: call.request.params.value,
      recurring: call.request.params.recurring,
      recurringCount: call.request.params.recurringCount,
      isSubscription: call.request.params.isSubscription,
    };

    if (call.request.params.isSubscription) {
      if (isNil(call.request.params.recurring)) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'recurring is required for subscription products');
      }
      if (!['day', 'week', 'month', 'year'].includes(call.request.params.recurring)) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'recurring must be one of [day, week, month, year]');
      }
      if (!isNil(this.stripeHandlers)) {
        try {
          const res = await this.stripeHandlers.createSubscriptionProduct(
            productDoc.name,
            productDoc.currency,
            productDoc.value,
            productDoc.recurring,
            productDoc.recurringCount
          );
          productDoc.stripe = {};
          productDoc.stripe.subscriptionId = res.subscriptionId;
          productDoc.stripe.priceId = res.priceId;
        } catch (e) {
          throw new GrpcError(status.INTERNAL, e.message);
        }
      }
    }

    const product = await Product.getInstance()
      .create(productDoc)
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    this.grpcSdk.bus?.publish('payments:create:Product', JSON.stringify(productDoc));

    return product;
  }

  async editProduct(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const productDocument = await Product.getInstance().findOne({ _id: call.request.params.id });
    if (isNil(productDocument)) {
      throw new GrpcError(status.NOT_FOUND, 'Product does not exist');
    }
    ['name', 'value', 'currency', 'isSubscription', 'recurring', 'recurringCount', 'stripe'].forEach((key) => {
      if (call.request.params[key]) {
        // @ts-ignore
        productDocument[key] = call.request.params[key];
      }
    });
    const updatedProduct = await Product.getInstance()
      .findByIdAndUpdate(call.request.params.id, productDocument)
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    return { result: { updatedProduct } };
  }

  async getCustomers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query:any = {};
    let identifier;
    if (!isNil(call.request.params.search)) {
      identifier = escapeStringRegexp(call.request.params.search);
      query['email'] = { $regex: `.*${identifier}.*`, $options:'i'};
    }
    const customerDocumentsPromise = PaymentsCustomer.getInstance()
      .findMany(
        query,
        undefined,
        skip,
        limit,
      );
    const totalCountPromise = PaymentsCustomer.getInstance().countDocuments(query);
    const [customerDocuments, totalCount] = await Promise.all([
      customerDocumentsPromise,
      totalCountPromise,
    ]).catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    return { customerDocuments, totalCount };
  }

  async createCustomer(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const user = await User.getInstance().findOne({ _id: call.request.params.userId })
    if (isNil(user)) {
      throw new GrpcError(status.NOT_FOUND, 'User does not exist');
    }
    let customerDoc = {
      userId: call.request.params.userId,
      email: call.request.params.email,
      phoneNumber: call.request.params.phoneNumber,
      buyerName: call.request.params.buyerName,
      address: call.request.params.address,
      postCode: call.request.params.postCode,
      stripe: call.request.params.stripe,
    };
    const customerExists = await PaymentsCustomer.getInstance()
      .findOne({ userId: call.request.params.userId });
    if (!isNil(customerExists)) {
      throw new GrpcError(status.ALREADY_EXISTS, 'Customer already exists');
    }
    return await PaymentsCustomer.getInstance()
      .create(customerDoc)
      .catch((e) => { throw new GrpcError(status.INTERNAL, e.message); });
  }

  async getTransactions(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query:any = {};
    if (!isNil(call.request.params.customerId)) {
      query['customerId'] = call.request.params.customerId;
    }
    if (!isNil(call.request.params.productId)) {
      query['product'] = call.request.params.productId;
    }
    const transactionDocumentsPromise = Transaction.getInstance()
      .findMany(
        query,
        undefined,
        skip,
        limit,
      );
    const totalCountPromise = Transaction.getInstance().countDocuments(query);

    const [transactionDocuments, totalCount] = await Promise.all([
      transactionDocumentsPromise,
      totalCountPromise,
    ]).catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    return { transactionDocuments, totalCount };
  }

  async getSubscriptions(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query:any = {}, populates;
    if (!isNil(call.request.params.populate)) {
      populates = populateArray(call.request.params.populate);
    }
    const subscriptionDocumentsPromise = Subscription.getInstance()
      .findMany(
        query,
        undefined,
        skip,
        limit,
        undefined,
        populates
      );
    const totalCountPromise = Subscription.getInstance().countDocuments(query);

    const [subscriptionDocuments, totalCount] = await Promise.all([
      subscriptionDocumentsPromise,
      totalCountPromise,
    ]).catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    return { subscriptionDocuments, totalCount };
  }
}
