import _ from 'lodash';
import { API_CUSTOM_ERROR_CODES } from '../../errors';

const { AUTH_COOKIES_REFRESH_INVALID, AUTH_REFRESH_TOKEN_INVALID } = API_CUSTOM_ERROR_CODES;

/* @ngInject */
function handle401($http, $q, authentication, authApi) {
    let refreshPromise = null;

    const clearPromise = () => (refreshPromise = null);

    const logout = () => {
        clearPromise();
        authentication.logout(true, false);
    };

    const recall = ({ config }) => {
        _.extend(config.headers, $http.defaults.headers.common);

        return $http(config);
    };

    return (rejection) => {
        if (!authentication.existingSession()) {
            logout();
            return $q.reject(rejection);
        }

        if (!refreshPromise) {
            refreshPromise = authApi
                // Don't display this error, the "invalid access token" error will be displayed.
                .refresh({ suppress: [AUTH_COOKIES_REFRESH_INVALID, AUTH_REFRESH_TOKEN_INVALID] })
                .then(clearPromise)
                .catch((e) => {
                    // Any 4xx except 429 (retry) from the refresh route and the session is no longer valid
                    if (e.status >= 400 && e.status <= 499 && e.status !== 429) {
                        logout();
                        // If the refresh call fails, hide the "Refresh cookie fail" error and return "Invalid access token" instead
                        return $q.reject(rejection);
                    }
                    return $q.reject(e);
                });
        }

        return refreshPromise.then(() => recall(rejection));
    };
}
export default handle401;
