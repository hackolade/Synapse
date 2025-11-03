const revEngApi = require('../../reverse_engineering/api');

async function getExternalBrowserUrl(connectionInfo, logger, cb, app) {
	return revEngApi.getExternalBrowserUrl(connectionInfo, logger, cb, app);
}

module.exports = {
	getExternalBrowserUrl,
};
