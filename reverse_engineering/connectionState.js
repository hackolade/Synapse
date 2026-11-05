const { getConnectionClient } = require('./databaseService/databaseService');

module.exports = {
	_client: null,
	_connectionInfo: {},
	getClient: () => this._client,
	setClient: async (connectionInfo, logger, app) => {
		this._connectionInfo = connectionInfo;
		this._client = await getConnectionClient(connectionInfo, logger, app);
	},
	getConnectionInfo: () => this._connectionInfo,
	clearClient: () => (this._client = null),
};
