const defineFieldsDescription = columnsInfo => jsonSchema =>
	columnsInfo.reduce(
		(jsonSchemaAcc, column) => ({
			...jsonSchemaAcc,
			...(jsonSchemaAcc.properties[column.Column] && {
				properties: {
					...jsonSchemaAcc.properties,
					[column.Column]: {
						...jsonSchemaAcc.properties[column.Column],
						description: column.Description || '',
					},
				},
			}),
		}),
		jsonSchema,
	);

module.exports = defineFieldsDescription;
