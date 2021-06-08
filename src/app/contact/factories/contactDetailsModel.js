import _ from 'lodash';
import vCard from 'vcf';

import { CONTACT_ADD_ID } from '../../constants';
import { unescapeValue, escapeValue, cleanValue } from '../../../helpers/vcard';
import {
    FIELDS_TYPED,
    getKeys,
    getHumanFields,
    isPersonalsKey,
    isEncryptedKey,
    FIELDS,
    toHumanKey
} from '../../../helpers/vCardFields';
import { extract as extractProperties } from '../../../helpers/vCardProperties';

/* @ngInject */
function contactDetailsModel(
    contactTransformLabel,
    contactSchema,
    gettextCatalog,
    vcard,
    translator,
    contactEncryptionAddressMap,
    contactEncryptionSaver
) {
    const vcardService = vcard;

    const I18N = translator(() => ({
        unknown: gettextCatalog.getString('Unknown', null, 'Default display name vcard')
    }));

    const buildProperty = (type) => (property = {}) => {
        const key = property.getField();
        return {
            value: cleanValue(property.valueOf(), key),
            type: getType(property) || type,
            key,
            params: property.getParams()
        };
    };

    /**
     * Get property type (extract the first one)
     * @param  {Object} property
     * @return {String} type
     */
    function getType(property) {
        const type = property.getType();
        return Array.isArray(type) ? type[0] : type;
    }

    function getParams(item = {}, pref = 0) {
        const params = item.params || {};

        // Always add a type if we can cf #8137
        if (FIELDS_TYPED.includes(item.type)) {
            params.type = contactTransformLabel.toVCard(item.label);
        }

        if (pref) {
            params.pref = pref;
        }

        return params;
    }

    /**
     * Prepare the request before to send to the BE
     * @return {Object} params
     */
    function prepare(scope) {
        const params = angular.copy(contactSchema.contactAPI);
        const contactID = scope.contact.ID || CONTACT_ADD_ID;
        const MAP_EMAIL_POS = {};

        Object.keys(scope.model).forEach((key) => {
            const child = scope.model[key];

            switch (key) {
                case 'Emails':
                    child.forEach((item, index) => {
                        const { value: email = '', type } = item;
                        if (!email) {
                            return;
                        }
                        const vCardArgs = getParams(item, child.length > 1 && index + 1);
                        const emailProperty = new vCard.Property(type, escapeValue(email), vCardArgs);
                        emailProperty.group = `item${index + 1}`;
                        const helperCard = new vCard();
                        helperCard.addProperty(emailProperty);

                        const contactEncryptModel = contactEncryptionAddressMap.get(contactID, email);
                        const card = contactEncryptionSaver.build(
                            { vCard: helperCard, ID: contactID },
                            email,
                            contactEncryptModel
                        );

                        // Save position to attach group to the new index (ex: post reorder)
                        MAP_EMAIL_POS[vCardArgs.group] = emailProperty.group;
                        params.vCard = vcardService.merge([params.vCard, card]);
                    });
                    break;
                case 'Tels':
                case 'Adrs':
                    child.forEach((item, index) => {
                        if (item.value) {
                            const value = escapeValue(item.value);
                            // Remove empty lines from the end for addresses
                            const val = key === 'Adrs' ? _.dropRightWhile(value, (adr) => !adr) : value;
                            params.vCard.add(item.type, val, getParams(item, child.length > 1 && index + 1));
                        }
                    });
                    break;
                default:
                    child.forEach((item) => {
                        /*
                            We need to clean values for categories as the separator is a COMMA so we must not escape them ;)
                         */
                        if (item.type === 'categories') {
                            // It's an array, and it may contains many strings
                            // ['dew,cc', '1e', '2,33'] -> "dew,cc,1e,2,33"
                            const value = (item.value || [])
                                .toString()
                                .split(',')
                                .filter(Boolean)
                                .toString();

                            if (value.length) {
                                const cfg = getParams(item);

                                // Import the new position if there was a re-order
                                const group = MAP_EMAIL_POS[cfg.group];

                                // ex: when you delete the only email attached to a group you don't need to keep the group anymore
                                if (group) {
                                    params.vCard.add(item.type, cleanValue(escapeValue(value)), {
                                        ...cfg,
                                        group
                                    });
                                }
                            }

                            return;
                        }

                        item.value && params.vCard.add(item.type, escapeValue(item.value), getParams(item));
                    });
                    break;
            }
        });

        let fnProperty = params.vCard.get('fn');

        if (Array.isArray(fnProperty)) {
            fnProperty = fnProperty[0];
        }

        if (!fnProperty || fnProperty.isEmpty()) {
            let value = '';
            const emailProperty = params.vCard.get('email');

            if (emailProperty) {
                const emailValue = emailProperty.valueOf();
                value = Array.isArray(emailValue) ? emailValue[0].valueOf() : emailValue;
            }

            params.vCard.add('fn', value || I18N.unknown);
        }

        return params;
    }

    /**
     * Extract fields from the vCard
     * @param  {vCard}   options.vcard
     * @param  {String}  options.field
     * @param  {String}  options.type
     * @param  {Boolean} isPersonnal   field value is a key from PERSONNALS
     * @return {Array}
     */
    function extract({ vcard = new vCard(), field = '', type }, isPersonnal) {
        const keys = getKeys(field, vcard, isPersonnal);
        const listKeys = keys || (isPersonalsKey(field) ? getKeys('PERSONALS', vcard) : []);
        return extractProperties(vcard, listKeys).map(buildProperty(type));
    }

    /**
     * Extract Human friendly keys from a vCard (name, adr etc.)
     * @param  {vCard} vcard
     * @param  {Function} filter Advanced filter if we need to remove more keys
     * @return {Array}
     */
    const extractHumans = (vcard, filter = _.identity) => {
        const fields = getHumanFields(vcard);
        const { clear, encrypted, personalsKey } = fields.reduce(
            (acc, field) => {
                if (isPersonalsKey(field)) {
                    !acc.personalsKey && (acc.personalsKey = field);
                    return acc;
                }

                const properties = extract({
                    field: field.toUpperCase(),
                    vcard
                });

                if (!properties.length) {
                    return acc;
                }

                if (isEncryptedKey(field)) {
                    acc.encrypted.push(properties);
                    return acc;
                }

                acc.clear[field] = properties;

                return acc;
            },
            {
                clear: Object.create(null),
                encrypted: [], // [[], [], []]
                personalsKey: undefined
            }
        );

        if (personalsKey) {
            const list = extract({
                field: personalsKey.toUpperCase(),
                vcard
            });

            const filteredList = list.filter(filter);

            return {
                clear,
                encrypted: filteredList.length ? encrypted.concat([filteredList]) : encrypted
            };
        }

        return { clear, encrypted };
    };

    /**
     * Get a label for the group. First try to convert the custom type to lang. If the custom type doesn't exist,
     * try to convert the field itself. If that doesn't exist, just use the field.
     * @param {string} key
     * @param {string} type
     * @returns {string}
     */
    const getLabel = (key = '', type = key) => {
        return contactTransformLabel.toLangExplicit(type) || contactTransformLabel.toLangExplicit(key) || key;
    };

    const extractAll = (vcard) => {
        return Object.keys(FIELDS).reduce((acc, field) => {
            const model = extract({ vcard, field });

            if (model.length && !/^x-|^avoid$/i.test(field)) {
                acc[toHumanKey(field)] = model.map((item) => {
                    const label = getLabel(item.key);
                    return {
                        ...item,
                        label,
                        type: contactTransformLabel.toVCard(label)
                    };
                });
            }
            return acc;
        }, Object.create(null));
    };

    return { extract, prepare, unescapeValue, escapeValue, extractHumans, extractAll };
}
export default contactDetailsModel;
