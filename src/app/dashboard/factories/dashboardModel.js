import _ from 'lodash';

import { PLANS, CYCLE } from '../../constants';

const { PLUS, PROFESSIONAL, VISIONARY, VPN_BASIC, VPN_PLUS } = PLANS.PLAN;
const MAIL_PLANS = ['free', PLUS, PROFESSIONAL, VISIONARY];
const { ADDRESS, MEMBER, DOMAIN, SPACE, VPN } = PLANS.ADDON;
const { MONTHLY, YEARLY, TWO_YEARS } = CYCLE;

/* @ngInject */
function dashboardModel(
    $filter,
    dashboardConfiguration,
    dispatchers,
    downgrade,
    PaymentCache,
    paymentModal,
    subscriptionModel,
    networkActivityTracker,
    paymentModel,
    planListGenerator
) {
    const { dispatcher, on } = dispatchers(['dashboard']);
    const CACHE_PLAN = {};
    const filter = (amount) =>
        $filter('currency')(amount / 100 / dashboardConfiguration.cycle(), dashboardConfiguration.currency());
    const get = (key) => {
        const cache = angular.copy(CACHE_PLAN);
        return key ? cache[key] : cache;
    };

    const changeAddon = (plan, addon, value) => {
        dashboardConfiguration.addon(plan, addon, value);
        dispatcher.dashboard('addon.updated', { plan, addon, value });
    };

    const selectVpn = (plan = '', vpn = 0) => {
        dashboardConfiguration.addon('free', 'vpnbasic', +(plan === 'vpnbasic'));
        dashboardConfiguration.addon('free', 'vpnplus', +(plan === 'vpnplus'));
        dashboardConfiguration.addon('plus', 'vpnbasic', +(plan === 'vpnbasic'));
        dashboardConfiguration.addon('plus', 'vpnplus', +(plan === 'vpnplus'));
        dashboardConfiguration.addon('professional', 'vpnbasic', +(plan === 'vpnbasic'));
        dashboardConfiguration.addon('professional', 'vpnplus', +(plan === 'vpnplus'));
        dashboardConfiguration.addon('professional', 'vpn', vpn);
        dispatcher.dashboard('vpn.updated');
    };

    const removeVpn = () => {
        dashboardConfiguration.addon('free', 'vpnbasic', 0);
        dashboardConfiguration.addon('free', 'vpnplus', 0);
        dashboardConfiguration.addon('plus', 'vpnbasic', 0);
        dashboardConfiguration.addon('plus', 'vpnplus', 0);
        dashboardConfiguration.addon('professional', 'vpnbasic', 0);
        dashboardConfiguration.addon('professional', 'vpnplus', 0);
        dashboardConfiguration.addon('professional', 'vpn', 0);
        dispatcher.dashboard('vpn.updated');
    };

    /**
     * Update VPN addons from subscription
     */
    const updateVpn = () => {
        const vpnbasic = +subscriptionModel.hasPaid('vpnbasic');
        const vpnplus = +subscriptionModel.hasPaid('vpnplus');
        const vpn = subscriptionModel.count('vpn');

        dashboardConfiguration.addon('free', 'vpnbasic', vpnbasic);
        dashboardConfiguration.addon('free', 'vpnplus', vpnplus);
        dashboardConfiguration.addon('plus', 'vpnbasic', vpnbasic);
        dashboardConfiguration.addon('plus', 'vpnplus', vpnplus);
        dashboardConfiguration.addon('professional', 'vpnbasic', vpnbasic);
        dashboardConfiguration.addon('professional', 'vpnplus', vpnplus);
        dashboardConfiguration.addon('professional', 'vpn', vpn);
        dispatcher.dashboard('vpn.updated');
    };

    const initVpn = (plan = '') => {
        dashboardConfiguration.addon(plan, 'vpnbasic', +subscriptionModel.hasPaid('vpnbasic'));
        dashboardConfiguration.addon(plan, 'vpnplus', +subscriptionModel.hasPaid('vpnplus'));
        plan === 'professional' && dashboardConfiguration.addon(plan, 'vpn', subscriptionModel.count('vpn'));
        dispatcher.dashboard('vpn.updated', { plan });
    };

    const collectPlans = (plan) => {
        const cache = CACHE_PLAN[dashboardConfiguration.cycle()];
        return planListGenerator[plan](cache);
    };

    const selectPlan = (plan, choice) => {
        const plans = collectPlans(plan);

        if (plan === 'free' && !plans.length) {
            return downgrade();
        }

        const Cycle = dashboardConfiguration.cycle();
        const Currency = dashboardConfiguration.currency();

        const PlanIDs = plans.reduce((acc, cur) => {
            const { ID } = cur;
            acc[ID] = (acc[ID] || 0) + 1;
            return acc;
        }, {});

        const CouponCode = subscriptionModel.coupon();

        const checkPromise = PaymentCache.valid({ PlanIDs, Currency, Cycle, CouponCode }).then((result) => {
            /**
             * If the coupon is invalid, make another request without any coupon for the api to automatically apply the fallback coupon.
             * Does not compare the actual coupon received, just checks that that the coupon received is null. This is to enable compatibility
             * if the API adds support for falling back automatically.
             */
            if (CouponCode && !result.Coupon) {
                return PaymentCache.valid({ PlanIDs, Currency, Cycle });
            }
            return result;
        });

        const promise = Promise.all([PaymentCache.plans(), checkPromise]).then(([plans, valid]) => {
            paymentModal.activate({
                params: {
                    planIDs: PlanIDs,
                    valid,
                    choice,
                    plans,
                    plan,
                    cancel() {
                        paymentModal.deactivate();
                    }
                }
            });
        });

        networkActivityTracker.track(promise);
    };

    /**
     * Load plan for a cycle and a currency, then create a map for them
     *  - addons: (Type === 0)
     *  - plan: (Type === 1)
     *  - vpn: (Type === 1)
     *  And a list of plan, ProtonMail plan (not vpn)
     *  And a map between Name and Amount
     * @param  {String} Currency
     * @param  {Number} Cycle
     * @return {Promise}
     */
    const loadPlanCycle = (Currency, Cycle = YEARLY) => {
        return PaymentCache.plans({ Currency, Cycle }).then((Plans = []) => {
            const { list, addons, plan, amounts } = Plans.reduce(
                (acc, plan) => {
                    acc.amounts[plan.Name] = plan.Amount;

                    if (_.includes(MAIL_PLANS, plan.Name)) {
                        acc.plan[plan.Name] = plan;
                        acc.list.push(plan);
                        return acc;
                    }

                    acc.addons[plan.Name] = plan;

                    return acc;
                },
                { addons: {}, plan: {}, list: [], amounts: {} }
            );

            return { list, addons, plan, amounts };
        });
    };

    /**
     * Load all plans for a currency then create a cache representation
     * for them sorted by Cycle alias.
     *  - 2-years = cycle = 24
     *  - yearly = cycle = 12
     *  - monthly = cycle = 1
     * Each key contains 4 keys with 3 maps and a list.
     * @param  {String} Currency
     * @return {Promise}
     */
    const loadPlans = (Currency = dashboardConfiguration.currency()) => {
        const promise = Promise.all([
            loadPlanCycle(Currency),
            loadPlanCycle(Currency, MONTHLY),
            loadPlanCycle(Currency, TWO_YEARS)
        ]).then(([yearly, monthly, twoYears]) => {
            CACHE_PLAN[YEARLY] = angular.copy(yearly);
            CACHE_PLAN[MONTHLY] = angular.copy(monthly);
            CACHE_PLAN[TWO_YEARS] = angular.copy(twoYears);
            return angular.copy(CACHE_PLAN);
        });

        networkActivityTracker.track(promise);
        return promise;
    };

    const changeCurrency = (currency) => {
        loadPlans(currency).then((data) => {
            dashboardConfiguration.set('currency', currency);
            dispatcher.dashboard('currency.updated', _.extend(data, { currency }));
        });
    };

    /**
     * Get amounts for each plans
     * @param  {Number} cycle
     * @return {Object}
     */
    const amounts = (cycle = dashboardConfiguration.cycle()) => angular.copy(CACHE_PLAN[cycle].amounts);

    /**
     * Get addon amount for the current dashboard configuration
     * @param  {Object}
     * @return {Integer}
     */
    const amount = ({ config = dashboardConfiguration.get(), plan, addon, cycle = dashboardConfiguration.cycle() }) => {
        switch (addon) {
            case 'vpn':
                return CACHE_PLAN[cycle].amounts[VPN] * config[plan].vpn;
            case 'address':
                return CACHE_PLAN[cycle].amounts[ADDRESS] * config[plan].address;
            case 'space':
                return CACHE_PLAN[cycle].amounts[SPACE] * config[plan].space;
            case 'domain':
                return CACHE_PLAN[cycle].amounts[DOMAIN] * config[plan].domain;
            case 'member':
                return CACHE_PLAN[cycle].amounts[MEMBER] * config[plan].member;
            case 'vpnbasic':
                return CACHE_PLAN[cycle].amounts[VPN_BASIC] * config[plan].vpnbasic;
            case 'vpnplus':
                return CACHE_PLAN[cycle].amounts[VPN_PLUS] * config[plan].vpnplus;
        }

        switch (plan) {
            case 'plus':
            case 'professional':
            case 'visionary':
                return CACHE_PLAN[cycle].amounts[plan];
            default:
                return 0;
        }
    };

    /**
     * Get plan total
     * @param  {[type]} plan  [description]
     * @param  {[type]} cycle [description]
     * @return {[type]}       [description]
     */
    const total = (plan, cycle) => {
        const config = dashboardConfiguration.get();
        let result = 0;

        switch (plan) {
            case 'free':
                result += amount({ config, plan, cycle, addon: VPN_BASIC });
                result += amount({ config, plan, cycle, addon: VPN_PLUS });
                break;
            case 'plus':
                result += amount({ config, plan, cycle });
                result += amount({ config, plan, cycle, addon: 'address' });
                result += amount({ config, plan, cycle, addon: 'space' });
                result += amount({ config, plan, cycle, addon: 'domain' });
                result += amount({ config, plan, cycle, addon: VPN_BASIC });
                result += amount({ config, plan, cycle, addon: VPN_PLUS });
                result *= config[plan].vpnbasic || config[plan].vpnplus ? 0.8 : 1;
                break;
            case 'professional':
                result += amount({ config, plan, cycle });
                result += amount({ config, plan, cycle, addon: 'member' });
                result += amount({ config, plan, cycle, addon: 'domain' });
                result += amount({ config, plan, cycle, addon: VPN_BASIC });
                result += amount({ config, plan, cycle, addon: VPN_PLUS });
                result += amount({ config, plan, cycle, addon: 'vpn' });
                result *= config[plan].vpnbasic || config[plan].vpnplus ? 0.8 : 1;
                break;
            case 'visionary':
                result += amount({ config, plan, cycle });
                break;
        }

        return result;
    };

    const changeCycle = (cycle) => {
        dashboardConfiguration.set('cycle', cycle);
        dispatcher.dashboard('cycle.updated', { cycle });
    };

    on('subscription', (event, { type = '' }) => {
        if (type === 'update') {
            updateVpn();
            changeCycle(subscriptionModel.cycle());
            changeCurrency(subscriptionModel.currency());
        }
    });

    on('dashboard', (event, { type, data = {} }) => {
        type === 'change.cycle' && changeCycle(data.cycle);
        type === 'change.currency' && changeCurrency(data.currency);
        type === 'change.addon' && changeAddon(data.plan, data.addon, data.value);
        type === 'select.plan' && selectPlan(data.plan);
        type === 'select.vpn' && selectVpn(data.plan, data.vpn);
        type === 'remove.vpn' && removeVpn();
        type === 'init.vpn' && initVpn(data.plan);
    });

    on('modal.payment', (e, { type, data }) => {
        if (type === 'process.success') {
            const promise = Promise.all([subscriptionModel.fetch(), paymentModel.getMethods(true)]);
            networkActivityTracker.track(promise);
        }

        if (type === 'switch') {
            const { Cycle, Currency, plan } = data;

            paymentModal.deactivate();
            dashboardConfiguration.set('currency', Currency);
            dashboardConfiguration.set('cycle', Cycle);

            loadPlanCycle(Currency, Cycle).then(() => {
                selectPlan(plan);
            });
        }
    });

    return { init: angular.noop, loadPlans, get, amount, amounts, total, filter };
}
export default dashboardModel;
