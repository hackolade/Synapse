const { QueryForRetrievingTheTablesSelectedByTheUser } = require('./QueryForRetrievingTheTablesSelectedByTheUser');

class PartitionsQueryForRetrievingTheTablesSelectedByTheUser extends QueryForRetrievingTheTablesSelectedByTheUser {
	constructor({ schemaToTablesMap }) {
		super();
		this.schemaToTablesMap = schemaToTablesMap;
	}

	getQuery() {
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
			schemaToTablesMap: this.schemaToTablesMap,
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
