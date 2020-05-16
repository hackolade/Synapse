const {
	getTableInfo,
	getTableRow,
	getTableForeignKeys,
	getDatabaseIndexes,
	getTableColumnsDescription,
	getDatabaseMemoryOptimizedTables,
	getDatabaseCheckConstraints,
	getViewTableInfo,
	getTableKeyConstraints,
	getViewColumnRelations,
	getTableMaskedColumns,
	getDatabaseXmlSchemaCollection,
	getTableDefaultConstraintNames,
	getDatabaseUserDefinedTypes,
	getViewStatement,
	getViewsIndexes,
	getFullTextIndexes,
	getSpatialIndexes,
} = require('../databaseService/databaseService');
const {
	transformDatabaseTableInfoToJSON,
	reverseTableForeignKeys,
	reverseTableIndexes,
	defineRequiredFields,
	defineFieldsDescription,
	doesViewHaveRelatedTables,
	reverseTableCheckConstraints,
	changeViewPropertiesToReferences,
	defineFieldsKeyConstraints,
	defineMaskedColumns,
	defineJSONTypes,
	defineXmlFieldsCollections,
	defineFieldsDefaultConstraintNames,
	defineFieldsCompositeKeyConstraints,
	getUserDefinedTypes,
	reorderTableRows,
} = require('./helpers');
const pipe = require('../helpers/pipe');

const mergeCollectionsWithViews = jsonSchemas =>
	jsonSchemas.reduce((structuredJSONSchemas, jsonSchema) => {
		if (jsonSchema.relatedTables) {
			const currentIndex = structuredJSONSchemas.findIndex(structuredSchema =>
				jsonSchema.collectionName === structuredSchema.collectionName && jsonSchema.dbName);
			const relatedTableSchemaIndex = structuredJSONSchemas.findIndex(({ collectionName, dbName }) =>
				jsonSchema.relatedTables.find(({ tableName, schemaName }) => tableName === collectionName && schemaName === dbName));

			if (relatedTableSchemaIndex !== -1 && doesViewHaveRelatedTables(jsonSchema, structuredJSONSchemas)) {
				structuredJSONSchemas[relatedTableSchemaIndex].views.push(jsonSchema);
			}

			delete jsonSchema.relatedTables;
			return structuredJSONSchemas.filter((schema, i) => i !== currentIndex);
		}

		return structuredJSONSchemas;
	}, jsonSchemas);

const getCollectionsRelationships = logger => async (dbConnectionClient) => {
	const dbName = dbConnectionClient.config.database;
	logger.progress({ message: 'Fetching tables relationships', containerName: dbName, entityName: '' });
	const tableForeignKeys = await getTableForeignKeys(dbConnectionClient, dbName);
	return reverseTableForeignKeys(tableForeignKeys, dbName);
};

const getStandardDocumentByJsonSchema = (jsonSchema) => {
	return Object.keys(jsonSchema.properties).reduce((result, key) => {
		return {
			...result,
			[key]: ""
		};
	}, {});
};

const isViewPartitioned = (viewStatement) => {
	viewStatement = cleanComments(String(viewStatement).trim());
	const viewContentRegexp = /CREATE[\s\S]+?VIEW[\s\S]+?AS\s+(?:WITH[\s\S]+AS\s+\([\s\S]+\))?([\s\S]+)/i;

	if (!viewContentRegexp.test(viewStatement)) {
		return false;
	}

	const content = viewStatement.match(viewContentRegexp)[1] || '';
	const hasUnionAll = content.toLowerCase().split(/union[\s\S]+?all/i).length > 1;

	return hasUnionAll;
};

const getPartitionedJsonSchema = (viewInfo, viewColumnRelations) => {
	const aliasToName = viewInfo.reduce((aliasToName, item) => ({
		...aliasToName,
		[item.ColumnName]: item.ReferencedColumnName
	}), {});
	const tableName = viewInfo[0]['ReferencedTableName'];

	const properties = viewColumnRelations.reduce((properties, column) => ({
		...properties,
		[column.name]: {
			$ref: `#collection/definitions/${tableName}/${aliasToName[column.name]}`,
			bucketName: column['source_schema'] || '',
		}
	}), {});

	return {
		properties
	};
};

const getPartitionedTables = (viewInfo) => {
	const hasTable = (tables, item) => tables.some(
		table => table.table[0] === item.ReferencedSchemaName && table.table[1] === item.ReferencedTableName
	);
	
	return viewInfo.reduce((tables, item) => {
		if (!hasTable(tables, item)) {
			return tables.concat([{
				table: [ item.ReferencedSchemaName, item.ReferencedTableName ]
			}]);
		} else {
			return tables;
		}
	}, []);
};

