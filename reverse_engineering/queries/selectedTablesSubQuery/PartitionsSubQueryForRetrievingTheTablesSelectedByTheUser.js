const { QueryForRetrievingTheTablesSelectedByTheUser } = require('./QueryForRetrievingTheTablesSelectedByTheUser');
const { getProjectedPropertiesNames } = require('./getProjectedPropertiesNames');

class PartitionsSubQueryForRetrievingTheTablesSelectedByTheUser {
	constructor({ schemaToTablesMap }) {
		this.schemaToTablesMap = schemaToTablesMap;
		this.query = new QueryForRetrievingTheTablesSelectedByTheUser();
	}

	getQuery() {
		const projection = {
			'tbl.object_id': 'tableId',
			'tbl.name': 'tableName',
			'sch.name': 'schemaName',
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
	PartitionsSubQueryForRetrievingTheTablesSelectedByTheUser,
};
