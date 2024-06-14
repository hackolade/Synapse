const defineMaskedColumns = columnsInfo => jsonSchema =>
	columnsInfo.reduce((jsonSchemaAcc, maskedColumn) => {
		const currentColumn = jsonSchemaAcc.properties[maskedColumn.name];
		if (!currentColumn) {
			return jsonSchemaAcc;
		}

		return {
			...jsonSchemaAcc,
			properties: {
				...jsonSchemaAcc.properties,
				[maskedColumn.name]: {
					...currentColumn,
					maskedWithFunction: maskedColumn.masking_function,
				},
			},
		};
	}, jsonSchema);

module.exports = defineMaskedColumns;
