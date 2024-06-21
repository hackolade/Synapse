'use strict';

const { BasePool } = require('mssql');
const { getClient, setClient, clearClient, getConnectionInfo } = require('./connectionState');
const { getObjectsFromDatabase } = require('./databaseService/databaseService');
const {
	reverseCollectionsToJSON,
	mergeCollectionsWithViews,
	getCollectionsRelationships,
} = require('./reverseEngineeringService/reverseEngineeringService');
const logInfo = require('./helpers/logInfo');
const filterRelationships = require('./helpers/filterRelationships');
const getOptionsFromConnectionInfo = require('./helpers/getOptionsFromConnectionInfo');
const getAdditionalAccountInfo = require('./helpers/getAdditionalAccountInfo');
const crypto = require('crypto');
const randomstring = require('randomstring');
const base64url = require('base64url');

module.exports = {
	async connect(connectionInfo, logger, callback, app) {
		const client = getClient();
		if (!client) {
			await setClient(connectionInfo, logger);
			return getClient();
		}

		return client;
	},

	disconnect(connectionInfo, logger, cb, app) {
		clearClient();
		cb();
	},

	async testConnection(connectionInfo, logger, callback, app) {
		try {
			logInfo('Test connection', connectionInfo, logger);
			if (connectionInfo.authMethod === 'Azure Active Directory (MFA)') {
				await this.getExternalBrowserUrl(connectionInfo, logger, callback);
			} else {
				await this.connect(connectionInfo, logger);
			}
			callback(null);
		} catch (error) {
			logger.log('error', { message: error.message, stack: error.stack, error }, 'Test connection');
			callback({ message: error.message, stack: error.stack });
		}
	},

	async getExternalBrowserUrl(connectionInfo, logger, cb, app) {
		logInfo('Get external browser URL', connectionInfo, logger);
		const verifier = randomstring.generate(32);
		const base64Digest = crypto.createHash('sha256').update(verifier).digest('base64');
		const challenge = base64url.fromBase64(base64Digest);
		const tenantId = connectionInfo.connectionTenantId || connectionInfo.tenantId || 'common';
		const clientId = '0dc36597-bc44-49f8-a4a7-ae5401959b85';
		const loginHint = connectionInfo.loginHint ? `login_hint=${encodeURIComponent(connectionInfo.loginHint)}&` : '';
		const redirectUrl = `http://localhost:${connectionInfo.redirectPort || 8080}`;

		cb(null, {
			proofKey: verifier,
			url: `https://login.microsoftonline.com/${tenantId}/oauth2/authorize?${loginHint}code_challenge_method=S256&code_challenge=${challenge}&response_type=code&response_mode=query&client_id=${clientId}&redirect_uri=${redirectUrl}&prompt=select_account&resource=https://database.windows.net/`,
		});
	},

	getDatabases(connectionInfo, logger, callback, app) {
		callback();
	},

	getDocumentKinds(connectionInfo, logger, callback, app) {
		callback();
	},

	async getDbCollectionsNames(connectionInfo, logger, callback, app) {
		try {
			logInfo('Retrieving databases and tables information', connectionInfo, logger);
			const client = await this.connect(connectionInfo, logger);
			if (!client.config.database) {
				throw new Error('No database specified');
			}

			const objects = await getObjectsFromDatabase(client);
			callback(null, objects);
		} catch (error) {
			logger.log(
				'error',
				{ message: error.message, stack: error.stack, error },
				'Retrieving databases and tables information',
			);
			callback({ message: error.message, stack: error.stack });
		}
	},

	async getDbCollectionsData(collectionsInfo, logger, callback, app) {
		try {
			const _ = app.require('lodash');
			logger.log('info', collectionsInfo, 'Retrieving schema', collectionsInfo.hiddenKeys);
			logger.progress({ message: 'Start reverse-engineering process', containerName: '', entityName: '' });
			const { collections } = collectionsInfo.collectionData;
			const client = getClient();
			if (!client.config.database) {
				throw new Error('No database specified');
			}

			const reverseEngineeringOptions = getOptionsFromConnectionInfo(collectionsInfo);
			const additionalCollectionInfo = getConnectionInfo();
			const additionalAccountInfo = await getAdditionalAccountInfo(_, additionalCollectionInfo, logger);

			const modelInfo = Object.assign(
				{
					accountID: additionalCollectionInfo.clientId,
					tenant: additionalCollectionInfo.connectionTenantId || additionalCollectionInfo.tenantId,
					resGrp: additionalCollectionInfo.resourceGroupName,
					subscription: additionalCollectionInfo.subscriptionId,
				},
				additionalAccountInfo,
			);

			logger.log('info', modelInfo, 'Model info', collectionsInfo.hiddenKeys);
			const [jsonSchemas, relationships] = await Promise.all([
				await reverseCollectionsToJSON(logger)(client, collections, reverseEngineeringOptions),
				await getCollectionsRelationships(logger)(client, collections),
			]);
			callback(
				null,
				mergeCollectionsWithViews(jsonSchemas),
				modelInfo,
				filterRelationships(relationships, jsonSchemas),
			);
		} catch (error) {
			logger.log(
				'error',
				{ message: error.message, stack: error.stack, error },
				'Reverse-engineering process failed',
			);
			callback({ message: error.message, stack: error.stack });
		}
	},

	parseConnectionString({ connectionString = '' }, logger, callback) {
		try {
			const parsedConnectionStringData = BasePool.parseConnectionString(connectionString);

			// for better UX. In Synapse UI the connection string may start from the "jdbc:sqlserver://...",
			// which is not handled by the mssql lib parser
			if (!parsedConnectionStringData.server) {
				const hostRegExp = /\/\/(.*?):\d+/;
				const match = connectionString.match(hostRegExp);
				if (match) {
					parsedConnectionStringData.server = match[1];
				}
			}

			// for better UX. Mssql lib is trying to pick the user from other parsed props:
			// parsed.uid || parsed.uid || parsed['user id']
			if (!parsedConnectionStringData.user) {
				const userRegExp = /user=(.*?);/;
				const match = connectionString.match(userRegExp);
				if (match) {
					parsedConnectionStringData.user = match[1];
				}
			}

			const parsedData = {
				databaseName: parsedConnectionStringData.database,
				host: parsedConnectionStringData.server,
				port: parsedConnectionStringData.port,
				authMethod: 'Username / Password',
				userName: parsedConnectionStringData.user,
				userPassword: parsedConnectionStringData.password,
			};
			callback(null, { parsedData });
		} catch (err) {
			logger.log('error', { message: err.message, stack: err.stack, err }, 'Parsing connection string failed');
			callback({ message: err.message, stack: err.stack });
		}
	},
};
