function buildPredicateForTable({ schema, table }) {
	return `(sch.name = '${schema}' AND tbl.name = '${table}')`;
}

function buildPredicateForTablesInSchema({ schema, tables }) {
	return tables.map(table => buildPredicateForTable({ schema, table })).join('OR');
}

function queryForRetrievingTheTablesSelectedByTheUser({ schemaToTablesMap }) {
	const projection = {
		tableId: 'tableId',
		tableName: 'tableName',
		schemaName: 'schemaName',
	};
	const predicate = Object.entries(schemaToTablesMap)
		.map(([schema, tables]) => buildPredicateForTablesInSchema({ schema, tables }))
		.join('OR');
	const whereClause = Object.entries(schemaToTablesMap).length > 0 ? `WHERE ${predicate}` : '';
	const sql = `
  SELECT
      tbl.object_id   AS ${projection.tableId}
    , tbl.name        AS ${projection.tableName}
    , sch.name        AS ${projection.schemaName}
  FROM sys.tables tbl
  JOIN sys.schemas sch ON sch.schema_id = tbl.schema_id
  ${whereClause}`;
	return {
		projection,
		sql: () => sql,
	};
}

module.exports = { queryForRetrievingTheTablesSelectedByTheUser };
