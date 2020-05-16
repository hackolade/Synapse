const sql = require('mssql');

const getNewConnectionClientByDb = async (connectionClient, currentDbName) => {
	if (!connectionClient) {
		throw new Error('Connection client is missing');
	}

	const { database, user, password, port, server } = connectionClient.config;
	if (database === currentDbName) {
		return connectionClient;
	}

	return await sql.connect({
		user,
		password,
		server,
		port,
		options: {
			encrypt: true,
		},
		database: currentDbName,
	});
};

module.exports = getNewConnectionClientByDb;
