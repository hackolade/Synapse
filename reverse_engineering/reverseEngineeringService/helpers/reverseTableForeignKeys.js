const reverseTableForeignKeys = tableForeignKeys => {
	const tableForeignKeysObject = tableForeignKeys.reduce((data, foreignKey) => {
		const foreignKeyName = foreignKey.FK_NAME;
		const existedForeignKey = data[foreignKeyName];
		const getForeignKey = existedForeignKey => {
			if (existedForeignKey) {
				return {
					...existedForeignKey,
					parentField: [...existedForeignKey.parentField, foreignKey.referenced_column],
					childField: [...existedForeignKey.childField, foreignKey.column],
				};
			} else {
				return {
					relationshipName: foreignKeyName,
					dbName: foreignKey.schema_name,
					parentCollection: foreignKey.referenced_table,
					parentField: [foreignKey.referenced_column],
					childDbName: foreignKey.schema_name,
					childCollection: foreignKey.table,
					childField: [foreignKey.column],
					relationshipType: 'Foreign Key',
				};
			}
		};

		return {
			...data,
			[foreignKeyName]: getForeignKey(existedForeignKey),
		};
	}, {});

	return Object.keys(tableForeignKeysObject).map(key => tableForeignKeysObject[key]);
};

module.exports = reverseTableForeignKeys;
