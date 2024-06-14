const qs = require('qs');
const axios = require('axios');

async function getAdditionalAccountInfo(_, connectionInfo, logger) {
	if (!connectionInfo.includeAccountInformation) {
		return {};
	}

	logger.log('info', {}, 'Account additional info', connectionInfo.hiddenKeys);

	try {
		const { clientId, appSecret, tenantId, subscriptionId, resourceGroupName, host } = connectionInfo;
		const accNameRegex = /(?:https:\/\/)?(.+)\.(?:documents|database).+/i;
		const serverName = accNameRegex.test(host) ? accNameRegex.exec(host)[1] : '';
		const tokenBaseURl = `https://login.microsoftonline.com/${tenantId}/oauth2/token`;
		const { data: tokenData } = await axios({
			method: 'post',
			url: tokenBaseURl,
			data: qs.stringify({
				grant_type: 'client_credentials',
				client_id: clientId,
				client_secret: appSecret,
				resource: 'https://management.azure.com/',
			}),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const dbAccountBaseUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Sql/servers/${serverName}?api-version=2019-06-01-preview`;
		const { data: accountData } = await axios({
			method: 'get',
			url: dbAccountBaseUrl,
			headers: {
				'Authorization': `${tokenData.token_type} ${tokenData.access_token}`,
			},
		});
		const locationsUrl = `https://management.azure.com/subscriptions/${subscriptionId}/locations?api-version=2020-06-01`;
		const { data: locationsData } = await axios({
			method: 'get',
			url: locationsUrl,
			headers: {
				'Authorization': `${tokenData.token_type} ${tokenData.access_token}`,
			},
		});
		const preferredLocationData = _.get(locationsData, 'value', []).find(location => {
			return location.name === accountData.location;
		});
		logger.progress({
			message: 'Getting account information',
			containerName: connectionInfo.databaseName,
			entityName: '',
		});
		return {
			enableMultipleWriteLocations: accountData.properties.enableMultipleWriteLocations,
			enableAutomaticFailover: accountData.properties.enableAutomaticFailover,
			isVirtualNetworkFilterEnabled: accountData.properties.isVirtualNetworkFilterEnabled,
			virtualNetworkRules: _.get(accountData, 'properties.virtualNetworkRules', []).map(
				({ id, ignoreMissingVNetServiceEndpoint }) => ({
					virtualNetworkId: id,
					ignoreMissingVNetServiceEndpoint,
				}),
			),
			preferredLocation: _.get(preferredLocationData, 'displayName', ''),
			ipRangeFilter: accountData.properties.ipRangeFilter,
			tags: Object.entries(_.get(accountData, 'tags', {})).map(([tagName, tagValue]) => ({ tagName, tagValue })),
			locations: _.get(accountData, 'properties.locations', []).map(
				({ id, locationName, failoverPriority, isZoneRedundant }) => ({
					locationId: id,
					locationName,
					failoverPriority,
					isZoneRedundant,
				}),
			),
		};
	} catch (err) {
		logger.log('error', { message: _.get(err, 'response.data.error.message', err.message), stack: err.stack });
		logger.progress({
			message: 'Error while getting account information',
			containerName: connectionInfo.databaseName,
		});
		return {};
	}
}

module.exports = getAdditionalAccountInfo;