const cleanComments = (definition) => {
	return definition.split('\n').filter(line => !/^--/.test(line.trim())).join('\n');
};

const getSelectStatementFromDefinition = (definition) => {
	const regExp = /CREATE[\s]+VIEW[\s\S]+?(?:WITH[\s]+(?:ENCRYPTION,?|SCHEMABINDING,?|VIEW_METADATA,?)+[\s]+)?AS\s+((?:WITH|SELECT)[\s\S]+?)(WITH\s+CHECK\s+OPTION|$)/i;

	if (!regExp.test(definition.trim())) {
		return '';
	}

	return definition.trim().match(regExp)[1];
};

const getPartitionedSelectStatement = (definition, table, dbName) => {
	const tableRef = new RegExp(`(\\[?${dbName}\\]?\\.)?(\\[?${table[0]}\\]?\\.)?\\[?${table[1]}\\]?`, 'i');
	const statement = getSelectStatementFromDefinition(definition).split(/UNION\s+ALL/i).find(item => tableRef.test(item));

	if (!statement) {
		return '';
	}

	return statement.replace(tableRef, '${tableName}').trim();
};

const getViewProperties = (viewData) => {
	if (!viewData) {
		return {};
	}

	const isSchemaBound = viewData.is_schema_bound;
	const withCheckOption = viewData.with_check_option;
	
	return {
		viewAttrbute: isSchemaBound ? 'SCHEMABINDING' : '',
		withCheckOption,
	}; 
};

const prepareViewJSON = (dbConnectionClient, dbName, viewName, schemaName) => async jsonSchema => {
	const [viewInfo, viewColumnRelations, viewStatement] = await Promise.all([
		await getViewTableInfo(dbConnectionClient, dbName, viewName, schemaName),
		await getViewColumnRelations(dbConnectionClient, dbName, viewName, schemaName),
		await getViewStatement(dbConnectionClient, dbName, viewName, schemaName),
	]);
	if (isViewPartitioned(viewStatement[0].definition)) {
		const partitionedSchema = getPartitionedJsonSchema(
			viewInfo,
			viewColumnRelations
		);
		const partitionedTables = getPartitionedTables(viewInfo);

		return {
			jsonSchema: JSON.stringify({
				...jsonSchema,
				properties: {
					...(jsonSchema.properties || {}),
					...partitionedSchema.properties,
				}
			}),
			data: {
				...getViewProperties(viewStatement[0]),
				selectStatement: getPartitionedSelectStatement(cleanComments(String(viewStatement[0].definition)), (partitionedTables[0] || {}).table, dbName),
				partitioned: true,
				partitionedTables,
			},
			name: viewName,
			relatedTables: [{
				tableName: viewInfo[0]['ReferencedTableName'],
				schemaName: viewInfo[0]['ReferencedSchemaName'],
			}],
		};
	} else {
		return {
			jsonSchema: JSON.stringify(changeViewPropertiesToReferences(jsonSchema, viewInfo, viewColumnRelations)),
			name: viewName,
			data: {
				...getViewProperties(viewStatement[0]),
				selectStatement: getSelectStatementFromDefinition(cleanComments(String(viewStatement[0].definition)))
			},
			relatedTables: viewInfo.map((columnInfo => ({
				tableName: columnInfo['ReferencedTableName'],
				schemaName: columnInfo['ReferencedSchemaName'],
			}))),
		};
	}
};

const cleanNull = doc => Object.entries(doc).filter(([ key, value ]) => value !== null).reduce((result, [key, value]) => ({
	...result,
	[key]: value,
}), {});

const cleanDocuments = (documents) => {
	if (!Array.isArray(documents)) {
		return documents;
	}

	return documents.map(cleanNull);
}

const getMemoryOptimizedOptions = (options) => {
	if (!options) {
		return {};
	}

	return {
		memory_optimized: true,
		durability: ['SCHEMA_ONLY', 'SCHEMA_AND_DATA'].includes(String(options.durability_desc).toUpperCase()) ? String(options.durability_desc).toUpperCase() : '',
		systemVersioning: options.temporal_type_desc === 'SYSTEM_VERSIONED_TEMPORAL_TABLE',
		historyTable: options.history_table ? `${options.history_schema}.${options.history_table}` : '',
	};
};

