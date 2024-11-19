class QueryForRetrievingTheTablesSelectedByTheUser {
	#buildPredicateForTable({ schema, table }) {
		return `(sch.name = '${schema}' AND tbl.name = '${table}')`;
	}

	#buildPredicateForTablesInSchema({ schema, tables }) {
		return tables.map(table => this.#buildPredicateForTable({ schema, table })).join('OR');
	}

	#buildProjection({ columnToAliasMap }) {
		return Object.entries(columnToAliasMap)
			.map(([column, alias]) => `${column} AS ${alias}`)
			.join(',');
	}

	queryForRetrievingTheTablesSelectedByTheUser({ schemaToTablesMap, projection }) {
		const propertiesToSelectProjections = this.#buildProjection({
			projection,
		});
		const predicate = Object.entries(schemaToTablesMap)
			.map(([schema, tables]) => this.#buildPredicateForTablesInSchema({ schema, tables }))
			.join('OR');
		const whereClause = Object.entries(schemaToTablesMap).length > 0 ? `WHERE ${predicate}` : '';
		return `
			SELECT
				${propertiesToSelectProjections}
			FROM sys.tables tbl
			JOIN sys.schemas sch ON sch.schema_id = tbl.schema_id
			${whereClause}
		  `;
	}
}

module.exports = {
	QueryForRetrievingTheTablesSelectedByTheUser,
};
