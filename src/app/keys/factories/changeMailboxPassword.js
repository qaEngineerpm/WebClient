import { decryptMessage, decryptPrivateKey, encryptPrivateKey, getMessage } from 'pmcrypto';
import { computeKeyPassword, generateKeySalt } from 'pm-srp';

import { PAID_ADMIN_ROLE } from '../../constants';

/* @ngInject */
function changeMailboxPassword(
    $log,
    addressesModel,
    authentication,
    gettextCatalog,
    Key,
    networkActivityTracker,
    organizationApi,
    User
) {
    /**
     * Instead of grab keys from the cache, we call the back-end, just to make sure everything is up to date
     * @param {String} newMailPwd
     * @param {String} keySalt
     * @return {Promise}
     */
    function getUser(newMailPwd = '', keySalt = '') {
        return Promise.all([computeKeyPassword(newMailPwd, keySalt), User.get()]).then(([password, user = {}]) => ({
            password,
            user
        }));
    }

    /**
     * Change organization keys
     * @param  {String} password
     * @param  {Object} user
     * @return {Promise}
     */
    async function manageOrganizationKeys(password = '', oldMailPwd = '', user = {}) {
        if (user.Role !== PAID_ADMIN_ROLE) {
            return 0;
        }

        const { PrivateKey } = await organizationApi.getKeys();

        try {
            const decryptedPrivateKey = await decryptPrivateKey(PrivateKey, oldMailPwd);
            return encryptPrivateKey(decryptedPrivateKey, password);
        } catch (e) {
            return 0;
        }
    }

    function manageUserKeys(password = '', oldMailPwd = '', user = {}) {
        const inputKeys = [];
        // Collect user keys
        user.Keys.forEach((key) => inputKeys.push(key));
        // Collect address keys
        addressesModel.getByUser(user).forEach((address) => {
            address.Keys.forEach((key) => inputKeys.push(key));
        });
        // Re-encrypt all keys, if they can be decrypted
        let promises = [];
        if (user.OrganizationPrivateKey) {
            // Sub-user
            const organizationKey = decryptPrivateKey(user.OrganizationPrivateKey, oldMailPwd);

            promises = inputKeys.map(({ PrivateKey, ID, Token }) => {
                // Decrypt private key with organization key and token
                return Promise.all([organizationKey, getMessage(Token)])
                    .then(([key, message]) => decryptMessage({ message, privateKeys: [key] }))
                    .then(({ data }) => decryptPrivateKey(PrivateKey, data))
                    .then((pkg) => ({ ID, pkg }));
            });
        } else {
            // Not sub-user
            promises = inputKeys.map(({ PrivateKey, ID }) => {
                // Decrypt private key with the old mailbox password
                return decryptPrivateKey(PrivateKey, oldMailPwd).then((pkg) => ({ ID, pkg }));
            });
        }

        return promises.map((promise) => {
            return (
                promise
                    // Encrypt the key with the new mailbox password
                    .then(
                        ({ ID, pkg }) => {
                            return encryptPrivateKey(pkg, password).then((PrivateKey) => ({ ID, PrivateKey }));
                        },
                        () => {
                            // Cannot decrypt, return 0 (not an error)
                            return 0;
                        }
                    )
            );
        });
    }

    function sendNewKeys({ keys = [], keySalt = '', organizationKey = 0, newLoginPassword = '' }) {
        const keysFiltered = keys.filter((key) => key !== 0);
        const payload = { KeySalt: keySalt, Keys: keysFiltered };

        if (keysFiltered.length === 0) {
            throw new Error(gettextCatalog.getString('No keys to update', null, 'Error'));
        }

        if (organizationKey !== 0) {
            payload.OrganizationKey = organizationKey;
        }

        return Key.updatePrivate(payload, newLoginPassword);
    }

    return ({ newPassword = '', onePassword = false }) => {
        const oldMailPwd = authentication.getPassword();
        const keySalt = generateKeySalt();
        const newLoginPassword = onePassword ? newPassword : '';
        let passwordComputed;
        const promise = getUser(newPassword, keySalt)
            .then(({ password = '', user = {} }) => {
                passwordComputed = password;

                const promises = [];
                const collection = manageUserKeys(passwordComputed, oldMailPwd, user);

                promises.push(manageOrganizationKeys(passwordComputed, oldMailPwd, user));
                collection.forEach((promise) => promises.push(promise));

                return Promise.all(promises);
            })
            .then(([organizationKey, ...keys]) =>
                sendNewKeys({
                    keys,
                    keySalt,
                    organizationKey,
                    newLoginPassword
                })
            )
            .then(() => authentication.setPassword(passwordComputed));
        networkActivityTracker.track(promise);
        return promise;
    };
}
export default changeMailboxPassword;
