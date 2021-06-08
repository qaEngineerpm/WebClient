/* @ngInject */
function wildcardModel(dispatchers, gettextCatalog, networkActivityTracker, notification, settingsMailApi, translator) {
    const I18N = translator(() => ({
        success: gettextCatalog.getString('Search parameter updated', null, 'Success')
    }));

    const { on } = dispatchers();

    function updateAutowildcard({ AutoWildcardSearch }) {
        const promise = settingsMailApi
            .updateAutowildcard({ AutoWildcardSearch })
            .then(() => notification.success(I18N.success));

        networkActivityTracker.track(promise);
    }

    on('settings', (event, { type, data = {} }) => {
        type === 'autowildcard.update' && updateAutowildcard(data);
    });

    return { init: angular.noop };
}
export default wildcardModel;
