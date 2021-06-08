/* @ngInject */
function blackFridayModalOpener(
    blackFridayModel,
    blackFridayModal,
    subscriptionModel,
    networkActivityTracker,
    dispatchers
) {
    let STATE = {};

    const { on } = dispatchers();

    on('logout', () => {
        STATE = {};
    });

    const openModal = () => {
        blackFridayModal.activate();
    };

    return async () => {
        if (STATE.loading) {
            return STATE.loading;
        }

        const currency = subscriptionModel.currency();

        /**
         * This is a bit special to show the spinner before the modal has opened.
         */
        if (!STATE.hasData || currency !== STATE.currency) {
            STATE.hasData = false;
            STATE.currency = currency;
            STATE.loading = blackFridayModel
                .getOffers(currency)
                .then(() => {
                    STATE.hasData = true;
                    STATE.loading = undefined;
                    openModal();
                })
                .catch((e) => {
                    STATE.currency = undefined;
                    STATE.loading = undefined;
                    throw e;
                });

            networkActivityTracker.track(STATE.loading);

            return STATE.loading;
        }

        openModal();
    };
}

export default blackFridayModalOpener;
