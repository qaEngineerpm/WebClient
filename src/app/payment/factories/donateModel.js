/* @ngInject */
function donateModel(Payment, networkActivityTracker, gettextCatalog, notification, dispatchers, translator) {
    const I18N = translator(() => ({
         donation: {
            success: gettextCatalog.getString(
                'Your support is essential to keeping ProtonMail running. Thank you for supporting internet privacy!',
                null,
                'Donation modal'
            )
        },
        topUp: {
            success: gettextCatalog.getString('Credits added', null, 'topUp modal')
        }
    }));

    const { on, dispatcher } = dispatchers(['payments']);
    const dispatch = (type, data = {}) => dispatcher.payments(type, data);

    const donate = (options = {}) => {
        const promise = Payment.donate(options).then(() => I18N.donation.success);

        networkActivityTracker.track(promise);
        return promise;
    };

    const addCredits = (options = {}) => {
        const promise = Payment.credit(options).then(() => I18N.topUp.success);

        networkActivityTracker.track(promise);
        return promise;
    };

    const getPromise = (type, options) => {
        if (type === 'topUp') {
            return addCredits(options);
        }
        return donate(options);
    };

    const allTheThings = ({ type, options, action }) => {
        // We have a custom process with humanVerification via signup
        if (action === 'humanVerification') {
            return;
        }

        dispatch(`${type}.request.load`);
        getPromise(type, options)
            .then(notification.success)
            .then(() => dispatch(`${type}.request.success`))
            .catch((e) => dispatch(`${type}.request.error`, e));
    };

    on('payments', (e, { type, data = {} }) => {
        type === 'donate.submit' && allTheThings(data);
    });

    return { init: angular.noop };
}
export default donateModel;
