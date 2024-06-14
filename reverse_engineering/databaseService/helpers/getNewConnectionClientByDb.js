const sql = require('mssql');

const getNewConnectionClientByDb = async (connectionClient, currentDbName) => {
	if (!connectionClient) {
		throw new Error('Connection client is missing');
	}

	const { database, user, password, port, server, connectTimeout, requestTimeout } = connectionClient.config;
	if (database === currentDbName) {
		return connectionClient;
	}

	return await sql.connect({
		user,
		password,
		server,
		port,
		connectTimeout,
		requestTimeout,
		options: {
			encrypt: true,
		},
		database: currentDbName,
		pool: {
			acquireTimeoutMillis: requestTimeout,
			createRetryIntervalMillis: 400, // default 200
			createTimeoutMillis: requestTimeout,
			destroyTimeoutMillis: 10000, // default 5000
			idleTimeoutMillis: requestTimeout,
			reapIntervalMillis: 2000, // default 1000
		},
	});
};

module.exports = getNewConnectionClientByDb;
