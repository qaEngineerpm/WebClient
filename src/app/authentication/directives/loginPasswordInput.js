import { PASSWORD_MODE } from '../../constants';

const { TWO_MODE, ONE_MODE } = PASSWORD_MODE;

/* @ngInject */
const loginPasswordInput = (userSettingsModel, authApi, networkActivityTracker, gettextCatalog, translator) => {
    const TWO_FACTOR_HIDDEN_CLASS = 'hideTwoFactor';

    const I18N = translator(() => ({
        [TWO_MODE]: {
            placeholder: gettextCatalog.getString('Login password', null, 'Login modal'),
            label: gettextCatalog.getString('Enter your login password:', null, 'Login modal')
        },
        [ONE_MODE]: {
            placeholder: gettextCatalog.getString('Password', null, 'Login modal'),
            label: gettextCatalog.getString('Enter your current password:', null, 'Login modal')
        }
    }));

    /**
     * Get the translated text.
     * @param {Number} mode User password mode
     * @param {String} type placeholder or label
     * @returns {String}
     */
    const getText = (mode, type) => {
        return I18N[mode][type];
    };

    return {
        scope: {
            hasTwoFactor: '<',
            form: '=',
            twoFactorCode: '=',
            loginPassword: '='
        },
        replace: true,
        restrict: 'E',
        templateUrl: require('../../../templates/authentication/loginPasswordInput.tpl.html'),
        link(scope, $el) {
            const el = $el[0];

            const userPasswordMode = userSettingsModel.get('PasswordMode');

            // Hide with CSS and with scope because of the required field on the two-fa-field.
            const setTwoFactorVisible = (twoFactor) => {
                el.classList[twoFactor ? 'remove' : 'add'](TWO_FACTOR_HIDDEN_CLASS);
                scope.twoFactorRequired = !!twoFactor;
            };

            // If two factor isn't forced, make a request to info to see if we must enable it.
            if (typeof scope.hasTwoFactor === 'undefined') {
                const promise = authApi.info().then(({ TwoFactor }) => {
                    setTwoFactorVisible(TwoFactor === 1);
                });
                networkActivityTracker.track(promise);
            }

            setTwoFactorVisible(scope.hasTwoFactor);

            const loginPasswordInput = el.querySelector('#loginPassword');
            const loginPasswordLabel = el.querySelector('#loginPasswordLabel');

            loginPasswordLabel.textContent = getText(userPasswordMode, 'label');
            loginPasswordInput.placeholder = getText(userPasswordMode, 'placeholder');

            scope.$applyAsync(() => {
                // Force sync with the model to avoid #7329
                loginPasswordInput.focus();
            });
        }
    };
};

export default loginPasswordInput;
