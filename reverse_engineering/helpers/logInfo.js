const os = require('os');
const packageFile = require('../../package.json');

const prefixZero = number => (number < 10 ? '0' + number : number);

const maxClock = cpus => {
	return cpus.reduce((highestClock, cpu) => Math.max(highestClock, cpu.speed), 0);
};

const toTime = number => {
	return Math.floor(number / 3600) + ':' + prefixZero(parseInt((number / 3600 - Math.floor(number / 3600)) * 60));
};

const getPluginVersion = () => packageFile.version;

const getSystemInfo = appVersion => {
	return (
		'' +
		`Date: ${new Date()}` +
		'\n' +
		`Application version: ${appVersion}` +
		'\n' +
		`Plugin version: ${getPluginVersion()}` +
		'\n\n' +
		`System information:` +
		'\n' +
		` Hostname:  ${os.hostname()}` +
		'\n' +
		` Platform:  ${os.platform()} ${os.arch()}` +
		'\n' +
		` Release:   ${os.release()}` +
		'\n' +
		` Uptime:    ${toTime(os.uptime())}` +
		'\n' +
		` Total RAM: ${(os.totalmem() / 1073741824).toFixed(2)} GB` +
		'\n' +
		` CPU Model: ${os.cpus()[0].model}` +
		'\n' +
		` CPU Clock: ${maxClock(os.cpus())} MHZ` +
		'\n' +
		` CPU Cores: ${os.cpus().length} cores` +
		'\n\n'
	);
};

const logInfo = (step, connectionInfo, logger) => {
	logger.clear();
	logger.log('info', getSystemInfo(connectionInfo.appVersion), step);
	logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);
};

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
	logInfo,
	logAuthTokenInfo,
	logConnectionHostAndUsername,
	progress,
	logError,
};
