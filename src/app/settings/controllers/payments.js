import _ from 'lodash';
import { UNPAID_STATE } from '../../constants';
import { isExpired } from '../../../helpers/card';

/* @ngInject */
function PaymentsController(
    $scope,
    gettextCatalog,
    authentication,
    cardModal,
    dispatchers,
    payModal,
    confirmModal,
    methods,
    notification,
    networkActivityTracker,
    Payment,
    paymentModel
) {
    const { on, unsubscribe } = dispatchers();

    const updateUser = () => {
        $scope.subscribed = authentication.user.Subscribed;
        $scope.delinquent = authentication.user.Delinquent >= UNPAID_STATE.DELINQUENT;
        $scope.role = authentication.user.Role;
    };

    $scope.methods = methods;
    $scope.invoiceOwner = 0;

    on('updateUser', () => {
        $scope.$applyAsync(() => {
            updateUser();
        });
    });

    $scope.add = () => {
        cardModal.activate({
            params: {
                close({ methods, method } = {}) {
                    cardModal.deactivate();

                    if (method) {
                        $scope.$applyAsync(() => {
                            $scope.methods = methods;
                        });
                    }
                }
            }
        });
    };

    $scope.edit = (method) => {
        cardModal.activate({
            params: {
                method,
                close({ methods, method } = {}) {
                    cardModal.deactivate();

                    if (method) {
                        $scope.$applyAsync(() => {
                            $scope.methods = methods;
                        });
                    }
                }
            }
        });
    };

    $scope.default = function(method) {
        const methods = $scope.methods.slice();
        const index = _.findIndex(methods, { ID: method.ID });

        methods.splice(index, 1);
        methods.unshift(method);

        const promise = Payment.order({ PaymentMethodIDs: _.map(methods, 'ID') }).then(({ data = {} } = {}) => {
            $scope.methods = methods;
            notification.success(gettextCatalog.getString('Payment method updated', null, 'Payment'));
            return data;
        });

        networkActivityTracker.track(promise);
    };

    $scope.delete = function(method) {
        const title = gettextCatalog.getString('Delete payment method', null, 'Title');
        const message = gettextCatalog.getString('Are you sure you want to delete this payment method?', null, 'Info');

        confirmModal.activate({
            params: {
                title,
                message,
                confirm() {
                    const promise = Payment.deleteMethod(method.ID)
                        .then(() => paymentModel.getMethods(true))
                        .then(confirmModal.deactivate)
                        .then(() => {
                            $scope.methods.splice($scope.methods.indexOf(method), 1);
                            notification.success(gettextCatalog.getString('Payment method deleted', null, 'Payment'));
                        })
                        .catch((error) => {
                            confirmModal.deactivate();
                            throw error;
                        });
                    networkActivityTracker.track(promise);
                },
                cancel() {
                    confirmModal.deactivate();
                }
            }
        });
    };

    /**
     * Open a modal to pay invoice
     * @param {Object} invoice
     */
    $scope.pay = function(invoice) {
        const promises = {
            methods: Payment.methods(),
            check: Payment.check(invoice.ID),
            status: Payment.status()
        };

        networkActivityTracker.track(
            Promise.all(promises).then((result) => {
                const methods = result.methods.data.PaymentMethods;
                const status = result.status.data;

                payModal.activate({
                    params: {
                        invoice,
                        methods,
                        status,
                        currency: result.check.data.Currency,
                        amount: result.check.data.Amount,
                        credit: result.check.data.Credit,
                        amountDue: result.check.data.AmountDue,
                        checkInvoice: result.check.data,
                        close(result) {
                            payModal.deactivate();

                            if (result === true) {
                                // Set invoice state to PAID
                                invoice.State = 1;
                                // Display a success notification
                                notification.success(gettextCatalog.getString('Invoice paid', null, 'Info'));
                            }
                        }
                    }
                });
            })
        );
    };

    $scope.isExpired = isExpired;

    updateUser();

    $scope.$on('$destroy', () => {
        unsubscribe();
    });
}
export default PaymentsController;
