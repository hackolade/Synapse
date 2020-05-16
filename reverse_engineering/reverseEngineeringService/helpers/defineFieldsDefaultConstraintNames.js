const defineFieldsDefaultConstraintNames = defaultConstraintsInfo => jsonSchema =>
defaultConstraintsInfo.reduce((jsonSchemaAcc, column) => ({
		...jsonSchemaAcc,
		...(jsonSchemaAcc.properties[column.columnName] && {
			properties: {
				...jsonSchemaAcc.properties,
				[column.columnName]: {
					...jsonSchemaAcc.properties[column.columnName],
					defaultConstraintName: column.name || '',
				},
			}
		}),
	}), jsonSchema);

module.exports = defineFieldsDefaultConstraintNames;
