const { QueryForRetrievingTheTablesSelectedByTheUser } = require('./QueryForRetrievingTheTablesSelectedByTheUser');

class DatabaseIndexesQueryForRetrievingTheTablesSelectedByTheUser extends QueryForRetrievingTheTablesSelectedByTheUser {
	constructor({ schemaToTablesMap }) {
		super();
		this.schemaToTablesMap = schemaToTablesMap;
	}

	getQuery() {
		const propertiesToSelect = {
			tableId: 'tbl.object_id',
			tableName: 'tbl.name',
			isMsSkipped: 'tbl.is_ms_shipped',
		};

		const projection = {
			tableId: 'tableId',
			tableName: 'tableName',
			isMsSkipped: 'isMsSkipped',
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
	DatabaseIndexesQueryForRetrievingTheTablesSelectedByTheUser,
};
