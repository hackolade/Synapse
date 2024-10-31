const { ConnectionPool } = require('mssql');

const sqlserverPrefix = 'jdbc:sqlserver://';

// example: jdbc:sqlserver://synapseworkspace.sql.azuresynapse.net:1433;databaseName=SampleDB;user=myusername@mytenant.onmicrosoft.com;password=myStrongPassword123;encrypt=true;trustServerCertificate=false;authentication=ActiveDirectoryPassword;loginTimeout=30;
const parseSqlServerUrl = ({ url = '' }) => {
	const [_protocol, params] = url.split(sqlserverPrefix);
	const [server, ...paramParts] = params.split(';');
	const [host, port] = server.split(':');

	const parsedParams = paramParts.reduce((acc, part) => {
		const [key, value] = part.split('=');
		if (key && value) {
			acc[key] = value;
		}
		return acc;
	}, {});

	return {
		server: host,
		port: port ? Number(port) : null,
		database: parsedParams.databaseName,
		user: parsedParams.user,
		password: parsedParams.password,
	};
};

// Default connection string example:
// Server=tcp:synapseworkspace.sql.azuresynapse.net,1433;Database=SampleDB;Authentication=Active Directory Password;User ID=myusername@mytenant.onmicrosoft.com;Password=password;Encrypt=true;TrustServerCertificate=false;Connection Timeout=30;
const parseConnectionString = ({ string = '' }) => {
	const params = string.startsWith(sqlserverPrefix)
		? parseSqlServerUrl({ url: string })
		: ConnectionPool.parseConnectionString(string);

	return {
		databaseName: params.database,
		host: params.server,
		port: params.port,
		userName: params.user,
		userPassword: params.password,
	};
};

module.exports = {
	parseConnectionString,
};
