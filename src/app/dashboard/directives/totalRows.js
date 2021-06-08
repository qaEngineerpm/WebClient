import { CYCLE } from '../../constants';

const { MONTHLY, YEARLY, TWO_YEARS } = CYCLE;

/* @ngInject */
function totalRows($filter, dashboardConfiguration, dashboardModel, dispatchers, gettextCatalog, translator) {
    const I18N = translator(() => ({
        billedAs(amount, cycle) {
            if (cycle === YEARLY) {
                return gettextCatalog.getString('Billed as {{amount}} /yr', { amount }, 'Info');
            }

            if (cycle === TWO_YEARS) {
                return gettextCatalog.getString('Billed as {{amount}} /2-yr', { amount }, 'Info');
            }

            return '';
        }
    }));

    const types = ['addon.updated', 'cycle.updated', 'currency.updated', 'vpn.updated'];
    const amount = (plan, cycle, currency, division) =>
        $filter('currency')(dashboardModel.total(plan, cycle) / 100 / division, currency);

    return {
        restrict: 'E',
        replace: true,
        scope: {},
        templateUrl: require('../../../templates/dashboard/totalRows.tpl.html'),
        link(scope, element, { plan }) {
            const { dispatcher, on, unsubscribe } = dispatchers(['dashboard']);
            const monthly = element.find('.totalRows-monthly-price');
            const yearly = element.find('.totalRows-yearly-price');
            const yearlyBilled = element.find('.totalRows-yearly-billed-price');
            const twoYears = element.find('.totalRows-2-years-price');
            const twoYearsBilled = element.find('.totalRows-2-years-billed-price');

            scope.onChange = () => dispatcher.dashboard('change.cycle', { cycle: scope.cycle });

            function update() {
                scope.$applyAsync(() => {
                    monthly.text(amount(plan, MONTHLY, dashboardConfiguration.currency(), MONTHLY));
                    yearly.text(amount(plan, YEARLY, dashboardConfiguration.currency(), YEARLY));
                    twoYears.text(amount(plan, TWO_YEARS, dashboardConfiguration.currency(), TWO_YEARS));
                    yearlyBilled.text(
                        I18N.billedAs(amount(plan, YEARLY, dashboardConfiguration.currency(), MONTHLY), YEARLY)
                    );
                    twoYearsBilled.text(
                        I18N.billedAs(amount(plan, TWO_YEARS, dashboardConfiguration.currency(), MONTHLY), TWO_YEARS)
                    );
                    scope.cycle = dashboardConfiguration.cycle();
                });
            }

            on('dashboard', (event, { type = '' }) => {
                types.indexOf(type) > -1 && update();
            });

            update();

            scope.$on('$destroy', unsubscribe);
        }
    };
}
export default totalRows;
