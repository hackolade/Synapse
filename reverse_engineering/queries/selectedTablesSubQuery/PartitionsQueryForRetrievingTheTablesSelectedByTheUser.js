const { QueryForRetrievingTheTablesSelectedByTheUser } = require('./QueryForRetrievingTheTablesSelectedByTheUser');

class PartitionsQueryForRetrievingTheTablesSelectedByTheUser extends QueryForRetrievingTheTablesSelectedByTheUser {
	getQuery({ schemaToTablesMap }) {
		const propertiesToSelect = {
			tableId: 'tbl.object_id',
			tableName: 'tbl.name',
			schemaName: 'sch.name',
		};

		const projection = {
			tableId: 'tableId',
			tableName: 'tableName',
			schemaName: 'schemaName',
		};

		const query = this.queryForRetrievingTheTablesSelectedByTheUser({
			schemaToTablesMap,
			propertiesToSelect,
			propertyNameProjection: projection,
		});

		return {
			projection,
			sql: () => query,
		};
	}
}

module.exports = {
	PartitionsQueryForRetrievingTheTablesSelectedByTheUser,
};
