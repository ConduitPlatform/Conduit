import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { constructSortObj, getProductEmailTextRejection } from '../utils';

import { utils, WorkBook, WorkSheet, write } from 'xlsx';

export class Stuff {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async reviewOrder(call: any, callback: any) {
    let user = JSON.parse(call.request.context).user;
    let params = JSON.parse(call.request.params);
    try {
      let supplier = await this.grpcSdk.databaseProvider!.findOne('suppliers', {
        user: user._id,
      });
      if (!supplier) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'Not a supplier',
        });
      }

      let order = await this.grpcSdk.databaseProvider!.findOne(
        'orders',
        {
          _id: params.id,
          status: 'PENDING',
          supplier: supplier._id,
        },
        undefined,
        ['store', 'buyer', 'buyer.user', 'supplier', 'supplier.user']
      );
      if (!order) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'Order not found',
        });
      }

      if (
        params.accepted === false ||
        (params.accepted === true &&
          params.rejectedProducts &&
          params.rejectedProducts.length === order.products.length)
      ) {
        order.status = 'REJECTED';
        await this.grpcSdk.databaseProvider!.findByIdAndUpdate(
          'orders',
          params.id,
          order
        );
        await this.grpcSdk.emailProvider!.sendEmail('REJECTION_TEMPLATE', {
          sender: 'orders-no-reply',
          variables: {
            storeName: order.store.name,
            orderNumber: order.orderNumber,
          },
          replyTo: order.supplier.user.email,
          cc: ['info@agoraorder.com', order.supplier.user.email],
          email: order.buyer.user.email,
        });

        return callback(null, { result: 'OK' });
      } else if (
        params.accepted === true &&
        params.rejectedProducts &&
        params.rejectedProducts.length > 0
      ) {
        order.status = 'ACCEPTED';
        let rejections: any[] = [];
        //@ts-ignore
        params.rejectedProducts.forEach((product: string) => {
          let index = (order.products as any[]).findIndex((orderProduct) => {
            return orderProduct._id === product;
          });
          if (index !== -1) {
            order.products[index].rejected = true;
            rejections.push(order.products[index]);
          }
        });
        rejections.forEach((rejection) => {
          order.cost -= rejection.price;
        });
        await this.grpcSdk.databaseProvider!.findByIdAndUpdate(
          'orders',
          params.id,
          order
        );
        await this.grpcSdk.emailProvider!.sendEmail('PARTIAL_REJECT_TEMPLATE', {
          sender: 'orders-no-reply',
          replyTo: order.supplier.user.email,
          variables: {
            storeName: order.store.name,
            orderNumber: order.orderNumber,
            orderProducts: getProductEmailTextRejection(rejections),
          },
          cc: ['info@agoraorder.com', order.supplier.user.email],
          email: order.buyer.user.email,
        });
        // partial acceptance flow
        return callback(null, { result: 'OK' });
      }
      // full acceptance flow
      order.status = 'ACCEPTED';
      await this.grpcSdk.databaseProvider!.findByIdAndUpdate('orders', params.id, order);
      return callback(null, { result: 'OK' });
    } catch (e) {
      return callback({ code: grpc.status.INTERNAL, message: e.message });
    }
  }

  async myOrdersSupplier(call: any, callback: any) {
    let user = JSON.parse(call.request.context).user;
    let params = JSON.parse(call.request.params);
    let sortObj: any = null;
    if (params.sort && params.sort.length > 0) {
      sortObj = constructSortObj(params.sort);
    }
    try {
      let supplier = await this.grpcSdk.databaseProvider!.findOne('suppliers', {
        user: user._id,
      });
      if (!supplier) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'Not a supplier',
        });
      }
      let query: any = { supplier: supplier._id };
      if (params.orderStatus && params.orderStatus.length !== 0) {
        query['status'] = { $in: params.orderStatus };
      }
      if (params.searchText && params.searchText.length !== 0) {
        let ordersByNum = (await this.grpcSdk.databaseProvider!.findMany('orders', {
          orderNumber: {
            $regex: `.*${params.searchText}.*`,
            $options: 'i',
          },
        })) as any[];
        let query2 = {
          $or: [
            {
              name: {
                $regex: `.*${params.searchText}.*`,
                $options: 'i',
              },
            },
            {
              taxReferenceNumber: {
                $regex: `.*${params.searchText}.*`,
                $options: 'i',
              },
            },
          ],
        };
        let stores = (await this.grpcSdk.databaseProvider!.findMany(
          'stores',
          query2
        )) as any[];
        if (stores && stores.length > 0) {
          if (ordersByNum && ordersByNum.length > 0) {
            query['$or'] = [
              { store: { $in: stores.map((store) => store._id) } },
              { _id: { $in: ordersByNum.map((orderByNum) => orderByNum._id) } },
            ];
          } else {
            query['store'] = { $in: stores.map((store) => store._id) };
          }
        } else {
          query['_id'] = {
            $in: ordersByNum.map((orderByNum) => orderByNum._id),
          };
        }
      }
      let orders = await this.grpcSdk.databaseProvider!.findMany(
        'orders',
        query,
        undefined,
        params['skip'],
        params['limit'],
        sortObj,
        params['populate']
      );
      const countPromise = await this.grpcSdk.databaseProvider!.countDocuments(
        'orders',
        query
      );
      callback(null, {
        result: JSON.stringify({
          documents: orders,
          documentsCount: countPromise,
        }),
      });
    } catch (e) {
      return callback({ code: grpc.status.INTERNAL, message: e.message });
    }
  }

  async getSupplierCustomers(call: any, callback: any) {
    let user = JSON.parse(call.request.context).user;
    let params = JSON.parse(call.request.params);
    let sortObj: any = null;
    if (params.sort && params.sort.length > 0) {
      sortObj = constructSortObj(params.sort);
    }
    try {
      let supplier = await this.grpcSdk.databaseProvider!.findOne('suppliers', {
        user: user._id,
      });
      if (!supplier) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'Not a supplier',
        });
      }
      let query: any = { suppliers: { $in: supplier._id } };
      if (params.searchText && params.searchText.length !== 0) {
        query['$or'] = [
          {
            name: {
              $regex: `.*${params.searchText}.*`,
              $options: 'i',
            },
          },
          {
            taxReferenceNumber: {
              $regex: `.*${params.searchText}.*`,
              $options: 'i',
            },
          },
        ];
      }

      let stores = (await this.grpcSdk.databaseProvider!.findMany(
        'stores',
        query,
        undefined,
        params.skip,
        params.limit,
        sortObj,
        params.populate
      )) as any[];

      const countPromise = await this.grpcSdk.databaseProvider!.countDocuments(
        'stores',
        query
      );

      if (!stores || stores.length === 0) {
        return callback(null, {
          result: JSON.stringify({
            documents: [],
            documentsCount: countPromise,
          }),
        });
      }

      callback(null, {
        result: JSON.stringify({
          documents: stores,
          documentsCount: countPromise,
        }),
      });
    } catch (e) {
      return callback({ code: grpc.status.INTERNAL, message: e.message });
    }
  }

  async getSupplierCustomersXLSX(call: any, callback: any) {
    let user = JSON.parse(call.request.context).user;
    try {
      let supplier = await this.grpcSdk.databaseProvider!.findOne('suppliers', {
        user: user._id,
      });
      if (!supplier) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'Not a supplier',
        });
      }

      let stores = (await this.grpcSdk.databaseProvider!.findMany('stores', {
        suppliers: { $in: supplier._id },
      })) as any[];
      stores.forEach((store) => {
        delete store.suppliers;
      });
      let workbook: WorkBook = utils.book_new();

      let sheet: WorkSheet = utils.json_to_sheet(stores, {
        header: Object.keys(stores[0]).map((key) => key),
      });
      utils.book_append_sheet(workbook, sheet, 'customers');
      let xlsxString = write(workbook, { type: 'base64' });
      callback(null, { result: xlsxString });
    } catch (e) {
      return callback({ code: grpc.status.INTERNAL, message: e.message });
    }
  }

  async deleteSupplierCustomer(call: any, callback: any) {
    let user = JSON.parse(call.request.context).user;
    let params = JSON.parse(call.request.params);
    try {
      let supplier = await this.grpcSdk.databaseProvider!.findOne('suppliers', {
        user: user._id,
      });
      if (!supplier) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'Not a supplier',
        });
      }

      let stores = (await this.grpcSdk.databaseProvider!.findMany('stores', {
        suppliers: { $in: supplier._id },
        _id: { $in: params.ids },
      })) as any[];
      if (!stores || stores.length === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'Customer not found',
        });
      }
      for (let i = 0; i < stores.length; i++) {
        (stores[i].suppliers as any[]).splice(
          stores[i].suppliers.indexOf(supplier._id),
          1
        );
        await this.grpcSdk.databaseProvider!.findByIdAndUpdate(
          'stores',
          stores[i]._id,
          stores[i]
        );
      }

      callback(null, { result: 'OK' });
    } catch (e) {
      return callback({ code: grpc.status.INTERNAL, message: e.message });
    }
  }
}
