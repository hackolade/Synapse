const defineRequiredFields = jsonSchema =>
	Object.entries(jsonSchema.properties).reduce((jsonSchemaAcc, [columnName, properties]) => ({
		...jsonSchemaAcc,
		required: [
			...jsonSchemaAcc.required,
			...(properties.required ? [columnName] : []),
		],
	}), jsonSchema);

module.exports = defineRequiredFields;
