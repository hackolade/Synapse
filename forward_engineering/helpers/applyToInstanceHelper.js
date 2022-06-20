const { connect } = require('../../reverse_engineering/api');
const { DROP_STATEMENTS } = require('./constants');
const { queryIsDeactivated, filterDeactivatedQuery } = require('./commentIfDeactivated');

const GO_STATEMENT = '\nGO';
const GO_REG_EXP = /\nGO/;
const IF_NOT_EXIST_REG = /IF\ NOT[\s\S]*?END/gi;

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
	const terminator = GO_REG_EXP.test(script) ? GO_STATEMENT : ';';
	script = filterDeactivatedQuery(script);
	const getQueriesWithoutTerminator = (script = '') => script
		.split(terminator)
		.map(script => script.trim())
		.filter(Boolean);

	const ifNotQueries = script.matchAll(IF_NOT_EXIST_REG);
	let queries = [];
	let index = 0;
	for (let ifNotQuery of ifNotQueries) {
		const ifNotScript = ifNotQuery[0] || '';
		const withoutIfNotScript = script.slice(index, ifNotQuery.index);
		queries = [...queries, ...getQueriesWithoutTerminator(withoutIfNotScript), ifNotScript];
		index = ifNotQuery.index + ifNotScript.length;
	}
	script = script.slice(index);
	queries = [...queries, ...getQueriesWithoutTerminator(script)];
	return queries
		.filter(query => !DROP_STATEMENTS.some(statement => queryIsDeactivated(query, statement)));
};

const prepareError = error => {
	error = JSON.stringify(error, Object.getOwnPropertyNames(error));
	return JSON.parse(error);
};

module.exports = { applyToInstance };