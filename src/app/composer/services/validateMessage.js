import { MAX_TITLE_LENGTH, UNPAID_STATE, REGEX_EMAIL, MIME_TYPES, PACKAGE_TYPE } from '../../constants';

import { normalizeRecipients, getRecipients } from '../../../helpers/message';

const { PLAINTEXT } = MIME_TYPES;
const { SEND_CLEAR, SEND_PGP_INLINE, SEND_PGP_MIME } = PACKAGE_TYPE;

const EXTERNAL_SCHEMES = [SEND_CLEAR, SEND_PGP_INLINE, SEND_PGP_MIME];

/* @ngInject */
function validateMessage(
    gettextCatalog,
    tools,
    confirmModal,
    expirationModal,
    keyCache,
    authentication,
    notification,
    addressWithoutKeys,
    sendPreferences,
    storageWarning,
    translator
) {
    const I18N = translator(() => ({
        SEND_ANYWAY: gettextCatalog.getString('Send anyway', null, 'Action'),
        STILL_UPLOADING: gettextCatalog.getString(
            'Wait for attachment to finish uploading or cancel upload.',
            null,
            'Error'
        ),
        invalidEmails(emails) {
            return gettextCatalog.getString('The following addresses are not valid: {{emails}}', { emails }, 'Error');
        },
        EMAIL_ADDRESS_INVALID: gettextCatalog.getString('Some email addresses are invalid', null, 'Error'),
        MAX_BODY_LENGTH: gettextCatalog.getString(
            'The maximum length of the message body is 16,000,000 characters.',
            null,
            'Error'
        ),
        NO_RECIPIENT: gettextCatalog.getString('Please enter at least one recipient.', null, 'Error'),
        MAX_SUBJECT_LENGTH: gettextCatalog.getString(
            'The maximum length of the subject is {{size}}.',
            { size: MAX_TITLE_LENGTH },
            'Error'
        ),
        NO_SUBJECT_TITLE: gettextCatalog.getString('No subject', null, 'Title'),
        NO_SUBJECT_MESSAGE: gettextCatalog.getString('No subject, send anyway?', null, 'Info'),
        ERROR_ADDRESSES_INFO_PRIVATE: gettextCatalog.getString('You can generate your keys here', null, 'Error'),
        ERROR_ADDRESSES: gettextCatalog.getString(
            'No address with keys available to compose a message.',
            null,
            'Error'
        ),
        KEYS: gettextCatalog.getString('Keys', null, 'Title'),
        ERROR_ADDRESSES_INFO: gettextCatalog.getString(
            'Contact your organization’s administrator to resolve this.',
            null,
            'Error'
        ),
        ERROR_DELINQUENT: gettextCatalog.getString(
            'Your account currently has an overdue invoice. Please pay all unpaid invoices.',
            null,
            'Info'
        )
    }));

    const cleanEmails = (message) => {
        message.ToList.concat(message.CCList, message.BCCList).forEach((item) => {
            item.Address = item.Address.trim();
        });
    };

    async function validate(message) {
        if (message.MIMEType !== PLAINTEXT) {
            message.setDecryptedBody(tools.fixImages(message.getDecryptedBody()));
        }

        // We delay the validation to let the time for the autocomplete
        // Check if there is an attachment uploading
        if (message.uploading > 0) {
            throw new Error(I18N.STILL_UPLOADING);
        }
        cleanEmails(message);

        await checkKeys(message);

        const emailStats = getRecipients(message).reduce(
            (acc, { Address = '' }) => {
                acc.all.push(Address);
                !REGEX_EMAIL.test(Address) && acc.invalid.push(Address);
                acc.total++;
                return acc;
            },
            { all: [], invalid: [], total: 0 }
        );

        if (emailStats.invalid.length) {
            throw new Error(I18N.invalidEmails(emailStats.invalid.join(',')));
        }

        if (!emailStats.total) {
            throw new Error(I18N.NO_RECIPIENT);
        }

        // Check title length
        if (message.Subject && message.Subject.length > MAX_TITLE_LENGTH) {
            throw new Error(I18N.MAX_SUBJECT_LENGTH);
        }

        // Check body length
        if (message.getDecryptedBody().length > 16000000) {
            throw new Error(I18N.MAX_BODY_LENGTH);
        }
    }

    /**
     * Check if the subject of this message is empty
     * And ask the user to send anyway
     * @param {Object} message
     */
    async function checkSubject({ Subject }) {
        if (Subject) {
            return;
        }

        return new Promise((resolve, reject) => {
            confirmModal.activate({
                params: {
                    title: I18N.NO_SUBJECT_TITLE,
                    message: I18N.NO_SUBJECT_MESSAGE,
                    confirm() {
                        confirmModal.deactivate().then(resolve);
                    },
                    cancel() {
                        confirmModal.deactivate().then(reject);
                    }
                }
            });
        });
    }

    function confirmExpiration(recipients = {}) {
        return new Promise((resolve, reject) => {
            expirationModal.activate({
                params: {
                    recipients,
                    confirm() {
                        expirationModal.deactivate();
                        resolve();
                    },
                    cancel() {
                        expirationModal.deactivate();
                        reject();
                    }
                }
            });
        });
    }

    /**
     * Check if the message has the requirement if ExpiresIn is defined
     * @param  {Object} message
     * @param {Array} emails list of email address (string)
     * @return {Promise}
     */
    async function checkExpiration(message, emails = []) {
        const sendPrefs = await sendPreferences.get(emails, message);

        // Filter the emails with the preferences which include this type
        const filterTypes = (types = [], shouldEncrypt = false) =>
            emails.filter((email) => {
                const { scheme, encrypt } = sendPrefs[email];
                return shouldEncrypt === encrypt && types.includes(scheme);
            });

        // Contacts for which to send with password.
        const clear = filterTypes(EXTERNAL_SCHEMES, false);
        // Contacts which include encrypted PGP sending.
        const pgp = filterTypes(EXTERNAL_SCHEMES, true);

        if (message.ExpiresIn && (pgp.length || clear.length)) {
            return confirmExpiration({ pgp, clear });
        }
    }

    /**
     * Private user can generate keys, invite him to generate them
     */
    const getErrorInfo = () => {
        if (authentication.user.Private) {
            return `${I18N.ERROR_ADDRESSES_INFO_PRIVATE} <a href="/keys">${I18N.KEYS}</a>`;
        }
        return I18N.ERROR_ADDRESSES_INFO;
    };

    function canWrite() {
        if (storageWarning.isLimitReached()) {
            return storageWarning.showModal();
        }

        // In delinquent state
        if (authentication.user.Delinquent >= UNPAID_STATE.DELINQUENT) {
            return notification.error(I18N.ERROR_DELINQUENT);
        }

        // You cannot compose messages without a valid address
        if (addressWithoutKeys.allDirty()) {
            return notification.error(`${I18N.ERROR_ADDRESSES}<br>${getErrorInfo()}`);
        }

        return true;
    }

    async function checkKeys(message) {
        const emails = normalizeRecipients(message);
        const conditions = await Promise.all(emails.map(keyCache.isInvalid));
        const invalidEmails = conditions.reduce((acc, isInvalid, index) => {
            if (isInvalid) {
                acc.push(emails[index]);
            }
            return acc;
        }, []);

        if (invalidEmails.length) {
            throw new Error(I18N.invalidEmails(invalidEmails.join(', ')));
        }
    }

    return { checkSubject, validate, canWrite, checkExpiration, checkKeys };
}
export default validateMessage;
