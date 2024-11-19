const { QueryForRetrievingTheTablesSelectedByTheUser } = require('./QueryForRetrievingTheTablesSelectedByTheUser');
const { getProjectedPropertiesNames } = require('./getProjectedPropertiesNames');

class PartitionsSubQueryForRetrievingTheTablesSelectedByTheUser extends QueryForRetrievingTheTablesSelectedByTheUser {
	constructor({ schemaToTablesMap }) {
		super();
		this.schemaToTablesMap = schemaToTablesMap;
	}

	getQuery() {
		const projection = {
			'tbl.object_id': 'tableId',
			'tbl.name': 'tableName',
			'sch.name': 'schemaName',
		};

		const query = this.queryForRetrievingTheTablesSelectedByTheUser({
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
