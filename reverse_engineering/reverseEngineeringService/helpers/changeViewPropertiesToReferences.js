const getColumnInfoByName = (columnsInfo, columnName, propertyName) => {
	const relatedColumn = columnsInfo.find(column => column['ColumnName'] === columnName) || columnsInfo[0];
	return relatedColumn[propertyName];
};

const changeViewPropertiesToReferences = (jsonSchema, viewInfo, viewColumnRelations) => {
	return viewColumnRelations.reduce((jsonSchemaAcc, column) => {
		const columnName = column['name'];
		const referenceTable = column['source_table']
			|| getColumnInfoByName(viewInfo, columnName, 'ReferencedTableName');
		const referenceColumn = column['source_column']
			|| getColumnInfoByName(viewInfo, columnName, 'ReferencedColumnName');
		const referenceSchema = column['source_schema']
			|| getColumnInfoByName(viewInfo, columnName, 'ReferencedSchemaName');
		if (!jsonSchemaAcc.properties[columnName]) {
			return jsonSchemaAcc;
		}

		return {
			...jsonSchemaAcc,
			properties: {
				...jsonSchemaAcc.properties,
				[columnName]: { $ref: `#collection/definitions/${referenceTable}/${referenceColumn}`, bucketName: referenceSchema },
			},
		};
	}, jsonSchema);
};

module.exports = changeViewPropertiesToReferences;
