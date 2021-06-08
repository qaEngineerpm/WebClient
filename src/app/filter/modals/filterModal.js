import _ from 'lodash';

import { MAILBOX_IDENTIFIERS, FILTER_VERSION } from '../../constants';
import { API_CUSTOM_ERROR_CODES } from '../../errors';
import { templates as sieveTemplates } from '../../../helpers/sieve';

/* @ngInject */
function filterModal(
    $timeout,
    pmModal,
    gettextCatalog,
    Filter,
    networkActivityTracker,
    notification,
    dispatchers,
    eventManager,
    labelModal,
    labelsModel,
    sieveLint,
    filterValidator,
    userType,
    translator
) {
    const I18N = translator(() => ({
        TYPES: [
            { label: gettextCatalog.getString('Select', null, 'Filter modal type'), value: 'select' },
            { label: gettextCatalog.getString('the subject', null, 'Filter modal type'), value: 'subject' },
            { label: gettextCatalog.getString('the sender', null, 'Filter modal type'), value: 'sender' },
            { label: gettextCatalog.getString('the recipient', null, 'Filter modal type'), value: 'recipient' },
            { label: gettextCatalog.getString('the attachments', null, 'Filter modal type'), value: 'attachments' }
        ],
        COMPARATORS: [
            { label: gettextCatalog.getString('contains', null, 'Condition for custom filter'), value: 'contains' },
            { label: gettextCatalog.getString('is exactly', null, 'Condition for custom filter'), value: 'is' },
            { label: gettextCatalog.getString('begins with', null, 'Condition for custom filter'), value: 'starts' },
            { label: gettextCatalog.getString('ends with', null, 'Condition for custom filter'), value: 'ends' },
            { label: gettextCatalog.getString('matches', null, 'Condition for custom filter'), value: 'matches' },
            {
                label: gettextCatalog.getString('does not contain', null, 'Condition for custom filter'),
                value: '!contains'
            },
            { label: gettextCatalog.getString('is not', null, 'Condition for custom filter'), value: '!is' },
            {
                label: gettextCatalog.getString('does not begin with', null, 'Condition for custom filter'),
                value: '!starts'
            },
            {
                label: gettextCatalog.getString('does not end with', null, 'Condition for custom filter'),
                value: '!ends'
            },
            {
                label: gettextCatalog.getString('does not match', null, 'Condition for custom filter'),
                value: '!matches'
            }
        ],
        OPERATORS: [
            { label: gettextCatalog.getString('AND', null, 'Filter modal operators'), value: 'all' },
            { label: gettextCatalog.getString('OR', null, 'Filter modal operators'), value: 'any' }
        ],
        ERROR_PATTERN: gettextCatalog.getString('Text or pattern already included', null, 'Error'),
        FILTER_UPDATED_SUCCESS: gettextCatalog.getString('Filter updated', null, 'Notification'),
        FILTER_CREATED_SUCCESS: gettextCatalog.getString('Filter created', null, 'Notification')
    }));

    /**
     * Filter the list of new Label by type
     * @param  {Array}  options.create List of new label
     * @param  {Integer} type           flag
     * @return {Array}                Copy of the array as we don't want to work on the ref
     */
    const filterNewLabel = ({ create = [] } = {}, type = labelsModel.IS_LABEL) => {
        return angular.copy(create).filter(({ Exclusive }) => Exclusive === type);
    };

    return pmModal({
        controllerAs: 'ctrl',
        templateUrl: require('../../../templates/filter/modal.tpl.html'),
        /* @ngInject */
        controller: function(params, $scope) {
            sieveLint.init();

            const labelsOrdered = labelsModel.get('labels');
            const foldersOrdered = labelsModel.get('folders');
            const ctrl = this;
            const model = angular.copy(params.filter);

            ctrl.isPaid = userType().isPaid;
            ctrl.hasLabels = false;
            ctrl.hasMove = false;
            ctrl.hasMark = false;
            ctrl.hasVacation = false;
            ctrl.folders = foldersOrdered;
            ctrl.types = angular.copy(I18N.TYPES);
            ctrl.comparators = angular.copy(I18N.COMPARATORS);
            ctrl.operators = angular.copy(I18N.OPERATORS);
            /**
             * Open a modal to create a new folder / label
             * @param  {Number} [Exclusive=0]
             */
            function openLabelModal(Exclusive = 0) {
                labelModal.activate({
                    params: {
                        label: { Exclusive },
                        close() {
                            labelModal.deactivate();
                        }
                    }
                });
            }

            /**
             * Prepare the Conditions Model
             * @param {Object}
             * @return {Array}
             */
            function prepareConditions({ Simple = {} } = {}) {
                const { Conditions = [] } = Simple;
                const conditions = Conditions.map(({ Type = {}, Comparator = {}, Values = [], value = '' }) => ({
                    Values: value ? Values.concat([value]) : Values,
                    value: value ? '' : value,
                    Type: _.find(ctrl.types, { value: Type.value }),
                    Comparator: _.find(ctrl.comparators, { value: Comparator.value })
                }));

                if (conditions.length === 0) {
                    conditions.push({
                        Values: [],
                        value: '',
                        Type: ctrl.types[0],
                        Comparator: ctrl.comparators[0]
                    });
                }

                return conditions;
            }

            const findCurrentMoveFolder = (list = []) => {
                const map = labelsModel
                    .get('folders')
                    .reduce((acc, label) => ((acc[label.Name] = label), (acc[label.Path] = label), acc), {});
                const folder = _.find(list, (key) => MAILBOX_IDENTIFIERS[key] || map[key]);
                return folder || '';
            };

            /**
             * Prepare the Actions Model
             * @param {Object}
             * @return {Object} actions
             */
            function prepareActions({ Simple = {} } = {}) {
                const { FileInto = [], Mark = { Read: false, Starred: false }, Vacation = '' } = Simple.Actions || {};
                const move = findCurrentMoveFolder(FileInto);
                const actions = {
                    Labels: labelsOrdered.map((label) => {
                        label.Selected = FileInto.indexOf(label.Path) !== -1 || FileInto.indexOf(label.Name) !== -1;
                        return label;
                    }),
                    Move: move || 'inbox',
                    Vacation,
                    Mark
                };

                ctrl.hasMove = !!move;
                ctrl.hasVacation = !!Vacation;
                ctrl.hasMark = Mark.Read || Mark.Starred;
                ctrl.hasLabels = !!_.filter(actions.Labels, { Selected: true }).length;

                return actions;
            }

            /**
             * Prepare the Operator model
             * @param {Object}
             * @return {Object}
             */
            function prepareOperator({ Simple = {} } = {}) {
                const { value = 'all' } = Simple.Operator || {};
                return _.find(ctrl.operators, { value });
            }

            /**
             * Prepare the ID
             * @param  {String} {ID=''}
             * @return {String}
             */
            function prepareID({ ID = '' } = {}) {
                return ID;
            }

            /**
             * Prepare the Name
             * @param  {String} Name
             * @return {String}
             */
            function prepareName({ Name = '' } = {}) {
                return Name;
            }

            /**
             * Prepare the Status
             * @param  {Integer} Status
             * @return {Integer}
             */
            function prepareStatus({ Status = 1 } = {}) {
                return Status;
            }

            /**
             * Prepare the Version
             * @param {Integer} Version
             * @return {Integer}
             */
            const prepareVersion = ({ Version = FILTER_VERSION } = {}) => Version;

            ctrl.addLabel = () => openLabelModal(0);
            ctrl.addFolder = () => openLabelModal(1);

            ctrl.initialization = () => {
                const { on, unsubscribe } = dispatchers();

                ctrl.filter = {
                    ID: prepareID(model),
                    Name: prepareName(model),
                    Status: prepareStatus(model),
                    Version: prepareVersion(model)
                };

                if (params.mode === 'simple') {
                    ctrl.mode = 'simple';
                    ctrl.filter.Simple = {
                        Operator: prepareOperator(model),
                        Conditions: prepareConditions(model),
                        Actions: prepareActions(model)
                    };
                }

                if (params.mode === 'complex') {
                    ctrl.mode = 'complex';

                    const defaultFilter = sieveTemplates[ctrl.filter.Version] || '';
                    ctrl.filter.Sieve = model ? model.Sieve : defaultFilter;
                }

                if (angular.isObject(ctrl.filter.Simple)) {
                    on('labelsModel', (e, { type, data }) => {
                        if (type === 'cache.update') {
                            $scope.$applyAsync(() => {
                                const newLabels = filterNewLabel(data);
                                const newFolders = filterNewLabel(data, labelsModel.IS_FOLDER);

                                ctrl.filter.Simple.Actions.Labels = ctrl.filter.Simple.Actions.Labels.concat(newLabels);
                                ctrl.folders = ctrl.folders.concat(newFolders);

                                // Select the last new folder
                                if (newFolders.length) {
                                    ctrl.filter.Simple.Actions.Move = _.last(ctrl.folders).Name;
                                }
                            });
                        }
                    });

                    on('autocompleteEmail', (e, { type, data }) => {
                        if (type === 'input.blur' && data.type === 'filter-modal-add-condition-input') {
                            ctrl.addValue(ctrl.filter.Simple.Conditions[Number(data.eventData)]);
                        }
                    });
                }

                const onMouseOverCancel = () => angular.element('#filterName').blur();

                $scope.$on('$destroy', () => {
                    const $close = angular.element('[ng-click="ctrl.cancel()"]');

                    $close.off('mouseover', onMouseOverCancel);
                    unsubscribe();
                });

                $timeout(
                    () => {
                        angular.element('#filterName').focus();
                        const $close = angular.element('[ng-click="ctrl.cancel()"]');
                        $close.on('mouseover', onMouseOverCancel);
                    },
                    100,
                    false
                );
            };

            /**
             * Condition Attachements:
             * When you select an option, assign the valid object to the comparator on change
             * @param  {Object} model
             * @param  {String} value Value selected
             * @return {void}
             */
            ctrl.onChangeAttachements = (model, value) => {
                model.Comparator = _.find(ctrl.comparators, { value });
            };

            ctrl.displaySeparator = () => {
                if (ctrl.filter.Simple) {
                    const conditions = ctrl.filter.Simple.Conditions;
                    return conditions.length > 0 && conditions[0].Type.value !== 'select';
                }

                return false;
            };

            ctrl.addCondition = () => {
                ctrl.filter.Simple.Conditions.push({
                    Type: _.head(ctrl.types),
                    Comparator: _.head(ctrl.comparators),
                    Values: [],
                    value: ''
                });
            };

            ctrl.addValue = (condition, event) => {
                event && event.preventDefault();

                if (condition.Values.indexOf(condition.value) === -1) {
                    if (condition.value) {
                        condition.Values.push(condition.value);
                        condition.value = '';
                    }
                } else {
                    notification.error(I18N.ERROR_PATTERN);
                }
            };

            ctrl.removeCondition = (condition) => {
                const index = ctrl.filter.Simple.Conditions.indexOf(condition);
                ctrl.filter.Simple.Conditions.splice(index, 1);
            };

            /**
             * Create a list of place to move the message
             * @param  {Array}  options.FileInto
             * @param  {String} options.Move
             * @param  {Array}  labels
             * @return {Array}
             */
            const bindActions = ({ FileInto = [], Move = '' } = {}, labels = []) => {
                return _.uniq([Move].filter(Boolean).concat(FileInto, labels));
            };

            const requestUpdate = (data = {}) => {
                const onSuccess = (message = '') => () => {
                    notification.success(message);
                    eventManager.call();
                    params.close();
                };

                const onError = (e) => {
                    const { data = {} } = e;
                    if (data.Code === API_CUSTOM_ERROR_CODES.FILTER_CREATE_TOO_MANY_ACTIVE) {
                        eventManager.call();
                        params.close();
                    }
                    throw e;
                };

                if (data.ID) {
                    return Filter.update(data)
                        .then(onSuccess(I18N.FILTER_UPDATED_SUCCESS))
                        .catch(onError);
                }

                return Filter.create(data)
                    .then(onSuccess(I18N.FILTER_CREATED_SUCCESS))
                    .catch(onError);
            };

            ctrl.resetValidity = () => {
                this.validator = [];
            };

            ctrl.save = async () => {
                const { valid, errors } = await filterValidator(this);

                $scope.$applyAsync(() => {
                    this.validator = errors;
                });

                if (!valid) {
                    return console.log(errors);
                }

                if (params.mode === 'complex') {
                    // we need to wait on codemirror to update the ng-model
                    $timeout(
                        () => {
                            const clone = angular.copy(ctrl.filter);
                            // Disable the old Simple data
                            delete clone.Simple;
                            delete clone.Tree;
                            networkActivityTracker.track(requestUpdate(clone));
                        },
                        100,
                        false
                    );
                    return;
                }

                const clone = angular.copy(ctrl.filter);

                if (Object.keys(ctrl.filter.Simple || {}).length > 0) {
                    if (ctrl.hasMove === false) {
                        clone.Simple.Actions.Move = '';
                    }

                    if (ctrl.hasMark === false) {
                        clone.Simple.Actions.Mark = { Read: false, Starred: false };
                    }

                    if (ctrl.hasVacation === false) {
                        clone.Simple.Actions.Vacation = '';
                    }

                    if (ctrl.hasLabels === true) {
                        const labels = _.filter(clone.Simple.Actions.Labels, ({ Selected }) => Selected === true).map(
                            ({ Path }) => Path
                        );
                        const fileInto = bindActions(clone.Simple.Actions, labels);
                        clone.Simple.Actions.FileInto = fileInto;
                        delete clone.Simple.Actions.Labels;
                    } else {
                        delete clone.Simple.Actions.Labels;
                    }

                    clone.Simple.Actions.FileInto = bindActions(clone.Simple.Actions);
                    delete clone.Simple.Actions.Move;
                    // delete clone.Simple.Actions.Vacation;
                }

                networkActivityTracker.track(requestUpdate(clone));
            };

            ctrl.initialization();
        }
    });
}
export default filterModal;
