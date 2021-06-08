import { getMessage, decryptSessionKey } from 'pmcrypto';

import CONFIG from '../../config';
import { uniqID } from '../../../helpers/string';

/* @ngInject */
function attachmentApi($http, url, $q, dispatchers, keysModel, authenticationStore, gettextCatalog) {
    const MAP = {
        message: {},
        request: {}
    };

    const requestURL = url.build('attachments');
    const { dispatcher } = dispatchers(['attachment.upload']);
    const dispatch = (type, data) => dispatcher['attachment.upload'](type, data);
    const dispatchUpload = (REQUEST_ID, message, packet) => (progress, status, isStart = false) => {
        dispatch('uploading', {
            id: REQUEST_ID,
            messageID: message.ID,
            message,
            status,
            progress,
            packet,
            isStart
        });
    };

    /**
     * Parse the JSON coming from the XHR request
     * @param  {XMLHttpRequest} xhr
     * @return {Object}
     */
    const parseJSON = (xhr) => {
        const response = (json, isInvalid = false) => ({ json, isInvalid });
        try {
            return response(JSON.parse(xhr.responseText));
        } catch (e) {
            return response(
                {
                    Error: `JSON parsing error: ${xhr.responseText}`
                },
                true
            );
        }
    };

    /**
     * Build the formData to upload
     * @param  {Object} packets
     * @param  {Object} message
     * @return {FormData}
     */
    const makeFormUpload = (packets, message, tempPacket) => {
        const data = new FormData();
        data.append('Filename', packets.Filename || tempPacket.filename);
        data.append('MessageID', message.ID);
        data.append('ContentID', tempPacket.ContentID);
        data.append('MIMEType', packets.MIMEType);
        data.append('KeyPackets', new Blob([packets.keys]));
        data.append('DataPacket', new Blob([packets.data]));
        if (packets.signature) {
            data.append('Signature', new Blob([packets.signature]));
        }
        return data;
    };

    /**
     * Close a pending request and dispatch an action
     * @param  {Numer} options.id        Timestamp id for a request
     * @param  {String} options.messageID
     * @return {void}
     */
    function killUpload({ id, messageID }) {
        MAP.request[id].request.abort();
        delete MAP.message[messageID][id];
        delete MAP.request[id];
    }

    /**
     * Get an attachment by its ID
     * @param  {String} ID
     * @return {Promise}
     */
    const get = (ID) => $http.get(requestURL(ID), { responseType: 'arraybuffer' });

    const upload = (packets, message, tempPacket, total) => {
        const REQUEST_ID = uniqID();
        const dispatcher = dispatchUpload(REQUEST_ID, message, tempPacket);
        const deferred = $q.defer();
        const xhr = new XMLHttpRequest();
        const keys = keysModel.getPrivateKeys(message.AddressID);
        const { on, unsubscribe } = dispatchers();

        // Check the network status of the app (XHR does not auto close)
        on('AppModel', (e, { type, data = {} }) => {
            if (type === 'onLine' && !data.value) {
                xhr.abort();
            }
        });

        const pending = {
            id: REQUEST_ID,
            messageID: message.ID,
            packet: tempPacket,
            request: xhr
        };

        MAP.message[message.ID] = {
            ...(MAP.message[message.ID] || {}),
            [REQUEST_ID]: pending
        };

        MAP.request[REQUEST_ID] = MAP.message[message.ID][REQUEST_ID];

        dispatcher(1, true, true);

        xhr.upload.onprogress = (event) => {
            const progress = (event.loaded / event.total) * 99;
            dispatcher(progress, true);
        };

        xhr.onerror = onerror;

        function onerror(json) {
            // remove the current request as it's resolved
            delete MAP.message[message.ID][REQUEST_ID];
            delete MAP.request[REQUEST_ID];

            message.uploading = Object.keys(MAP.message[message.ID]).length;

            dispatch('error', {
                id: REQUEST_ID,
                messageID: message.ID,
                message
            });

            deferred.reject(json);
            unsubscribe();
        }

        xhr.onabort = function onabort() {
            // remove the current request as it's resolved
            delete MAP.message[message.ID][REQUEST_ID];
            delete MAP.request[REQUEST_ID];

            message.uploading = Object.keys(MAP.message[message.ID]).length;

            dispatch('cancel', {
                id: REQUEST_ID,
                messageID: message.ID,
                message
            });

            deferred.resolve({ id: REQUEST_ID, isAborted: true });
            unsubscribe();
        };

        xhr.onload = async function onload() {
            const { json, isInvalid } = parseJSON(xhr);

            const statusCode = this.status;
            unsubscribe();

            if (statusCode !== 200 || json.Error) {
                // isInvalid = false: Attachment disallowed by back-end size limit (no change in size)
                const msgError = !isInvalid
                    ? json.Error
                    : gettextCatalog.getString('Unable to upload file. Please try again', null, 'Error');
                return onerror({
                    ...json,
                    Error: msgError
                });
            }

            dispatcher(100, false);
            dispatch('uploaded.success', {
                id: REQUEST_ID,
                messageID: message.ID,
                packet: tempPacket,
                total,
                message
            });

            // remove the current request as it's resolved
            delete MAP.message[message.ID][REQUEST_ID];
            delete MAP.request[REQUEST_ID];

            try {
                const message = await getMessage(packets.keys);
                const sessionKey = await decryptSessionKey({ message, privateKeys: keys });

                deferred.resolve({
                    REQUEST_ID,
                    sessionKey,
                    attachment: {
                        ...(json.Attachment || {}),
                        sessionKey
                    }
                });
            } catch (e) {
                deferred.reject(e);
            }
        };

        xhr.open('post', requestURL(), true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('Accept', 'application/vnd.protonmail.v1+json');
        xhr.setRequestHeader('x-pm-appversion', 'Web_' + CONFIG.app_version);
        xhr.setRequestHeader('x-pm-apiversion', CONFIG.api_version);
        xhr.setRequestHeader('x-pm-uid', authenticationStore.getUID());

        xhr.send(makeFormUpload(packets, message, tempPacket));

        return deferred.promise;
    };

    /**
     * Delete an attachment from the API
     * @param  {Message} message
     * @param  {Object} attachment
     * @return {Promise}
     */
    const remove = async ({ ID: MessageID } = {}, attachment = {}) => {
        const { data = {} } = await $http.delete(requestURL(attachment.ID), { MessageID });
        return data;
    };

    const updateSignature = ({ ID, Signature }) => $http.put(requestURL(ID, 'signature'), { Signature });

    return { get, upload, updateSignature, killUpload, remove };
}
export default attachmentApi;
