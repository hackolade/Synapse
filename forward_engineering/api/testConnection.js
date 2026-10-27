const { logInfo } = require('../../reverse_engineering/helpers/logInfo');
const { shouldUseExternalBrowser } = require('../../reverse_engineering/helpers/mfaAccessToken');
const { getExternalBrowserUrl, connect } = require('../../reverse_engineering/api');

async function testConnection(connectionInfo, logger, callback, app) {
	try {
		logInfo('Test connection', connectionInfo, logger);
		if (shouldUseExternalBrowser({ app, connectionInfo })) {
			await getExternalBrowserUrl(connectionInfo, logger, callback);
		} else {
			await connect(connectionInfo, logger, undefined, app);
		}
		callback(null);
	} catch (error) {
		logger.log('error', { message: error.message, stack: error.stack, error }, 'Test connection');
		callback({ message: error.message, stack: error.stack });
	}
}

module.exports = {
	testConnection,
};
