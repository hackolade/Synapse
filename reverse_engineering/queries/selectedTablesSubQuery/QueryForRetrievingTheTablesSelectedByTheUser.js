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

	#buildProjectionsForPropertiesSelectedByQuery({ propertiesToSelect, propertyNameProjection }) {
		const propertiesNames = Object.keys(propertiesToSelect);

		return propertiesNames
			.map(propertyName =>
				this.#buildProjectionForProperty({
					propertyName: propertiesToSelect[propertyName],
					projectionName: propertyNameProjection[propertyName],
				}),
			)
			.join(',');
	}

	queryForRetrievingTheTablesSelectedByTheUser({ schemaToTablesMap, propertiesToSelect, propertyNameProjection }) {
		const propertiesToSelectProjections = this.#buildProjectionsForPropertiesSelectedByQuery({
			propertiesToSelect,
			propertyNameProjection,
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
