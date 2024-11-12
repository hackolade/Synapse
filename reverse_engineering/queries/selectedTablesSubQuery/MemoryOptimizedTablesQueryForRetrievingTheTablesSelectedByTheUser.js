const { QueryForRetrievingTheTablesSelectedByTheUser } = require('./QueryForRetrievingTheTablesSelectedByTheUser');

class MemoryOptimizedTablesQueryForRetrievingTheTablesSelectedByTheUser extends QueryForRetrievingTheTablesSelectedByTheUser {
	constructor({ schemaToTablesMap }) {
		super();
		this.schemaToTablesMap = schemaToTablesMap;
	}

	getQuery() {
		const propertiesToSelect = {
			tableName: 'tbl.name',
			durability: 'tbl.durability',
			durabilityDescription: 'tbl.durability_desc',
			historyTableId: 'tbl.history_table_id',
			temporalTypeDescription: 'tbl.temporal_type_desc',
			isMemoryOptimized: 'tbl.is_memory_optimized',
		};

		const projection = {
			tableName: 'tableName',
			durability: 'durability',
			durabilityDescription: 'durabilityDescription',
			historyTableId: 'historyTableId',
			temporalTypeDescription: 'temporalTypeDescription',
			isMemoryOptimized: 'isMemoryOptimized',
			historyTable: 'history_table',
			historySchema: 'history_schema',
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
	MemoryOptimizedTablesQueryForRetrievingTheTablesSelectedByTheUser,
};
