const reverseTableForeignKeys = (tableForeignKeys, dbName) =>
	tableForeignKeys.map(foreignKey => ({
		relationshipName: foreignKey.FK_NAME,
		dbName: foreignKey.schema_name,
		parentCollection: foreignKey.referenced_table,
		parentField: foreignKey.referenced_column,
		childDbName: foreignKey.schema_name,
		childCollection: foreignKey.table,
		childField: foreignKey.column,
		relationshipType: 'Foreign Key'
	}));

module.exports = reverseTableForeignKeys;
