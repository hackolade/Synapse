const { logInfo } = require('../../reverse_engineering/helpers/logInfo');
const { getExternalBrowserUrl, connect } = require('../../reverse_engineering/api');

async function testConnection(connectionInfo, logger, callback, app) {
	try {
		logInfo('Test connection', connectionInfo, logger);
		if (connectionInfo.authMethod === 'Azure Active Directory (MFA)') {
			await getExternalBrowserUrl(connectionInfo, logger, callback);
		} else {
			await connect(connectionInfo, logger);
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
