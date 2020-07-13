const { getConnectionClient } = require('./databaseService/databaseService');

module.exports = {
	_client: null,
	_connectionInfo: {},
	getClient: () => this._client,
	setClient: async connectionInfo => {
		this._connectionInfo = connectionInfo;
		this._client = await getConnectionClient(connectionInfo)
	},
	getConnectionInfo: () => this._connectionInfo,
	clearClient: () => this._client = null,
}
