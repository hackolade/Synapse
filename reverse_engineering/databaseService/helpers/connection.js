const { hckFetch } = require('@hackolade/fetch');
const sql = require('mssql');
const msal = require('@azure/msal-node');
const { logAuthTokenInfo, logConnectionHostAndUsername } = require('../../helpers/logInfo');
const { prepareError } = require('./errorService');
const { parseResponse } = require('../../helpers/parseResponse');

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
	constructor({ commonConfig, credentialsConfig, connectionInfo, logger }) {
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
			options: {
				encrypt: true,
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
		try {
			const urlParams = new URLSearchParams();

			urlParams.append('code', this.connectionInfo?.externalBrowserQuery?.code || '');
			urlParams.append('client_id', this.clientId);
			urlParams.append('redirect_uri', this.redirectUri);
			urlParams.append('grant_type', 'authorization_code');
			urlParams.append('code_verifier', this.connectionInfo?.proofKey);

			const options = {
				method: 'POST',
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/x-www-form-urlencoded',
					'Origin': 'http://localhost',
				},
				body: urlParams,
			};

			const response = await hckFetch(
				`https://login.microsoftonline.com/organizations/oauth2/v2.0/token`,
				options,
			);
			const responseData = await parseResponse(response);

			return responseData?.access_token || '';
		} catch (error) {
			this.logger.log('error', { message: error.message, stack: error.stack, error }, 'MFA Axios auth error');
			return '';
		}
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
