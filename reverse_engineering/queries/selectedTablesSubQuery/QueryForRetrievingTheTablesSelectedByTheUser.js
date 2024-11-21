const { getProjectedPropertiesNames } = require('./getProjectedPropertiesNames');

/**
 @typedef {{
* 	sql: () => string,
* 	projection: Record<string, string>
* }} Query
 */
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

	#queryForRetrievingTheTablesSelectedByTheUser({ schemaToTablesMap, columnToAliasMap }) {
		const projection = this.#buildProjection({
			columnToAliasMap,
		});
		const predicate = Object.entries(schemaToTablesMap)
			.map(([schema, tables]) => this.#buildPredicateForTablesInSchema({ schema, tables }))
			.join('OR');
		const whereClause = Object.entries(schemaToTablesMap).length > 0 ? `WHERE ${predicate}` : '';
		return `
			SELECT
				${projection}
			FROM sys.tables tbl
			JOIN sys.schemas sch ON sch.schema_id = tbl.schema_id
			${whereClause}
		  `;
	}

	/**
	 *
	 * @param {{columnToAliasMap: Record<string, string>, schemaToTablesMap: Record<string, string[]>}} param
	 * @returns {Query}
	 */
	getQuery({ columnToAliasMap, schemaToTablesMap }) {
		const query = this.#queryForRetrievingTheTablesSelectedByTheUser({
			schemaToTablesMap,
			columnToAliasMap,
		});

		return {
			projection: getProjectedPropertiesNames({ columnToAliasMap }),
			sql: () => query,
		};
	}
}

module.exports = {
	QueryForRetrievingTheTablesSelectedByTheUser,
};
