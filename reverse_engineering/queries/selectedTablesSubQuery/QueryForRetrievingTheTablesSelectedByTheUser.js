class QueryForRetrievingTheTablesSelectedByTheUser {
	#buildPredicateForTable({ schema, table }) {
		return `(sch.name = '${schema}' AND tbl.name = '${table}')`;
	}

	#buildPredicateForTablesInSchema({ schema, tables }) {
		return tables.map(table => this.#buildPredicateForTable({ schema, table })).join('OR');
	}

	#buildProjectionForProperty({ propertyName, projectionName }) {
		return `${propertyName} AS ${projectionName}`;
	}

	#buildProjectionsForPropertiesSelectedByQuery({ projection }) {
		const initialPropertiesNames = Object.keys(projection);

		return initialPropertiesNames
			.map(initialPropertyName =>
				this.#buildProjectionForProperty({
					propertyName: initialPropertyName,
					projectionName: projection[initialPropertyName],
				}),
			)
			.join(',');
	}

	queryForRetrievingTheTablesSelectedByTheUser({ schemaToTablesMap, projection }) {
		const propertiesToSelectProjections = this.#buildProjectionsForPropertiesSelectedByQuery({
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
