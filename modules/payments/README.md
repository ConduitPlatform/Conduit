---
name: Payments
route: /payments
menu: Modules
---

# Payments adapter
This will provide a consistent payments mechanism

# Admin

## Create Product

| route                   |  method  |
| :---------------------: | :------: |
| /admin/payments/products| POST     |

### Body parameters
- Required
    - name (string)
    - value (int)
    - currency (string): E.g. "USD", "EUR", "KRW". Note that iamport provider will accept only products with "KRW" currency.
- Optional
  - isSubscription (boolean)
  - recurring (string): Required when isSubscription is set to true. Valid values are "day", "week", "month", "year".
  - recurringCount (int): Defaults to 1. The number of intervals (specified in the recurring attribute) between subscription billings. For example, recurring=month and interval_count=3 bills every 3 months.

### Returns
The created product.

Example:

```json
{
  "_id": "string",
  "name": "string",
  "value": "number",
  "currency": "string",
  "isSubscription": "boolean",
  "recurring": "string",
  "recurringCount": "number"
}
```

# Common

## Get Products

| route              |  method  | requires authentication   |
| :----------------: | :------: | :-----------------------: |
| /payments/products | GET      | false                     |

### Returns
A list of products.

Example:

```json
{
  "products": [
    {
      "_id": "string",
      "name": "string",
      "value": "number",
      "currency": "string",
      "isSubscription": "boolean",
      "recurring": "string",
      "recurringCount": "number"
    }
  ]
}
```

## Get Subscriptions

| route                   |  method  | requires authentication   |
| :---------------------: | :------: | :-----------------------: |
| /payments/subscriptions | GET      | true                      |

### Returns
A list of active subscriptions the requesting user has.

Example: 

```json
{
  "subscriptions": [
    {
      "_id": "string",
      "userId": "string",
      "customerId": "string",
      "product": {
        "_id": "string",
        "name": "string",
        "value": "int",
        "currency": "string",
        "isSubscription": "boolean",
        "recurring": "string",
        "recurringCount": "int"
      },
      "iamport": {
        "nextPaymentId": "string"
      },
      "activeUntil": "date formatted to string",
      "provider": "string"
    }
  ]
}
```

# Stripe

These routes will be available ony if stripe handler is enabled.

## Create Payment

| route                          |  method  | requires authentication   |
| :----------------------------: | :------: | :-----------------------: |
| /payments/stripe/createPayment | POST     | false                     |

### Body parameters

- Required
  - productId (string)
- Optional
  - userId (string)
  - saveCard (boolean): If true the card the user will use to pay can be used again without prompting.
  
### Returns

- clientSecret. Use this in the front end to open the stripe dialog for the user's card information
- paymentId

## Create Payment With Saved Card

| route                                       |  method  | requires authentication   |
| :-----------------------------------------: | :------: | :-----------------------: |
| /payments/stripe/createPaymentWithSavedCard | POST     | true                      |

### Body parameters

