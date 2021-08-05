const {
	getTableInfo,
	getTableRow,
	getTableForeignKeys,
	getDatabaseIndexes,
	getTableColumnsDescription,
	getDatabaseMemoryOptimizedTables,
	getViewTableInfo,
	getViewColumns,
	getTableKeyConstraints,
	getTableDefaultConstraintNames,
	getDatabaseUserDefinedTypes,
	getViewStatement,
	getDistributedColumns,
	getViewDistributedColumns,
	queryDistribution,
} = require('../databaseService/databaseService');
const {
	transformDatabaseTableInfoToJSON,
	reverseTableForeignKeys,
	reverseTableIndexes,
	defineRequiredFields,
	defineFieldsDescription,
	doesViewHaveRelatedTables,
	defineFieldsKeyConstraints,
	defineJSONTypes,
	defineFieldsDefaultConstraintNames,
	defineFieldsCompositeKeyConstraints,
	getUserDefinedTypes,
	reorderTableRows,
	handleType,
	containsJson,
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
	logger.log('info', { message: 'Fetching tables relationships' }, '');
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

const isMaterialized = definition => {
	return /CREATE\s+MATERIALIZED\s+VIEW/i.test(definition || '');
};

const isForAppend = definition => {
	return /FOR_APPEND/i.test(definition || '');
};

const getSelectStatementFromDefinition = (definition) => {
	const regExp = /CREATE(?:\s+MATERIALIZED)?[\s]+VIEW[\s\S]+?(?:WITH[\s]+(?:ENCRYPTION,?|SCHEMABINDING,?|VIEW_METADATA,?)+[\s]+)?AS\s+((?:WITH|SELECT)[\s\S]+?)(WITH\s+CHECK\s+OPTION|$)/i;

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

const addViewProperties = (jsonSchema, viewColumns) => {
	const properties = viewColumns.reduce((properties, column) => {
		return Object.assign({}, properties, {
			[column.name]: column.is_user_defined ? {
				"ref": '#model/definitions/' + column.type
			} : handleType(column.type)
		});
	}, {});

	return Object.assign({}, jsonSchema, {
		properties: Object.assign(
			{}, jsonSchema.properties, properties
		)
	});
};

const filterCbViewColumn = jsonSchema => {
	if (!jsonSchema || !jsonSchema.properties) {
		return jsonSchema;
	}

	return {
		...jsonSchema,
		properties: Object.keys(jsonSchema.properties).reduce((schema, key) => {
			if (key === 'cb') {
				return schema;
			}

			return {
				...schema,
				[key]: jsonSchema.properties[key]
			};
		}, {})
	};
};

const prepareViewJSON = (dbConnectionClient, dbName, viewName, schemaName) => async jsonSchema => {
	const [viewInfo, viewColumns, viewStatement] = await Promise.all([
		await getViewTableInfo(dbConnectionClient, dbName, viewName, schemaName),
		await getViewColumns(dbConnectionClient, dbName, viewName, schemaName),
		await getViewStatement(dbConnectionClient, dbName, viewName, schemaName),
	]);
	const materialized = isMaterialized(viewStatement[0].definition);
	if (materialized) {
		jsonSchema = filterCbViewColumn(addViewProperties(jsonSchema, viewColumns));
	}

	if (isViewPartitioned(viewStatement[0].definition)) {
		const partitionedTables = getPartitionedTables(viewInfo);

		return {
			jsonSchema: JSON.stringify(jsonSchema),
			data: {
				...getViewProperties(viewStatement[0]),
				selectStatement: getPartitionedSelectStatement(cleanComments(String(viewStatement[0].definition)), (partitionedTables[0] || {}).table, dbName),
				partitioned: true,
				forAppend: materialized && isForAppend(String(viewStatement[0].definition)),
				partitionedTables,
				materialized
			},
			name: viewName,
			relatedTables: [{
				tableName: viewInfo[0]['ReferencedTableName'],
				schemaName: viewInfo[0]['ReferencedSchemaName'],
			}],
		};
	} else {
		return {
			jsonSchema: JSON.stringify(jsonSchema),
			name: viewName,
			data: {
				...getViewProperties(viewStatement[0]),
				selectStatement: getSelectStatementFromDefinition(cleanComments(String(viewStatement[0].definition))),
				forAppend: materialized && isForAppend(String(viewStatement[0].definition)),
				materialized
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

const getDistribution = distributionData => {
	if (!Array.isArray(distributionData) || !distributionData.length) {
		return '';
	}

	const distributionMap = {
		2: 'hash',
		3: 'replicate',
		4: 'round_robin'
	};

	return distributionMap[distributionData[0]?.DISTRIBUTION_POLICY || distributionData[0]?.VIEW_DISTRIBUTION_POLICY] || '';
};	

const getIndexing = (indexingInfo, order) => {
	if (order.length) {
		return 'clustered columnstore index order';
	}

	const indexingMap = {
		0: 'heap',
		1: 'clustered columnstore index',
		5: 'clustered columnstore index',
		6: 'heap',
		7: 'heap'
	};

	return indexingMap[indexingInfo && indexingInfo.type] || 'clustered columnstore index';
};

const getOrder = indexingInfo => {
	return indexingInfo
		.filter(column => column.column_store_order_ordinal)
		.map(column => column.COLUMN_NAME);
};

const getTableRole = (distribution, indexing) => {
	if (distribution === 'hash' && indexing === 'clustered columnstore index') {
		return 'Fact';
	} else if (distribution === 'replicate' || distribution === 'hash') {
		return 'Dimension';
	} else if (distribution === 'round_robin') {
		return 'Staging';
	}

	return '';
};

const getPersistence = tableName => {
	if (tableName[0] === '#') {
		return 'temporary';
	}

	return 'regular';
};

const reverseCollectionsToJSON = logger => async (dbConnectionClient, tablesInfo, reverseEngineeringOptions) => {
	const dbName = dbConnectionClient.config.database;
	progress(logger, `RE data from database "${dbName}"`, dbName);
	const [
		databaseIndexes, databaseMemoryOptimizedTables, databaseUDT
	] = await Promise.all([
		getDatabaseIndexes(dbConnectionClient, dbName).catch(logError(logger, 'Getting indexes')),
		getDatabaseMemoryOptimizedTables(dbConnectionClient, dbName, logger).catch(logError(logger, 'Getting memory optimized tables')),
		getDatabaseUserDefinedTypes(dbConnectionClient, dbName).catch(logError(logger, 'Getting user defined types')),
	]);

	return await Object.entries(tablesInfo).reduce(async (jsonSchemas, [schemaName, tableNames]) => {
		progress(logger, 'Fetching database information', dbName);
		const isSystemIndex = index => /^ClusteredIndex_[a-f0-9]{32}$/m.test(index.name || '');
		const tablesInfo = await Promise.all(
			tableNames.map(async untrimmedTableName => {
				const tableName = untrimmedTableName.replace(/ \(v\)$/, '');
				const tableIndexes = databaseIndexes.filter(
					index => index.TableName === tableName && index.schemaName === schemaName &&
					!isSystemIndex(index)
				);
				progress(logger, 'Fetching table information', dbName, tableName);
				const tableInfo = await getTableInfo(dbConnectionClient, dbName, tableName, schemaName).catch(logError(logger, 'Getting table info'));

				const [tableRows, fieldsKeyConstraints, distributionData] = await Promise.all([
					containsJson(tableInfo)
						? await getTableRow(dbConnectionClient, dbName, tableName, schemaName, reverseEngineeringOptions.rowCollectionSettings, logger).catch(logError(logger, 'Getting table rows'))
						: Promise.resolve([]),
					await getTableKeyConstraints(dbConnectionClient, dbName, tableName, schemaName).catch(logError(logger, 'Getting table key constraints')),
					await queryDistribution(dbConnectionClient, dbName, tableName, schemaName).catch(logError(logger, 'Getting distribution info')),
				]);
				const isView = tableInfo[0]['TABLE_TYPE'].trim() === 'V';

				let distributedColumns = [];

				try {
					progress(logger, 'Fetching columns distribution info', dbName, tableName);

					distributedColumns = isView ?
						await getViewDistributedColumns(dbConnectionClient, dbName, tableName, schemaName) :
						await getDistributedColumns(dbConnectionClient, dbName, tableName, schemaName);
				} catch (e) {
					logger.log('error', { type: 'warning', message: e.message });
				}

				const hashColumn = distributedColumns.map(({ columnName }) => ({ name: columnName }));

				progress(logger, 'Create JSON schema', dbName, tableName);
				const jsonSchema = pipe(
					transformDatabaseTableInfoToJSON(tableInfo),
					defineRequiredFields,
					defineFieldsDescription(await getTableColumnsDescription(dbConnectionClient, dbName, tableName, schemaName).catch(logError(logger, 'Getting table column descriptions'))),
					defineFieldsKeyConstraints(fieldsKeyConstraints),
					defineJSONTypes(tableRows),
					defineFieldsDefaultConstraintNames(await getTableDefaultConstraintNames(dbConnectionClient, dbName, tableName, schemaName).catch(logError(logger, 'Getting default constraint names'))),
				)({ required: [], properties: {} });

				const reorderedTableRows = reorderTableRows(tableRows, reverseEngineeringOptions.isFieldOrderAlphabetic);
				const standardDoc = Array.isArray(reorderedTableRows) && reorderedTableRows.length
					? reorderedTableRows
					: reorderTableRows([getStandardDocumentByJsonSchema(jsonSchema)], reverseEngineeringOptions.isFieldOrderAlphabetic);

				const distribution = getDistribution(distributionData);
				const persistence = getPersistence(tableName);
				const order = getOrder(tableIndexes);
				const indexing = getIndexing(tableIndexes[0], order);

				let result = {
					collectionName: tableName,
					dbName: schemaName,
					entityLevel: {
						Indxs: reverseTableIndexes(tableIndexes),
						...getMemoryOptimizedOptions(databaseMemoryOptimizedTables.find(item => item.name === tableName)),
						...defineFieldsCompositeKeyConstraints(fieldsKeyConstraints),
						indexingOrderColumn: order.map(column => ({ name: column })),
						tableRole: getTableRole(distribution, indexing),
						distribution,
						indexing,
						hashColumn,
						persistence,
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
					progress(logger, 'Getting view data', dbName, tableName);
					const viewData = await prepareViewJSON(dbConnectionClient, dbName, tableName, schemaName)(jsonSchema);

					result = {
						...result,
						...viewData,
						data: {
							...result.entityLevel,
							...(viewData.data || {}),
						}
					};
				}

				return result;
			})
		);
		return [...await jsonSchemas, ...tablesInfo.filter(Boolean)];
	}, Promise.resolve([]));
};

const progress = (logger, message, dbName = '', entityName = '') => {
	logger.progress({ message, containerName: dbName, entityName });
	logger.log('info', { message: `[info] ${message}` }, `${dbName}${entityName ? '.' + entityName : ''}`);
};

const logError = (logger, step) => (error) => {
	logger.log('error', { type: 'error', step: step, message: error.message }, '');
	throw error;
};

module.exports = {
	reverseCollectionsToJSON,
	mergeCollectionsWithViews,
	getCollectionsRelationships,
};
