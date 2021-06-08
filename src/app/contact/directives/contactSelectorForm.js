import _ from 'lodash';

/* @ngInject */
function contactSelectorForm(gettextCatalog, notification, translator) {
    const I18N = translator(() => ({
        invalidForm: gettextCatalog.getString('Invalid form', null, 'Error')
    }));
    const NO_RECIPIENTS_CLASS = 'contactSelectorForm-no-recipients';
    return {
        restrict: 'E',
        replace: true,
        templateUrl: require('../../../templates/contact/contactSelectorForm.tpl.html'),
        link(scope, el) {
            // NOTE contactSelectorForm is used in contactSelectorModal and receive scope.ctrl from it

            const getRecipients = () => _.filter(scope.ctrl.list, { selected: true }).concat(scope.ctrl.others);
            const onReset = scope.ctrl.close;
            const onSubmit = () => {
                if (scope.selectorForm.$invalid) {
                    notification.error(I18N.invalidForm);
                    return;
                }

                scope.$applyAsync(() => {
                    const recipients = getRecipients();
                    scope.ctrl.submit(recipients);
                });
            };

            const updateView = () => {
                const recipients = getRecipients();
                el[0].classList[!recipients.length ? 'add' : 'remove'](NO_RECIPIENTS_CLASS);
                scope.checkAll = scope.ctrl.list.length === _.filter(scope.ctrl.list, { selected: true }).length;
            };

            const onClick = ({ target }) => {
                const list = target.getAttribute('data-list');
                const index = target.getAttribute('data-index');

                switch (list) {
                    case 'others':
                        scope.$applyAsync(() => {
                            scope.ctrl.others.splice(index, 1);
                            updateView();
                        });
                        break;

                    case 'list':
                        scope.$applyAsync(() => {
                            const list = _.filter(scope.ctrl.list, { selected: true });
                            list[index].selected = false;
                            updateView();
                        });
                        break;
                    default:
                        break;
                }
            };

            el.on('submit', onSubmit);
            el.on('reset', onReset);
            el.on('click', onClick);

            scope.disableCheckAll = !scope.ctrl.list.length;
            scope.onCheck = () => updateView();
            scope.onSelectAll = () => {
                scope.ctrl.list = scope.ctrl.list.map((email) => ({
                    ...email,
                    selected: scope.checkAll
                }));
            };

            updateView();

            scope.$on('$destoy', () => {
                el.off('submit', onSubmit);
                el.off('reset', onReset);
                el.off('click', onClick);
            });
        }
    };
}
export default contactSelectorForm;
