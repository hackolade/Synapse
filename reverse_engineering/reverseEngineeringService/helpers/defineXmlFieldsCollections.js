const defineXmlFieldsCollections = xmlCollections => jsonSchema =>
	xmlCollections.reduce((jsonSchemaAcc, xmlCollection) => {
		const currentColumn = jsonSchemaAcc.properties[xmlCollection.columnName];
		if (!currentColumn) {
			return jsonSchemaAcc;
		}

		return {
			...jsonSchemaAcc,
			properties: {
				...jsonSchemaAcc.properties,
				[xmlCollection.columnName]: {
					...currentColumn,
					xml_schema_collection: xmlCollection.collectionName,
				},
			},
		}
	}, jsonSchema);

module.exports = defineXmlFieldsCollections;
