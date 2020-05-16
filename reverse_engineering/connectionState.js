const { getConnectionClient } = require('./databaseService/databaseService');

module.exports = {
	_client: null,
	getClient: () => this._client,
	setClient: async connectionInfo => this._client = await getConnectionClient(connectionInfo),
	clearClient: () => this._client = null,
}
