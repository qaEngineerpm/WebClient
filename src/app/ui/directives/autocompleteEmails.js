import _ from 'lodash';

import { REGEX_EMAIL } from '../../constants';

/* @ngInject */
function autocompleteEmails(
    autocompleteEmailsModel,
    autocompleteBuilder,
    emailsEncryptionFlags,
    dispatchers,
    gettextCatalog,
    composerContactGroupSelection,
    notification,
    translator
) {
    const TAB_KEY = 9;
    const BACKSPACE_KEY = 8;
    const COMMA_KEY = 188;
    const ESCAPE_KEY = 27;
    const THROTTLE_TIMEOUT = 300;

    const I18N = translator(() => ({
        failedToFetch(list = []) {
            return gettextCatalog.getString(
                'Failed to get key information for {{emails}}. Removing from recipient list. Please try again.',
                { emails: list.join(', ') },
                'Error'
            );
        }
    }));

    /**
     * Get the selected input value configuration
     * @param  {Object} model Factory autocompleteEmailsModel
     * @param  {String} value Input value
     * @return {Object}       {label, value}
     */
    const getConfigEmailInput = (model, value = '') => {
        if (REGEX_EMAIL.test(value)) {
            const [config] = model.filterContact(value, true).list;
            // Can be undefined if there is no match
            if (config) {
                return config;
            }
        }

        return { label: value, value };
    };

    /**
     * Get the form value (the input value) onSubmit
     * @param  {Node} target
     * @return {String}
     */
    const getFormValue = (target) => {
        if (target.nodeName === 'FORM') {
            const input = target.querySelector('input');
            return {
                value: (input ? input.value : '').trim(),
                clear() {
                    input && (input.value = '');
                }
            };
        }

        return {
            value: (target.value || '').trim(),
            clear() {
                target.value = '';
            }
        };
    };

    /**
     * Check if an input value is splitable, which means it contains emails
     * separated by a , or ;
     * @param  {String} value
     * @return {Boolean}
     */
    const isSplitable = (value = '') => value.indexOf(',') > -1 || value.indexOf(';') > -1;

    /**
     * Split emails separated by , or ;
     * @param  {String} value
     * @return {Array}
     */
    const splitEmails = (value = '') => {
        return value
            .split(/,|;/)
            .filter(Boolean)
            .map((txt) => txt.trim());
    };

    const getRecipients = (model) => {
        return model
            .all()
            .slice()
            .reduce(
                (acc, item) => {
                    const key = !item.isContactGroup ? 'emails' : 'contactGroups';
                    acc[key].push(item);
                    return acc;
                },
                { emails: [], contactGroups: [] }
            );
    };

    const link = (scope, el, { awesomplete, attr }) => {
        const { dispatcher, on, unsubscribe } = dispatchers(['composer.update', 'autocompleteEmails']);

        scope.emails = [];

        const $list = el[0].querySelector('.autocompleteEmails-admin');
        // Model for this autocomplete
        const model = autocompleteEmailsModel(scope.list);
        const modelExtender = emailsEncryptionFlags(scope.message);

        // Auto scroll to the end of the list
        const updateScroll = () => _rAF(() => ($list.scrollTop = $list.scrollHeight + 32));

        /**
         * Set emails on the scope.
         * NOTE: This will update the {To,CC,BCC}List in the message model.
         * @param {Array} emails
         */
        const setEmails = (emails = []) => {
            scope.$applyAsync(() => {
                scope.emails = emails;
                scope.list = emails;
                updateScroll();
                /*
                    NOTE: the main purpose of this is to update the tooltip in the lock directive since we don't use $watch.
                    Needs to be done in a rAF because otherwise when '$on' is triggered the scope has not been fully updated yet.
                 */
                _rAF(() => {
                    scope.$applyAsync(() => {
                        dispatcher.autocompleteEmails('refresh', {
                            messageID: scope.message.ID,
                            emails
                        });
                    });
                });
            });
        };

        /**
         * Extend the emails from the email model with information about PGP and loading.
         * Always get the latest array from the model. This is to ensure the list is always up to date.
         * Set them on the scope.
         */
        const extendAndSet = () => {
            const config = getRecipients(model);

            // Extend the emails with any cached information, or with loading in case it's a new address.
            const list = modelExtender.extendFromCache(config.emails);

            setEmails(config.contactGroups.concat(list));
        };

        const removeGroup = (Address) => {
            const cache = composerContactGroupSelection(scope.message.ID);
            cache.remove(Address);
        };

        /**
         * Sync the emails to the cache.
         */
        const sync = async () => {
            const { emails } = getRecipients(model);

            // Sync the emails to cache.
            const { addressesToRemove = [], failedAddresses = [] } = await modelExtender.sync(emails);

            // Display an error message that these addresses failed to fetch.
            if (failedAddresses.length) {
                notification.error(I18N.failedToFetch(failedAddresses));
            }

            // Need to remove the addresses that were invalid from the real model.
            addressesToRemove.forEach(model.removeByAddress);
        };

        /**
         * Update the list. Get the emails from the model, and extend them with the PGP and loading data.
         * @returns {Promise<void>}
         */
        const updateModel = async () => {
            // Extend and set the addresses. Primarily to show the loading spinner for new addresses.
            extendAndSet();

            // Handle invalid addresses and update the cache.
            await sync();

            // Extend and set the addresses. Gets the latest information from the cache.
            extendAndSet();
        };

        // Throttle the update because it can be called multiple times.
        const syncModel = _.throttle(updateModel, THROTTLE_TIMEOUT);
        syncModel();

        /**
         * Remove an item from the list of emails ([<icon> email <button>]...)
         * @param  {String} options.address Address to remove
         * @param  {String} options.key     Type of list (CCList, ToList, BCCList)
         * @return {void}
         */
        function removeItem({ address, key }) {
            // Ensure we remove the address in the right list
            if (attr.key === key) {
                model.removeByAddress(address);
                removeGroup(address);
                syncModel();
            }
        }

        on('contacts', (event, { type }) => {
            if (type !== 'contactEvents' && type !== 'contactUpdated') {
                return;
            }
            syncModel();
        });

        on('mailSettings', (event, { data: { key } }) => {
            if (key !== 'Sign' && key !== 'all') {
                return;
            }
            syncModel();
        });

        on('composer.update', (e, { type, data: { message = { ID: null } } = {} }) => {
            if (type !== 'close.panel' || message.ID !== scope.message.ID) {
                return;
            }
            syncModel();
        });

        on('squire.messageSign', (e, { data: { messageID } }) => {
            if (messageID !== scope.message.ID) {
                return;
            }
            syncModel();
        });

        on('recipient.update', (e, { type, data: { messageID, oldAddress, Address, Name, key, remove = {} } }) => {
            if (messageID !== scope.message.ID) {
                return;
            }
            if (type === 'update' && attr.key === key) {
                model.updateEmail(oldAddress, Address, Name);
                syncModel();
            }

            type === 'remove' && removeItem(remove);
        });

        const onInput = ({ target }) => {
            // Only way to clear the input if you add a comma.
            target.value === ',' && (target.value = '');

            /**
             * If there is something before the comma add it to the selected list
             * Then clear the input, and set the focus onto the input
             */
            if (target.value && isSplitable(target.value)) {
                const emails = splitEmails(target.value);
                emails.forEach((value) => model.add({ label: value, value }));
                syncModel();
                return _rAF(() => ((awesomplete.input.value = ''), awesomplete.input.focus()));
            }

            // Classic autocompletion
            const { list, hasAutocompletion } = model.filterContact(target.value);

            hasAutocompletion && (awesomplete.list = list);

            if (!(target.value || '').includes('@')) {
                return;
            }

            // Unselect the autocomplete suggestion if the input value is a valid email
            if (hasAutocompletion && REGEX_EMAIL.test(target.value)) {
                return awesomplete.goto(-1);
            }
        };

        const onClick = ({ target }) => {
            // Reset autocomplete to work only after 1 letter
            awesomplete.minChars = 1;

            if (target.classList.contains('autocompleteEmails-btn-remove')) {
                return removeItem(target.dataset);
            }

            /**
             * Click onto the empty input
             * Display the autocomplete with a list
             */
            if (target.nodeName === 'INPUT' && !target.value) {
                awesomplete.minChars = 0;
                const { list, hasAutocompletion } = model.filterContact(target.value);

                hasAutocompletion && (awesomplete.list = list);
            }
        };

        /**
         * Autodetect the value of the input if you fill it without
         * the autocomplete
         * @param  {Event} e
         * @return {void}
         */
        const onSubmit = (e) => {
            e.preventDefault();

            const { value, clear } = getFormValue(e.target);

            if (value) {
                model.add(getConfigEmailInput(model, value));
                clear();
                syncModel();
                awesomplete.close();
            }
        };

        const onKeyDown = (e) => {
            const hasAutocompletion = !awesomplete.input.value && !model.isEmpty();

            switch (e.keyCode) {
                case TAB_KEY:
                    // When the autocomplete is opened and selected
                    if (awesomplete.opened && awesomplete.selected) {
                        e.preventDefault();
                        awesomplete.select();
                        return _rAF(() => awesomplete.input.focus());
                    }

                    // Default case, when you add someting inside the input
                    awesomplete.input.value && onSubmit(e);
                    break;

                // Prevent autoselect if you press MAJ + COMMA (< for QWERTY)
                case COMMA_KEY && !e.shiftKey:
                    awesomplete.select();
                    break;

                case ESCAPE_KEY:
                    // Close the composer if no autocompletion
                    if (!hasAutocompletion) {
                        dispatcher['composer.update']('escape.autocomplete', { message: scope.message });
                    }
                    break;

                case BACKSPACE_KEY:
                    // Remove last autocomplete only if input is empty and list is not
                    if (hasAutocompletion) {
                        model.removeLast();
                        syncModel();
                    }
                    break;
            }
        };

        const refreshFromList = (list = []) => {
            model.refresh(list);
            syncModel();
        };

        /**
         * Auto scroll will be available with the 1.2
         * Patch extracted from {@link https://github.com/LeaVerou/awesomplete/issues/16875}
         */
        awesomplete.input.addEventListener('blur', onSubmit);
        /**
         * Update the model when an user select an option
         */
        awesomplete.replace = function replace(opt) {
            model.add(opt);
            this.input.value = '';
            syncModel();
        };

        // Custom filter as the list contains unicode and not the input
        awesomplete.filter = (text, input) => {
            return Awesomplete.FILTER_CONTAINS(text, model.formatInput(input));
        };

        el.on('keydown', onKeyDown);
        el.on('click', onClick);
        el.on('input', onInput);
        el.on('submit', onSubmit);

        on('autocompleteEmails', (event, { type, data = {} }) => {
            if (
                type === 'refresh' &&
                data.name === el[0].getAttribute('data-name') &&
                data.messageID === scope.message.ID
            ) {
                refreshFromList(data.list);
            }
        });

        scope.$on('$destroy', () => {
            el.off('keydown', onKeyDown);
            el.off('click', onClick);
            el.off('input', onInput);
            el.off('submit', onSubmit);
            awesomplete.input.removeEventListener('blur', onSubmit);
            model.clear();
            modelExtender.clear();
            unsubscribe();
        });
    };

    const compile = (el, { key }) => {
        const node = el[0].querySelector('.autocompleteEmails-item');
        node && node.setAttribute('data-key', key);
    };

    return {
        scope: {
            list: '=emails',
            message: '='
        },
        replace: true,
        templateUrl: require('../../../templates/ui/autocompleteEmails.tpl.html'),
        compile: autocompleteBuilder(
            { link, compile },
            {
                data(item) {
                    return {
                        label: item.label,
                        value: {
                            value: item.value,
                            data: {
                                ContactID: item.ContactID,
                                isContactGroup: item.isContactGroup
                            }
                        }
                    };
                }
            }
        )
    };
}

export default autocompleteEmails;
