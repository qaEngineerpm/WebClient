import _ from 'lodash';
import { flow, filter, reduce, each } from 'lodash/fp';

import { CYCLE, PLANS_TYPE, BASE_SIZE } from '../../constants';

const { MONTHLY, YEARLY, TWO_YEARS } = CYCLE;

/* @ngInject */
function subscriptionSection(dispatchers, subscriptionModel, gettextCatalog, translator) {
    const I18N = translator(() => ({
        vpn: gettextCatalog.getString('VPN connections', null, 'Label'),
        addresses: gettextCatalog.getString('addresses', null, 'Label'),
        domain: gettextCatalog.getString('domain', null, 'Label'),
        domains: gettextCatalog.getString('domains', null, 'Label'),
        member: gettextCatalog.getString('user', null, 'Label'),
        members: gettextCatalog.getString('users', null, 'Label'),
        cycles: {
            [MONTHLY]: gettextCatalog.getString('Monthly', null, 'Label'),
            [YEARLY]: gettextCatalog.getString('Annually', null, 'Label'),
            [TWO_YEARS]: gettextCatalog.getString('2-years', null, 'Label')
        },
        methods: {
            card: gettextCatalog.getString('Credit card', null, 'Label'),
            paypal: 'Paypal'
        }
    }));

    const formatSubscription = (sub = {}) => {
        sub.cycle = I18N.cycles[sub.Cycle];
        sub.plans = _.reduce(
            sub.Plans,
            (acc, plan) => {
                if (plan.Type === PLANS_TYPE.PLAN) {
                    plan.addons = extractAddons(sub.Plans, plan.Name.indexOf('vpn') > -1);
                    acc.push(plan);
                }
                return acc;
            },
            []
        );
        return sub;
    };

    const getFirstMethodType = (methods = []) => (methods.length ? I18N.methods[methods[0].Type] : 'None');
    const fromBase = (value) => value / BASE_SIZE ** 3;

    function formatTitle(plan = {}) {
        switch (plan.Name) {
            case '1vpn':
                plan.Title = `+ ${plan.Quantity * plan.MaxVPN} ${I18N.vpn}`;
                break;
            case '1gb':
                plan.Title = `+ ${plan.Quantity * fromBase(plan.MaxSpace)} GB`;
                break;
            case '5address':
                plan.Title = `+ ${plan.Quantity * plan.MaxAddresses} ${I18N.addresses}`;
                break;
            case '1domain':
                plan.Title = `+ ${plan.Quantity * plan.MaxDomains} ${plan.Quantity > 1 ? I18N.domains : I18N.domain}`;
                break;
            case '1member':
                plan.Title = `+ ${plan.Quantity * plan.MaxMembers} ${plan.Quantity > 1 ? I18N.members : I18N.member}`;
                break;
            default:
                break;
        }
    }

    function extractAddons(plans = [], vpn = false) {
        return flow(
            filter({ Type: 0 }),
            reduce((acc, plan) => {
                if (vpn === plan.Name.indexOf('vpn') > -1) {
                    if (acc[plan.Name]) {
                        acc[plan.Name].Amount += plan.Amount;
                    } else {
                        acc[plan.Name] = plan;
                    }
                }

                return acc;
            }, {}),
            each((plan) => formatTitle(plan))
        )(plans);
    }

    return {
        scope: { methods: '=' },
        restrict: 'E',
        replace: true,
        templateUrl: require('../../../templates/dashboard/subscriptionSection.tpl.html'),
        link(scope) {
            const { on, unsubscribe } = dispatchers();
            const subscription = subscriptionModel.get();

            on('subscription', (event, { type, data = {} }) => {
                if (type === 'update') {
                    scope.$applyAsync(() => {
                        scope.subscription = formatSubscription(data.subscription);
                    });
                }
            });

            scope.subscription = formatSubscription(subscription);
            scope.method = getFirstMethodType(scope.methods);

            scope.$on('$destroy', unsubscribe);
        }
    };
}
export default subscriptionSection;
