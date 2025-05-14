const os = require('os');
const packageFile = require('../../package.json');

const logAuthTokenInfo = ({ token, logger }) => {
	const tokenType = typeof token;
	const tokenLength = tokenType === 'string' ? `(${token.length})` : '';
	logger.log('info', { token }, `MFA token is of type ${tokenType}${tokenLength}`, ['token']);
};

const logConnectionHostAndUsername = ({ hostname, username, authMethod, logger }) => {
	const hostnameToDisplay = hostname ?? 'absent';
	const usernameToDisplay = username ?? 'absent';

	logger.log(
		'info',
		`hostname: ${hostnameToDisplay}, username: ${usernameToDisplay}, auth method: ${authMethod}`,
		'Auth info',
	);
};

const progress = (logger, message, dbName = '', entityName = '') => {
	logger.progress({ message, containerName: dbName, entityName });
	logger.log('info', { message: `[info] ${message}` }, `${dbName}${entityName ? '.' + entityName : ''}`);
};

const logError = (logger, step) => error => {
	logger.log('error', { type: 'error', step, message: error.message, error }, '');
};

module.exports = {
	logAuthTokenInfo,
	logConnectionHostAndUsername,
	progress,
	logError,
};
