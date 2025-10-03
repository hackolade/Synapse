const { hckFetch } = require('@hackolade/fetch');
const { parseResponse } = require('./parseResponse');

async function getTokenData({ tenantId, clientId, appSecret }) {
	const tokenBaseURl = `https://login.microsoftonline.com/${tenantId}/oauth2/token`;
	const urlParams = new URLSearchParams();

	urlParams.append('client_id', clientId);
	urlParams.append('client_secret', appSecret);
	urlParams.append('grant_type', 'client_credentials');
	urlParams.append('resource', 'https://management.azure.com/');

	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: urlParams,
	};

	const response = await hckFetch(tokenBaseURl, options);

	return parseResponse(response);
}

async function getAccountData({ subscriptionId, resourceGroupName, serverName, tokenData }) {
	const dbAccountBaseUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Sql/servers/${serverName}?api-version=2019-06-01-preview`;
	const options = {
		headers: {
			'Authorization': `${tokenData.token_type} ${tokenData.access_token}`,
		},
	};

	const response = await hckFetch(dbAccountBaseUrl, options);

	return parseResponse(response);
}

async function getLocationsData({ subscriptionId, tokenData }) {
	const locationsUrl = `https://management.azure.com/subscriptions/${subscriptionId}/locations?api-version=2020-06-01`;
	const options = {
		headers: {
			'Authorization': `${tokenData.token_type} ${tokenData.access_token}`,
		},
	};

	const response = await hckFetch(locationsUrl, options);

	return parseResponse(response);
}

async function getAdditionalAccountInfo(_, connectionInfo, logger) {
	if (!connectionInfo.includeAccountInformation) {
		return {};
	}

	logger.log('info', {}, 'Account additional info', connectionInfo.hiddenKeys);

	try {
		const { clientId, appSecret, tenantId, subscriptionId, resourceGroupName, host } = connectionInfo;
		const accNameRegex = /(?:https:\/\/)?(.+)\.(?:documents|database).+/i;
		const serverName = accNameRegex.test(host) ? accNameRegex.exec(host)[1] : '';

		const tokenData = await getTokenData({ tenantId, clientId, appSecret });
		const accountData = await getAccountData({ subscriptionId, resourceGroupName, serverName, tokenData });
		const locationsData = await getLocationsData({ subscriptionId, tokenData });

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
