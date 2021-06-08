import _ from 'lodash';
import { CYCLE } from '../../constants';

/* @ngInject */
function Payment($http, authentication, url, brick, paymentPlansFormator) {
    const requestUrl = url.build('payments');
    const getPayment = (params = {}) => {
        if (params.Payment) {
            return params.Payment;
        }

        if (params.PaymentMethod) {
            return params.PaymentMethod;
        }

        return params;
    };

    const response = (promise) => promise.then(({ data }) => data);

    function generateFingerprint(params = {}) {
        const paymentMethodID = params.PaymentMethodID;
        // Faster accessor for the Object. We need to update the ref
        const payment = getPayment(params);

        return new Promise((resolve, reject) => {
            try {
                if (typeof paymentMethodID === 'undefined' && payment.Type === 'card') {
                    return brick.getFingerprint((fingerprint) => {
                        payment.Fingerprint = fingerprint;
                        resolve(params);
                    });
                }

                resolve(params);
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Credit account
     * @param {Object} params
     */
    const credit = (params) => {
        return generateFingerprint(params).then((params) => $http.post(requestUrl('credit'), params));
    };

    /**
     * Validate Credit
     * @param  {Object} params
     * Credit: 100, // optional if GiftCode present
     * Currency: "USD", // optional if GiftCode present
     * GiftCode: "ABCDEFHJMNPQRSTV" // optional
     */
    const validateCredit = (params) => $http.post(requestUrl('credit', 'check'), params);

    /**
     * Validate Verify
     * @param  {Object} params
     * Username: "mickeymouse",
     * Credit: 100, // optional if GiftCode present
     * Currency: "USD", // optional if GiftCode present
     * GiftCode : "ABCDEFHJMNPQRSTV" // optional
     */
    const validateVerify = (params) => $http.post(requestUrl('verify', 'check'), params);

    /**
     * Donate for perks. Does not require authentication.
     * @param {Object} params
     */
    const donate = (params) => {
        return generateFingerprint(params).then((params) => $http.post(requestUrl('donate'), params));
    };

    /**
     * Cancel given subscription.
     * @param {Object} Obj
     */
    const unsubscribe = (opt) => $http.post(requestUrl('unsubscribe'), opt);

    /**
     * Create Paypal Payment
     * @param {Object} params
     * @param {Object} config
     * @return {Promise}
     */
    const paypal = (opt, config = {}) => $http.post(requestUrl('paypal'), opt, config);

    /**
     * Send payment details to subscribe during the signup process
     * @param {Object} params
     * @param {Promise}
     */
    const verify = (params) => {
        return generateFingerprint(params)
            .then((params) => $http.post(requestUrl('verify'), params))
            .then(({ data = {} } = {}) => data);
    };

    /**
     * Get payment method status
     * @return {Promise}
     */
    const status = () => $http.get(requestUrl('status'));

    /**
     * Get invoices in reverse time order
     * @param {Object} params
     * @return {Promise}
     */
    const invoices = (params) => {
        return response($http.get(requestUrl('invoices'), { params }));
    };

    /**
     * Get an invoice as pdf
     * @param {String} id ID of the Invoice
     */
    const invoice = (id) => {
        return response($http.get(requestUrl('invoices', id), { responseType: 'arraybuffer' }));
    };

    /**
     * Return information to pay invoice unpaid
     */
    const check = (id) => $http.post(requestUrl('invoices', id, 'check'));

    /**
     * Pay an unpaid invoice
     * @param {String} id
     * @param {Object} params
     * @return {Promise}
     */
    const pay = (id, params) => {
        return generateFingerprint(params).then((params) => $http.post(requestUrl('invoices', id), params));
    };

    /**
     * Get plans available to user
     * @param {Object} params
     * @return {Promise<Array>}
     */
    const plans = ({ Cycle = CYCLE.MONTHLY, Currency } = {}) => {
        return $http
            .get(requestUrl('plans'), { params: { Cycle, Currency } })
            .then(({ data: { Plans = [] } = {} }) => Plans)
            .then(paymentPlansFormator);
    };

    /**
     * Get current subscription
     * @return {Promise}
     */
    const subscription = () => {
        if (authentication.user.Role > 1) {
            return $http.get(requestUrl('subscription')).then(({ data = {} } = {}) => {
                const { Name, Title } = _.find(data.Subscription.Plans, { Type: 1 }) || {};

                data.Subscription.Name = Name;
                data.Subscription.Title = Title;

                return data;
            });
        }
        const sub = {
            Name: 'free',
            Title: 'ProtonMail Free',
            MaxDomains: 0,
            CouponCode: null,
            MaxAddresses: 1,
            MaxSpace: 5368709120, // 500 MB
            MaxMembers: 1,
            Cycle: 12,
            Currency: authentication.user.Currency
        };
        return Promise.resolve({
            data: {
                Code: 1000,
                Subscription: sub
            }
        });
    };

    const latestSubscription = () => response($http.get(requestUrl('subscription', 'latest')));

    /**
     * Validate a subscription
     */
    const valid = (opt) => $http.post(requestUrl('subscription', 'check'), opt).then(({ data = {} }) => data);

    const updateMethod = (params, config) => {
        return generateFingerprint(params).then((params) => $http.post(requestUrl('methods'), params, config));
    };

    const deleteMethod = (id) => $http.delete(requestUrl('methods', id));

    /**
     * Get payment methods in priority order
     */
    const methods = () => $http.get(requestUrl('methods'));

    /**
     * First will be charged for subscriptions
     */
    const order = (opt) => $http.put(requestUrl('methods', 'order'), opt);

    /**
     * Create a subscription
     */
    const subscribe = (params) => {
        return generateFingerprint(params).then((params) => $http.post(requestUrl('subscription'), params));
    };

    /**
     * Delete current subscription, locked
     */
    const destroy = () => $http.delete(requestUrl('subscription'));

    const btc = (Amount, Currency) => $http.post(requestUrl('bcinfo'), { Amount, Currency });

    const createToken = (data) => response($http.post(requestUrl('tokens'), data));
    const getTokenStatus = (paymentToken) => response($http.get(requestUrl('tokens', paymentToken)));
    const forceTokenUpdate = (paymentToken) => response($http.put(requestUrl('tokens', paymentToken)));

    return {
        createToken,
        getTokenStatus,
        forceTokenUpdate,
        credit,
        donate,
        paypal,
        validateCredit,
        validateVerify,
        invoices,
        invoice,
        order,
        verify,
        status,
        check,
        pay,
        valid,
        plans,
        subscription,
        updateMethod,
        deleteMethod,
        methods,
        subscribe,
        unsubscribe,
        delete: destroy,
        btc,
        latestSubscription
    };
}
export default Payment;
