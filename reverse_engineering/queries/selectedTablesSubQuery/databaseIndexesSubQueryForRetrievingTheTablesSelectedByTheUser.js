const { QueryForRetrievingTheTablesSelectedByTheUser } = require('./QueryForRetrievingTheTablesSelectedByTheUser');
const { getProjectedPropertiesNames } = require('./getProjectedPropertiesNames');

/**
 * @typedef {import("./QueryForRetrievingTheTablesSelectedByTheUser").Query} Query
 * @param {{schemaToTablesMap: Record<string, string[]>}} param
 * @returns {Query}
 */
const getDatabaseIndexesSubQueryForRetrievingTheTablesSelectedByTheUser = ({ schemaToTablesMap }) => {
	const selectedTablesQuery = new QueryForRetrievingTheTablesSelectedByTheUser();
	const columnToAliasMap = {
		'tbl.object_id': 'tableId',
		'tbl.name': 'tableName',
		'tbl.is_ms_shipped': 'isMsShipped',
	};

	return selectedTablesQuery.getQuery({
		schemaToTablesMap,
		columnToAliasMap,
	});
};

module.exports = {
	getDatabaseIndexesSubQueryForRetrievingTheTablesSelectedByTheUser,
};