- Required
  - productId (string)
  - cardId (string): See [Get Payment Methods](#get-payment-methods)
  
### Returns

- clientSecret
- paymentId (if the payment was successful)
- paymentMethod (if the payment failed and authentication is required)

## Cancel Payment

| route                          |  method  | requires authentication   |
| :----------------------------: | :------: | :-----------------------: |
| /payments/stripe/cancelPayment | PUT      | false                     |

You can cancel a PaymentIntent if you no longer intend to use it to collect payment from the customer. Canceling a 
PaymentIntent is optional, and it’s okay to keep a PaymentIntent in an incomplete status like requires_confirmation or requires_payment_method.

### Body parameters

- Required
  - paymentId (string)
- Optional
  - userId (string)

## Refund Payment

| route                          |  method  | requires authentication   |
| :----------------------------: | :------: | :-----------------------: |
| /payments/stripe/refundPayment | PUT      | false                     |

### Body parameters

- Required
  - paymentId (string)
- Optional
  - userId (string)

## Get Payment Methods

| route                              |  method  | requires authentication   |
| :--------------------------------: | :------: | :-----------------------: |
| /payments/stripe/getPaymentMethods | GET      | true                      |

### Returns

A list of the payment methods the requesting user has for transactions with stripe.

Example:

```json
{
  "paymentMethods": {
    "data": [
      {
        "id": "string, this will be used to create payment with saved card",
        "billing_details": {
          "address": {
            "city": "string",
            "country": "string",
            "line1": "string",
            "line2": "string",
            "postal_code": "string",
            "state": "string"
          },
          "email": "string",
          "name": "string",
          "phone": "string"
        },
        "card": {
          "brand": "string e.g. 'visa'",
          "checks": {
            "address_line1_check": "string",
            "address_postal_code_check": "string",
            "cvc_check": "string"
          },
          "country": "string",
          "exp_month": "number",
          "exp_year": "number",
          "fingerprint": "string",
          "funding": "string",
          "generated_from": "string",
          "last4": "string",
          "networks": {
            "available": [
              "string"
            ],
            "preferred": "boolean"
          },
          "three_d_secure_usage": {
            "supported": "boolean"
          },
          "wallet": "string"
        },
        "created": "timestamp",
        "customer": "string",
        "livemode": "boolean",
        "metadata": {},
        "type": "string"
      }
    ],
    "has_more": "boolean"
  }
}
```

## Complete Payment

| route                                 |  method  | requires authentication   |
| :-----------------------------------: | :------: | :-----------------------: |
| /hook/payments/stripe/completePayment | POST     | false                     |

Add this route to stripe dashboard to save transactions events to database.

# I'mport

These routes will be available ony if iamport handler is enabled.

## Create Payment

| route                           |  method  | requires authentication |
| :-----------------------------: | :------: | :---------------------: |
| /payments/iamport/createPayment | POST     | false                   |

### Body parameters

- Required
    - productId
- Optional
    - quantity: How many products the user wants to buy. Defaults to 1.
    - userId

### Returns

- merchant_uid. Use this in the front end to open the I'mport payment window.
- amount. The amount the user must pay, If the amount passed to the payment window doesn't match this amount the windows will not open.

## Complete Payment

| route                             |  method  | requires authentication |
| :-------------------------------: | :------: | :---------------------: |
| /payments/iamport/completePayment | POST     | false                   |

Call this route in the IMP.request_pay callback function to check if the payment was paid in full and save the transaction to database.

### Body parameters

- Required
  - imp_uid
  - merchant_uid
  
## Add Card

| route                     |  method  | requires authentication |
| :-----------------------: | :------: | :---------------------: |
| /payments/iamport/addCard | POST     | true                    |

This route will create a customer and prepare a payment for 0 KRW (South Korean won) in order for a billing key to be issued.
After the payment is completed successfully, call [Validate Card](#validate-card) to mark the customer's card as verified.
Note that the card is not stored in the database, instead the customer id will be used in the future as the payment method.

### Body parameters

- Required
  - email (string)
  - buyerName (string)
  - phoneNumber (string)
  - address (string)
  - postCode (string

### Returns

- customerId. This corresponds to the customers card (billing key).
- merchant_uid

## Validate Card

| route                                      |  method  | requires authentication |
| :----------------------------------------: | :------: | :---------------------: |
| /payments/iamport/validateCard/:customerId | POST     | true                    |

### URL parameters

- customerId. This corresponds to the users card and will be used as the payment method.

## Subscribe

| route                       |  method  | requires authentication |
| :-------------------------: | :------: | :---------------------: |
| /payments/iamport/subscribe | POST     | true                    |

This route will subscribe a user to product, the user must have a registered card. The user's card will be charged the product's value,
and a new payment will be registered for the date the subscription ends. Note that the product must have "KRW" currency.

### Body parameters

- Required
  - productId (string)
  - customerId (string): This corresponds to the payment method to be used. A user can have multiple customer documents
    associated with him, one for each payment method he has.

### Returns

A subscription object.

Example:

```json
{
  "_id": "string",
  "productId": "string",
  "userId": "string",
  "customerId": "string",
  "iamport": {
    "nextPaymentId": "string"
  },
  "activeUntil": "date",
  "transactions": "string[]",
  "provider": "string"
}
```

## Subscription Callback

| route                                       |  method  | requires authentication |
| :-----------------------------------------: | :------: | :---------------------: |
| /hook/payments/iamport/subscriptionCallback | POST     | false                   |

This route is called by I'mport when a scheduled payment is completed, if the payment was successful a new payment is scheduled
for the date the subscription ends.

### Body parameters
- Required
  - imp_uid (string)
  - merchant_uid (string)

## Cancel Subscription

| route                                                |  method  | requires authentication |
| :--------------------------------------------------: | :------: | :---------------------: |
| /payments/iamport/cancelSubscription/:subscriptionId | PUT      | true                    |

### Url parameters
- subscriptionId (string)

## Get Payment Methods

| route                               |  method  | requires authentication |
| :---------------------------------: | :------: | :---------------------: |
| /payments/iamport/getPaymentMethods | GET      | true                    |

### Returns

A list of customer documents the user is associated with. Use the `_id` field when subscribing to a product.

Example:

```json
{
  "paymentMethods": [
    {
      "_id": "string",
      "iamport": {
        "isCardVerified": "boolean, this will always be true, because the route returns only validated cards"
      },
      "userId": "string",
      "email": "string",
      "buyerName": "string",
      "phoneNumber": "string",
      "address": "string",
      "postCode": "string"
    }
  ]
}
```
