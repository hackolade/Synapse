const { QueryForRetrievingTheTablesSelectedByTheUser } = require('./QueryForRetrievingTheTablesSelectedByTheUser');
const { getProjectedPropertiesNames } = require('./getProjectedPropertiesNames');

class DatabaseIndexesSubQueryForRetrievingTheTablesSelectedByTheUser {
	constructor({ schemaToTablesMap }) {
		this.schemaToTablesMap = schemaToTablesMap;
		this.query = new QueryForRetrievingTheTablesSelectedByTheUser();
	}

	getQuery() {
		const projection = {
			'tbl.object_id': 'tableId',
			'tbl.name': 'tableName',
			'tbl.is_ms_shipped': 'isMsShipped',
		};

		const query = this.query.queryForRetrievingTheTablesSelectedByTheUser({
			schemaToTablesMap: this.schemaToTablesMap,
			projection,
		});

		return {
			projection: getProjectedPropertiesNames({ projection }),
			sql: () => query,
		};
	}
}

module.exports = {
	DatabaseIndexesSubQueryForRetrievingTheTablesSelectedByTheUser,
};
