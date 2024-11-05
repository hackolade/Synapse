const axios = require('axios');
const sql = require('mssql');
const https = require('https');
const msal = require('@azure/msal-node');
const { logAuthTokenInfo, logConnectionHostAndUsername } = require('../../helpers/logInfo');
const { prepareError } = require('./errorService');

class Connection {
	constructor({ logger }) {
		this.logger = logger;
	}

	async connect() {}
}

class ConnectionStringConnection extends Connection {
	constructor({ connectionInfo, logger }) {
		super({ logger });
		this.connectionInfo = connectionInfo;
	}

	async connect() {
		logConnectionHostAndUsername({ authMethod: this.connectionInfo.authMethod, logger: this.logger });
		return sql.connect(this.connectionInfo.connectionString);
	}
}

class UsernamePasswordConnection extends Connection {
	constructor({ commonConfig, credentialsConfig, logger }) {
		super({ logger });
		this.commonConfig = commonConfig;
		this.credentialsConfig = credentialsConfig;
	}

	async connect() {
		logConnectionHostAndUsername({
			hostname: this.commonConfig.hostName,
			username: this.credentialsConfig.user,
			authMethod: this.connectionInfo.authMethod,
			logger: this.logger,
		});
		return sql.connect({
			...this.commonConfig,
			...this.credentialsConfig,
			options: {
				encrypt: true,
				enableArithAbort: true,
			},
		});
	}
}

class UsernamePasswordWindowsConnection extends Connection {
	constructor({ connectionInfo, commonConfig, credentialsConfig, logger }) {
		super({ logger });
		this.connectionInfo = connectionInfo;
		this.commonConfig = commonConfig;
		this.credentialsConfig = credentialsConfig;
	}

	async connect() {
		logConnectionHostAndUsername({
			hostname: this.commonConfig.hostName,
			username: this.credentialsConfig.user,
			authMethod: this.connectionInfo.authMethod,
			logger: this.logger,
		});
		return sql.connect({
			...this.commonConfig,
			...this.credentialsConfig,
			domain: this.connectionInfo.userDomain,
			options: {
				encrypt: false,
				enableArithAbort: true,
			},
		});
	}
}

class AzureActiveDirectoryMFAConnection extends Connection {
	constructor({ connectionInfo, commonConfig, tenantId, clientId, redirectUri, logger }) {
		super({ logger });
		this.connectionInfo = connectionInfo;
		this.commonConfig = commonConfig;
		this.tenantId = tenantId;
		this.clientId = clientId;
		this.redirectUri = redirectUri;
	}

	async connect() {
		const token = await this.#getToken();
		logAuthTokenInfo({ token, logger: this.logger });
		logConnectionHostAndUsername({ authMethod: this.connectionInfo.authMethod, logger: this.logger });
		return sql.connect({
			...this.commonConfig,
			options: {
				encrypt: true,
				enableArithAbort: true,
			},
			authentication: {
				type: 'azure-active-directory-access-token',
				options: {
					token,
				},
			},
		});
	}

	async #getToken() {
		const axiosExtendedToken = await this.#getTokenByAxiosExtended();
		if (axiosExtendedToken) {
			return axiosExtendedToken;
		}

		const msalToken = await this.#getTokenByMSAL();
		if (msalToken) {
			return msalToken;
		}

		const axiosToken = await this.#getTokenByAxios();
		if (axiosToken) {
			return axiosToken;
		}
	}

	#getTokenByAxiosExtended() {
		return this.#getTokenByAxios({ agent: this.#getAgent() });
	}

	#getAgent(reject, cert, key) {
		return new https.Agent({ cert, key, rejectUnauthorized: Boolean(reject) });
	}

	async #getTokenByAxios({ agent }) {
		try {
			const params = new URLSearchParams();
			params.append('code', this.connectionInfo?.externalBrowserQuery?.code || '');
			params.append('client_id', this.clientId);
			params.append('redirect_uri', this.redirectUri);
			params.append('grant_type', 'authorization_code');
			params.append('code_verifier', this.connectionInfo?.proofKey);
			params.append('resource', 'https://database.windows.net/');

			const responseData = await axios.post(
				`https://login.microsoftonline.com/${this.tenantId}/oauth2/token`,
				params,
				{
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					...(agent && { httpsAgent: agent }),
				},
			);

			return responseData?.data?.access_token || '';
		} catch (error) {
			this.logger.log('error', { message: error.message, stack: error.stack, error }, 'MFA Axios auth error');
			return '';
		}
	}

	async #getTokenByMSAL() {
		try {
			const pca = new msal.PublicClientApplication(this.#getAuthConfig());
			const tokenRequest = {
				code: this.connectionInfo?.externalBrowserQuery?.code || '',
				scopes: ['https://database.windows.net//.default'],
				redirectUri: this.redirectUri,
				codeVerifier: this.connectionInfo?.proofKey,
				clientInfo: this.connectionInfo?.externalBrowserQuery?.client_info || '',
			};

			const responseData = await pca.acquireTokenByCode(tokenRequest);

			return responseData.accessToken;
		} catch (error) {
			this.logger.log('error', { message: error.message, stack: error.stack, error }, 'MFA MSAL auth error');
			return '';
		}
	}

	#getAuthConfig() {
		return {
			system: {
				loggerOptions: {
					loggerCallback(loglevel, message) {
						this.logger.log(message);
					},
					piiLoggingEnabled: false,
					logLevel: msal.LogLevel.Verbose,
				},
			},
			auth: {
				clientId: this.clientId,
				authority: `https://login.microsoftonline.com/${this.tenantId}`,
			},
		};
	}
}

class AzureActiveDirectoryUsernamePasswordConnection extends Connection {
	constructor({ connectionInfo, commonConfig, credentialsConfig, tenantId, clientId, logger }) {
		super({ logger });
		this.connectionInfo = connectionInfo;
		this.commonConfig = commonConfig;
		this.credentialsConfig = credentialsConfig;
		this.tenantId = tenantId;
		this.clientId = clientId;
	}

	async connect() {
		logConnectionHostAndUsername({
			hostname: this.commonConfig.hostName,
			username: this.connectionInfo.userName,
			authMethod: this.connectionInfo.authMethod,
			logger: this.logger,
		});
		return sql.connect({
			...this.commonConfig,
			...this.credentialsConfig,
			options: {
				encrypt: true,
				enableArithAbort: true,
			},
			authentication: {
				type: 'azure-active-directory-password',
				options: {
					userName: this.connectionInfo.userName,
					password: this.connectionInfo.userPassword,
					tenantId: this.tenantId,
					clientId: this.clientId,
				},
			},
		});
	}
}

/**
 *
 * @param {{
 * 	authMethod,
 * 	connectionInfo,
 *  commonConfig,
 *	credentialsConfig,
 *	tenantId,
 * 	clientId,
 * 	redirectUri,
 *	logger,
 * }} param
 * @returns {Promise<object>}
 */
const getConnection = ({ authMethod, ...data }) => {
	switch (authMethod) {
		case 'Username / Password':
			return new UsernamePasswordConnection(data);
		case 'Username / Password (Windows)':
			return new UsernamePasswordWindowsConnection(data);
		case 'Azure Active Directory (MFA)':
			return new AzureActiveDirectoryMFAConnection(data);
		case 'Azure Active Directory (Username / Password)':
			return new AzureActiveDirectoryUsernamePasswordConnection(data);
		default:
			return new ConnectionStringConnection(data);
	}
};

module.exports = {
	getConnection,
};
