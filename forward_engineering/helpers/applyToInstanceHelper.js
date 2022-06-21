const { connect } = require('../../reverse_engineering/api');
const { queryIsDeactivated, filterDeactivatedQuery } = require('./commentIfDeactivated');

const GO_STATEMENT = 'GO';

const applyToInstance = async (connectionInfo, logger, app) => {
	const async = app.require('async');

	try {
		const client = await connect(connectionInfo, logger);
		if (!client.config.database) {
			throw new Error('No database specified');
		}
		const queries = getQueries(connectionInfo.script);
		
		await async.mapSeries(queries, async query => {
			const message = `Query: ${query.split('\n').shift().substring(0, 150)}`;
			logger.progress({ message });
			logger.log('info', { message }, 'Apply to instance');

			await client.query(query);
		});
		
	} catch (error) {
		logger.log('error', { message: error.message, stack: error.stack, error: error }, 'Error applying to instance');
		throw prepareError(error);
	};
};

const getQueries = (script = '') => {
	script = filterDeactivatedQuery(script)
	const queries = script
		.split('\n\n')
		.map(script => script.trim())
		.filter(query => { 
			if (!Boolean(query)) {
				return false;
			} else if (query.endsWith(GO_STATEMENT) && query.length === 2) {
				return false;
			} 
			
			return !queryIsDeactivated(query);
		})
		.map(query => query.endsWith(GO_STATEMENT) ? query.slice(0, -3) + ';' : query);
	return queries;
};

const prepareError = error => {
	error = JSON.stringify(error, Object.getOwnPropertyNames(error));
	return JSON.parse(error);
};

module.exports = { applyToInstance };