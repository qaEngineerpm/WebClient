import { MAILBOX_IDENTIFIERS } from '../../constants';

/* @ngInject */
function dropdownFolders(AppModel, labelsModel, dispatchers, actionConversation, labelModal, gettextCatalog) {
    const { dispatcher } = dispatchers(['dropdown', 'messageActions']);
    const mailboxes = [
        {
            Name: gettextCatalog.getString('Inbox', null, 'Label'),
            ID: MAILBOX_IDENTIFIERS.inbox,
            className: 'fa-inbox'
        },
        {
            Name: gettextCatalog.getString('Archive', null, 'Label'),
            ID: MAILBOX_IDENTIFIERS.archive,
            className: 'fa-archive'
        },
        {
            Name: gettextCatalog.getString('Spam', null, 'Label'),
            ID: MAILBOX_IDENTIFIERS.spam,
            className: 'fa-ban'
        },
        {
            Name: gettextCatalog.getString('Trash', null, 'Label'),
            ID: MAILBOX_IDENTIFIERS.trash,
            className: 'fa-trash-o'
        }
    ];

    const close = () => dispatcher.dropdown('close');

    function moveTo(elements = [], type = '', labelID = '') {
        const elementIDs = elements.map(({ ID }) => ID);

        if (type === 'conversation') {
            actionConversation.move(elementIDs, labelID);
        } else if (type === 'message') {
            dispatcher.messageActions('move', { ids: elementIDs, labelID });
        }
    }

    function getType(elements = []) {
        if (elements.length) {
            return typeof elements[0].ConversationID !== 'undefined' ? 'message' : 'conversation';
        }
        return false;
    }

    return {
        restrict: 'E',
        templateUrl: require('../../../templates/labels/dropdownFolders.tpl.html'),
        replace: true,
        scope: {
            getElements: '=elements'
        },
        link(scope, element) {
            const dropdown = angular
                .element(element)
                .closest('.pm_buttons')
                .find('.open-folder');
            const search = element[0].querySelector('.dropdown-folder-search-input');

            function onClickDropdown() {
                const exclusiveLabels = labelsModel.get('folders').map((folder) => {
                    folder.className = 'fa-folder';
                    return folder;
                });
                scope.$applyAsync(() => {
                    scope.labels = exclusiveLabels.concat(mailboxes);
                });
                const id = setTimeout(() => (search.focus(), clearTimeout(id)), 100);
            }

            function onClickList(event) {
                if (event.target.tagName !== 'BUTTON') {
                    return;
                }

                if (event.target.classList.contains('dropdown-folder-scrollbox-group-item-button')) {
                    scope.$applyAsync(() => {
                        const folderID = event.target.getAttribute('data-folder-id');
                        const elements = scope.getElements();
                        const type = getType(elements);
                        AppModel.set('numberElementChecked', 0);
                        moveTo(elements, type, folderID);
                        close();
                    });
                }

                if (event.target.classList.contains('dropdown-folder-create-button')) {
                    labelModal.activate({
                        params: {
                            label: {
                                Name: scope.searchValue,
                                Exclusive: 1
                            },
                            close(folder) {
                                labelModal.deactivate();
                                folder && onClickDropdown();
                            }
                        }
                    });
                }
            }

            dropdown.on('click', onClickDropdown);
            element.on('click', onClickList);

            scope.color = ({ Color: color = 'inherit' } = {}) => ({ color });

            scope.$on('$destroy', () => {
                dropdown.off('click', onClickDropdown);
                element.off('click', onClickList);
            });
        }
    };
}
export default dropdownFolders;
