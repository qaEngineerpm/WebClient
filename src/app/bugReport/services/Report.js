/* @ngInject */
function Report($http, url, gettextCatalog, requestFormData) {
    const requestURL = url.build('reports');

    const handleSuccess = ({ data = {} } = {}) => data;

    const phishing = (data) => {
        return $http.post(requestURL('phishing'), data).then(handleSuccess);
    };

    const bug = (data) => {
        const request =
            data instanceof FormData
                ? requestFormData('POST', requestURL('bug'), data)
                : $http.post(requestURL('bug'), data);

        return request.then(handleSuccess);
    };

    return { bug, phishing };
}
export default Report;