const reverseCollectionsToJSON = logger => async (dbConnectionClient, tablesInfo, reverseEngineeringOptions) => {
	const dbName = dbConnectionClient.config.database;
	const [
		databaseIndexes, databaseMemoryOptimizedTables, databaseCheckConstraints, xmlSchemaCollections, databaseUDT, viewsIndexes, fullTextIndexes,
		spatialIndexes
	] = await Promise.all([
		getDatabaseIndexes(dbConnectionClient, dbName),
		getDatabaseMemoryOptimizedTables(dbConnectionClient, dbName, logger),
		getDatabaseCheckConstraints(dbConnectionClient, dbName),
		getDatabaseXmlSchemaCollection(dbConnectionClient, dbName),
		getDatabaseUserDefinedTypes(dbConnectionClient, dbName),
		getViewsIndexes(dbConnectionClient, dbName),
		getFullTextIndexes(dbConnectionClient, dbName, logger),
		getSpatialIndexes(dbConnectionClient, dbName, logger),
	]);

	return await Object.entries(tablesInfo).reduce(async (jsonSchemas, [schemaName, tableNames]) => {
		logger.progress({ message: 'Fetching database information', containerName: dbName, entityName: '' });
		const tablesInfo = await Promise.all(
			tableNames.map(async untrimmedTableName => {
				const tableName = untrimmedTableName.replace(/ \(v\)$/, '');
				const tableIndexes = databaseIndexes.concat(fullTextIndexes).concat(spatialIndexes).filter(
					index => index.TableName === tableName && index.schemaName === schemaName
				);
				const tableXmlSchemas = xmlSchemaCollections.filter(collection =>
					collection.tableName === tableName && collection.schemaName === schemaName);
				const tableCheckConstraints = databaseCheckConstraints.filter(cc => cc.table === tableName);
				logger.progress({ message: 'Fetching table information', containerName: dbName, entityName: tableName });

				const [tableInfo, tableRows, fieldsKeyConstraints] = await Promise.all([
					await getTableInfo(dbConnectionClient, dbName, tableName, schemaName),
					await getTableRow(dbConnectionClient, dbName, tableName, schemaName, reverseEngineeringOptions.rowCollectionSettings),
					await getTableKeyConstraints(dbConnectionClient, dbName, tableName, schemaName)
				]);
				const isView = tableInfo[0]['TABLE_TYPE'].trim() === 'V';

				const jsonSchema = pipe(
					transformDatabaseTableInfoToJSON(tableInfo),
					defineRequiredFields,
					defineFieldsDescription(await getTableColumnsDescription(dbConnectionClient, dbName, tableName, schemaName)),
					defineFieldsKeyConstraints(fieldsKeyConstraints),
					defineMaskedColumns(await getTableMaskedColumns(dbConnectionClient, dbName, tableName, schemaName)),
					defineJSONTypes(tableRows),
					defineXmlFieldsCollections(tableXmlSchemas),
					defineFieldsDefaultConstraintNames(await getTableDefaultConstraintNames(dbConnectionClient, dbName, tableName, schemaName)),
				)({ required: [], properties: {} });

				const reorderedTableRows = reorderTableRows(tableRows, reverseEngineeringOptions.isFieldOrderAlphabetic);
				const standardDoc = Array.isArray(reorderedTableRows) && reorderedTableRows.length
					? reorderedTableRows
					: reorderTableRows([getStandardDocumentByJsonSchema(jsonSchema)], reverseEngineeringOptions.isFieldOrderAlphabetic);

				let result = {
					collectionName: tableName,
					dbName: schemaName,
					entityLevel: {
						Indxs: reverseTableIndexes(tableIndexes),
						chkConstr: reverseTableCheckConstraints(tableCheckConstraints),
						...getMemoryOptimizedOptions(databaseMemoryOptimizedTables.find(item => item.name === tableName)),
						...defineFieldsCompositeKeyConstraints(fieldsKeyConstraints),
					},
					standardDoc: standardDoc,
					documentTemplate: standardDoc,
					collectionDocs: reorderedTableRows,
					documents: cleanDocuments(reorderedTableRows),
					bucketInfo: {
						databaseName: dbName,
					},
					modelDefinitions: {
						definitions: getUserDefinedTypes(tableInfo, databaseUDT),
					},
					emptyBucket: false,
					validation: { jsonSchema },
					views: [],
				};

				if (isView) {
					const viewData = await prepareViewJSON(dbConnectionClient, dbName, tableName, schemaName)(jsonSchema)
					const indexes = viewsIndexes.filter(index => index.TableName === tableName && index.schemaName === schemaName);

					result = {
						...result,
						...viewData,
						data: {
							...(viewData.data || {}),
							Indxs: reverseTableIndexes(indexes),
						}
					};
				}

				return result;
			})
		);
		return [...await jsonSchemas, ...tablesInfo.filter(Boolean)];
	}, Promise.resolve([]));
};

module.exports = {
	reverseCollectionsToJSON,
	mergeCollectionsWithViews,
	getCollectionsRelationships,
};
