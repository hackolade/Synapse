const { QueryForRetrievingTheTablesSelectedByTheUser } = require('./QueryForRetrievingTheTablesSelectedByTheUser');
const { getProjectedPropertiesNames } = require('./getProjectedPropertiesNames');

/**
 * @typedef {import("./QueryForRetrievingTheTablesSelectedByTheUser").Query} Query
 * @param {{schemaToTablesMap: Record<string, string[]>}} param
 * @returns {Query}
 */
const getPartitionsSubQueryForRetrievingTheTablesSelectedByTheUser = ({ schemaToTablesMap }) => {
	const selectedTablesQuery = new QueryForRetrievingTheTablesSelectedByTheUser();
	const columnToAliasMap = {
		'tbl.object_id': 'tableId',
		'tbl.name': 'tableName',
		'sch.name': 'schemaName',
	};

	return selectedTablesQuery.getQuery({
		schemaToTablesMap,
		columnToAliasMap,
	});
};

module.exports = {
	getPartitionsSubQueryForRetrievingTheTablesSelectedByTheUser,
};
