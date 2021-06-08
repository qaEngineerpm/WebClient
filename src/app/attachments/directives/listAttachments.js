import _ from 'lodash';

/* @ngInject */
function listAttachments($state, dispatchers, attachmentDownloader) {
    const DECRYPTING_CLASSNAME = 'listAttachments-item-decrypt';
    const DOWNLOADED_CLASSNAME = 'listAttachments-item-download';
    const HIDDEN_CLASSNAME = 'hidden';

    return {
        scope: {
            model: '='
        },
        replace: true,
        templateUrl: require('../../../templates/attachments/listAttachments.tpl.html'),
        link(scope, el) {
            const $list = el[0].querySelector('.listAttachments-list');
            const hide = () => !scope.model.Attachments.length && el[0].classList.add(HIDDEN_CLASSNAME);
            const show = () => scope.model.Attachments.length && el[0].classList.remove(HIDDEN_CLASSNAME);
            const { on, dispatcher, unsubscribe } = dispatchers(['attachment.upload.outside']);

            on('attachmentAdded', show);

            hide();

            // Bind custom className for outside
            $state.is('eo.reply') && el[0].classList.add('state-eoReply');

            const onClick = (e) => {
                const { target } = e;
                // allow pointer events on children to enable tooltips.
                const node = ['A', 'BUTTON'].includes(target.parentNode.nodeName) ? target.parentNode : target;

                // download attachment
                if (node.nodeName === 'A') {
                    const ID = node.getAttribute('data-attachment-id');
                    const attachment = _.find(scope.model.Attachments, { ID });

                    node.classList.add(DECRYPTING_CLASSNAME);

                    /*
                        Safari doesn't support [download] on iOS
                        We need to display an error message to inform the user,
                        what's need to be done to download the file.
                     */
                    attachmentDownloader.isNotSupported(e);

                    attachmentDownloader
                        .download(attachment, scope.model, node)
                        .then(() => {
                            node.classList.add(DOWNLOADED_CLASSNAME);
                        })
                        .catch(() => {
                            node.classList.remove(DECRYPTING_CLASSNAME);
                        });
                }

                // Remove attachment
                if (node.nodeName === 'BUTTON') {
                    const ID = node.getAttribute('data-attachment-id');

                    $state.is('eo.reply') &&
                        dispatcher['attachment.upload.outside']('remove', {
                            id: node.getAttribute('data-attachment-id'),
                            message: scope.model
                        });

                    scope.$applyAsync(() => {
                        const attachment = _.find(scope.model.Attachments, { ID });

                        // If it's coming from outside there is no headers yet
                        // it's raw attachments without any record yet
                        if ((attachment.Headers || {}).embedded === 1) {
                            scope.model.NumEmbedded--;
                        }
                        scope.model.Attachments = scope.model.Attachments.filter((att) => att.ID !== ID);
                        hide();
                    });
                }
            };

            $list.addEventListener('click', onClick, false);

            scope.$on('$destroy', () => {
                $list.removeEventListener('click', onClick, false);
                unsubscribe();
            });
        }
    };
}
export default listAttachments;
