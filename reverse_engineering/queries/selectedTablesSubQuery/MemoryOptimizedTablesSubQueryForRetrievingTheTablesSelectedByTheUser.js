const { QueryForRetrievingTheTablesSelectedByTheUser } = require('./QueryForRetrievingTheTablesSelectedByTheUser');
const { getProjectedPropertiesNames } = require('./getProjectedPropertiesNames');

class MemoryOptimizedTablesSubQueryForRetrievingTheTablesSelectedByTheUser {
	constructor({ schemaToTablesMap }) {
		this.schemaToTablesMap = schemaToTablesMap;
		this.query = new QueryForRetrievingTheTablesSelectedByTheUser();
	}

	getQuery() {
		const projection = {
			'tbl.name': 'tableName',
			'tbl.durability': 'durability',
			'tbl.durability_desc': 'durabilityDescription',
			'tbl.history_table_id': 'historyTableId',
			'tbl.temporal_type_desc': 'temporalTypeDescription',
			'tbl.is_memory_optimized': 'isMemoryOptimized',
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
	MemoryOptimizedTablesSubQueryForRetrievingTheTablesSelectedByTheUser,
};
