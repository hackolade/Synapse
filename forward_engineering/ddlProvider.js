const _ = require('lodash');
const defaultTypes = require('./configs/defaultTypes');
const types = require('./configs/types');
const templates = require('./configs/templates');
const { commentIfDeactivated } = require('./helpers/commentIfDeactivated');
const { joinActivatedAndDeactivatedStatements } = require('./utils/joinActivatedAndDeactivatedStatements');

const provider = (baseProvider, options, app) => {
	const { getTerminator } = require('./helpers/optionsHelper');
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { divideIntoActivatedAndDeactivated, clean, tab } = app.require('@hackolade/ddl-fe-utils').general;

	const { wrapIfNotExistSchema, wrapIfNotExistDatabase, wrapIfNotExistTable, wrapIfNotExistView } =
		require('./helpers/ifNotExistStatementHelper')(app);

	const {
		decorateType,
		getIdentity,
		getEncryptedWith,
		decorateDefault,
		canHaveIdentity,
	} = require('./helpers/columnDefinitionHelper');

	const { getMemoryOptimizedIndexes, createMemoryOptimizedIndex, hydrateTableIndex, createTableIndex } =
		require('./helpers/indexHelper')(app);

	const {
		getTableName,
		getTableOptions,
		hasType,
		getDefaultConstraints,
		checkIndexActivated,
		getViewData,
		getCollation,
		setPersistenceSpecificName,
	} = require('./helpers/general')(app);

	const { createKeyConstraint, createDefaultConstraint, generateConstraintsString } =
		require('./helpers/constraintsHelper')(app);

	const keyHelper = require('./helpers/keyHelper')(app);

	const terminator = getTerminator(options);

	return {
		createSchema({ schemaName, databaseName, ifNotExist }) {
			const schemaTerminator = ifNotExist ? ';' : terminator;
			let schemaStatement = assignTemplates(templates.createSchema, {
				name: schemaName,
				terminator: schemaTerminator,
			});

			if (!databaseName) {
				return ifNotExist
					? wrapIfNotExistSchema({ templates, schemaStatement, schemaName, terminator })
					: schemaStatement;
			}

			const databaseStatement = wrapIfNotExistDatabase({
				templates,
				databaseName,
				terminator,
				databaseStatement: assignTemplates(templates.createDatabase, {
					name: databaseName,
					terminator: schemaTerminator,
				}),
			});

			if (ifNotExist) {
				return (
					databaseStatement +
					'\n\n' +
					wrapIfNotExistSchema({ templates, schemaStatement, schemaName, terminator })
				);
			}

			return databaseStatement + '\n\n' + schemaStatement;
		},

		createTable(
			{
				name,
				columns,
				checkConstraints,
				keyConstraints,
				options,
				schemaData,
				defaultConstraints,
				memoryOptimizedIndexes,
				persistence,
				ifNotExist,
			},
			isActivated,
		) {
			const tableTerminator = ifNotExist ? ';' : terminator;
			const tableName = getTableName(setPersistenceSpecificName(persistence, name), schemaData.schemaName);

			const dividedKeysConstraints = divideIntoActivatedAndDeactivated(
				keyConstraints.map(createKeyConstraint(templates, tableTerminator, isActivated)),
				key => key.statement,
			);
			const keyConstraintsString = generateConstraintsString(dividedKeysConstraints, isActivated);
			const columnStatements = joinActivatedAndDeactivatedStatements({ statements: columns, indent: '\n\t' });
			const tableStatement = assignTemplates(templates.createTable, {
				name: tableName,
				external: persistence === 'external' ? ' EXTERNAL' : '',
				column_definitions: columnStatements,
				checkConstraints: checkConstraints.length ? ',\n\t' + checkConstraints.join(',\n\t') : '',
				foreignKeyConstraints: '',
				options: getTableOptions(options),
				keyConstraints: keyConstraintsString,
				memoryOptimizedIndexes: memoryOptimizedIndexes.length
					? ',\n\t' +
						memoryOptimizedIndexes
							.map(createMemoryOptimizedIndex(isActivated))
							.map(index => commentIfDeactivated(index.statement, index))
							.join(',\n\t')
					: '',
				terminator: tableTerminator,
			});
			const defaultConstraintsStatements = defaultConstraints
				.map(data => createDefaultConstraint(templates, tableTerminator)(data, tableName))
				.join('\n');

			const fullTableStatement = [tableStatement, defaultConstraintsStatements].filter(Boolean).join('\n\n');

			return ifNotExist
				? wrapIfNotExistTable({
						tableStatement: fullTableStatement,
						templates,
						tableName,
						terminator,
					})
				: fullTableStatement;
		},

		convertColumnDefinition(columnDefinition) {
			const type = hasType(columnDefinition.type)
				? _.toUpper(columnDefinition.type)
				: getTableName(columnDefinition.type, columnDefinition.schemaName);
			const notNull = columnDefinition.nullable ? '' : ' NOT NULL';
			const primaryKey = columnDefinition.primaryKey ? ' PRIMARY KEY NONCLUSTERED NOT ENFORCED' : '';
			const defaultValue = !_.isUndefined(columnDefinition.default)
				? ' DEFAULT ' + decorateDefault(type, columnDefinition.default)
				: '';
			const sparse = columnDefinition.sparse ? ' SPARSE' : '';
			const maskedWithFunction = columnDefinition.maskedWithFunction
				? ` MASKED WITH (FUNCTION='${columnDefinition.maskedWithFunction}')`
				: '';
			const identityContainer = columnDefinition.identity && { identity: getIdentity(columnDefinition.identity) };
			const encryptedWith = !_.isEmpty(columnDefinition.encryption)
				? getEncryptedWith(columnDefinition.encryption[0])
				: '';
			const unique = columnDefinition.unique ? ' UNIQUE NOT ENFORCED' : '';

			return commentIfDeactivated(
				assignTemplates(templates.columnDefinition, {
					name: columnDefinition.name,
					type: decorateType(type, columnDefinition),
					primary_key: primaryKey + unique,
					not_null: notNull,
					default: defaultValue,
					collation: getCollation(columnDefinition.type, columnDefinition.collation),
					sparse,
					maskedWithFunction,
					encryptedWith,
					terminator,
					...identityContainer,
				}),
				columnDefinition,
			);
		},

		createIndex(tableName, index, dbData, isParentActivated = true) {
			const isActivated = checkIndexActivated(index);
			if (!isParentActivated) {
				return createTableIndex(terminator, tableName, index, isActivated && isParentActivated);
			}
			return commentIfDeactivated(
				createTableIndex(terminator, tableName, index, isActivated && isParentActivated),
				{
					isActivated,
				},
			);
		},

		createCheckConstraint(checkConstraint) {
			return assignTemplates(templates.checkConstraint, {
				name: checkConstraint.name,
				notForReplication: checkConstraint.enforceForReplication ? '' : ' NOT FOR REPLICATION',
				expression: _.trim(checkConstraint.expression).replace(/^\(([\s\S]*)\)$/, '$1'),
				terminator,
			});
		},

		createForeignKeyConstraint() {
			return '';
		},

		createForeignKey() {
			return '';
		},

		createView(
			{ name, keys, selectStatement, options, materialized, schemaData, ifNotExist },
			dbData,
			isActivated,
		) {
			const viewTerminator = ifNotExist ? ';' : terminator;
			const viewData = getViewData(keys, schemaData);

			if ((_.isEmpty(viewData.tables) || _.isEmpty(viewData.columns)) && !selectStatement) {
				return '';
			}

			let columnsAsString = viewData.columns.map(column => column.statement).join(',n\t\t');

			if (isActivated) {
				const dividedColumns = divideIntoActivatedAndDeactivated(viewData.columns, column => column.statement);
				const deactivatedColumnsString = dividedColumns.deactivatedItems.length
					? commentIfDeactivated(
							dividedColumns.deactivatedItems.join(',\n\t\t'),
							{ isActivated: false },
							true,
						)
					: '';
				columnsAsString = dividedColumns.activatedItems.join(',\n\t\t') + deactivatedColumnsString;
			}

			const viewName = getTableName(name, schemaData.schemaName);
			if (!materialized) {
				const viewStatement = assignTemplates(templates.createView, {
					name: viewName,
					select_statement: _.trim(selectStatement)
						? _.trim(tab(selectStatement)) + '\n'
						: assignTemplates(templates.viewSelectStatement, {
								tableName: viewData.tables.join(', '),
								keys: columnsAsString,
								terminator: viewTerminator,
							}),
					terminator: viewTerminator,
				});

				return ifNotExist
					? wrapIfNotExistView({ templates, viewStatement, viewName, terminator })
					: viewStatement;
			}

			const viewStatement = assignTemplates(templates.createView, {
				name: viewName,
				materialized: ' MATERIALIZED',
				options: getTableOptions(options),
				select_statement: _.trim(selectStatement)
					? _.trim(tab(selectStatement)) + '\n'
					: assignTemplates(templates.viewSelectStatement, {
							tableName: viewData.tables.join(', '),
							keys: columnsAsString,
							terminator: viewTerminator,
						}),
				terminator: viewTerminator,
			});

			return ifNotExist ? wrapIfNotExistView({ templates, viewStatement, viewName, terminator }) : viewStatement;
		},

		createUdt() {
			return '';
		},

		getDefaultType(type) {
			return defaultTypes[type];
		},

		getTypesDescriptors() {
			return types;
		},

		hasType(type) {
			return hasType(type);
		},

		hydrateColumn({ columnDefinition, jsonSchema, schemaData, parentJsonSchema }) {
			let encryption = [];

			if (Array.isArray(jsonSchema.encryption)) {
				encryption = jsonSchema.encryption.map(
					({ COLUMN_ENCRYPTION_KEY: key, ENCRYPTION_TYPE: type, ENCRYPTION_ALGORITHM: algorithm }) => ({
						key,
						type,
						algorithm,
					}),
				);
			} else if (_.isPlainObject(jsonSchema.encryption)) {
				encryption = [
					{
						key: jsonSchema.encryption.COLUMN_ENCRYPTION_KEY,
						type: jsonSchema.encryption.ENCRYPTION_TYPE,
						algorithm: jsonSchema.encryption.ENCRYPTION_ALGORITHM,
					},
				];
			}

			const isTempTableStartTimeColumn =
				jsonSchema.GUID === _.get(parentJsonSchema, 'periodForSystemTime[0].startTime[0].keyId', '');
			const isTempTableEndTimeColumn =
				jsonSchema.GUID === _.get(parentJsonSchema, 'periodForSystemTime[0].endTime[0].keyId', '');
			const isTempTableStartTimeColumnHidden =
				_.get(parentJsonSchema, 'periodForSystemTime[0].startTime[0].type', '') === 'hidden';
			const isTempTableEndTimeColumnHidden =
				_.get(parentJsonSchema, 'periodForSystemTime[0].startTime[0].type', '') === 'hidden';

			return Object.assign({}, columnDefinition, {
				default: jsonSchema.defaultConstraintName ? '' : columnDefinition.default,
				defaultConstraint: {
					name: jsonSchema.defaultConstraintName,
					value: columnDefinition.default,
				},
				primaryKey: keyHelper.isInlinePrimaryKey(jsonSchema),
				xmlConstraint: String(jsonSchema.XMLconstraint || ''),
				xmlSchemaCollection: String(jsonSchema.xml_schema_collection || ''),
				sparse: Boolean(jsonSchema.sparse),
				maskedWithFunction: String(jsonSchema.maskedWithFunction || ''),
				schemaName: schemaData.schemaName,
				unique: keyHelper.isInlineUnique(jsonSchema),
				isTempTableStartTimeColumn,
				isTempTableEndTimeColumn,
				isHidden: isTempTableStartTimeColumn
					? isTempTableStartTimeColumnHidden
					: isTempTableEndTimeColumnHidden,
				encryption,
				hasMaxLength: columnDefinition.hasMaxLength || jsonSchema.type === 'jsonObject',
				collation: jsonSchema.collate
					? clean({
							locale: jsonSchema.locale,
							caseSensitivity: jsonSchema.caseSensitivity,
							accentSensitivity: jsonSchema.accentSensitivity,
							kanaSensitivity: jsonSchema.kanaSensitivity,
							widthSensitivity: jsonSchema.widthSensitivity,
							variationSelectorSensitivity: jsonSchema.variationSelectorSensitivity,
							binarySort: jsonSchema.binarySort,
							utf8: jsonSchema.utf8,
						})
					: {},
				...(canHaveIdentity(jsonSchema.mode) && {
					identity: {
						seed: Number(_.get(jsonSchema, 'identity.identitySeed', 0)),
						increment: Number(_.get(jsonSchema, 'identity.identityIncrement', 0)),
					},
				}),
			});
		},

		hydrateIndex(indexData, tableData, schemaData) {
			const isMemoryOptimized = _.get(tableData, '[0].memory_optimized', false);

			if (isMemoryOptimized) {
				return;
			}

			return hydrateTableIndex(indexData, schemaData);
		},

		hydrateCheckConstraint(checkConstraint) {
			return {
				name: checkConstraint.chkConstrName,
				expression: checkConstraint.constrExpression,
				existingData: checkConstraint.constrCheck,
				enforceForUpserts: checkConstraint.constrEnforceUpserts,
				enforceForReplication: checkConstraint.constrEnforceReplication,
			};
		},

		hydrateSchema(containerData) {
			return {
				schemaName: containerData.name,
				databaseName: containerData.databaseName,
				ifNotExist: containerData.ifNotExist,
			};
		},

		hydrateTable({ tableData, entityData, jsonSchema, idToNameHashTable }) {
			const isMemoryOptimized = _.get(entityData, '[0].memory_optimized', false);
			const temporalTableTimeStartColumnName =
				idToNameHashTable[_.get(jsonSchema, 'periodForSystemTime[0].startTime[0].keyId', '')];
			const temporalTableTimeEndColumnName =
				idToNameHashTable[_.get(jsonSchema, 'periodForSystemTime[0].endTime[0].keyId', '')];
			return Object.assign({}, tableData, {
				foreignKeyConstraints: tableData.foreignKeyConstraints || [],
				keyConstraints: keyHelper.getTableKeyConstraints({ jsonSchema }),
				defaultConstraints: getDefaultConstraints(tableData.columnDefinitions),
				ifNotExist: jsonSchema.ifNotExist,
				persistence: _.get(entityData, '[0].persistence', ''),
				options: {
					memory_optimized: isMemoryOptimized,
					durability: _.get(entityData, '[0].durability', ''),
					systemVersioning: _.get(entityData, '[0].systemVersioning', false),
					historyTable: _.get(entityData, '[0].historyTable', ''),
					dataConsistencyCheck: _.get(entityData, '[0].dataConsistencyCheck', false),
					temporal: _.get(entityData, '[0].temporal', false),
					ledger: _.get(entityData, '[0].ledger', false),
					ledger_view: _.get(entityData, '[0].ledger_view'),
					transaction_id_column_name: _.get(entityData, '[0].transaction_id_column_name'),
					sequence_number_column_name: _.get(entityData, '[0].sequence_number_column_name'),
					operation_type_id_column_name: _.get(entityData, '[0].operation_type_id_column_name'),
					operation_type_desc_column_name: _.get(entityData, '[0].operation_type_desc_column_name'),
					append_only: _.get(entityData, '[0].append_only', false),
					temporalTableTimeStartColumnName,
					temporalTableTimeEndColumnName,
					indexing: _.get(entityData, '[0].indexing', ''),
					distribution: _.get(entityData, '[0].distribution', ''),
					hashColumn: _.get(entityData, '[0].hashColumn', []),
					partition: keyHelper.getTablePartitionKey(jsonSchema),
					indexingOrderColumn: _.get(entityData, '[0].indexingOrderColumn', []),
					clusteringColumn: _.get(entityData, '[0].compositeClusteringKey', []),
				},
				temporalTableTime: {
					startTime: temporalTableTimeStartColumnName,
					endTime: temporalTableTimeEndColumnName,
				},
				memoryOptimizedIndexes: isMemoryOptimized
					? getMemoryOptimizedIndexes(entityData, tableData.schemaData)
					: [],
			});
		},

		hydrateViewColumn(data) {
			return {
				dbName: _.get(data.containerData, '[0].databaseName', ''),
				schemaName: data.dbName,
				alias: data.alias,
				name: data.name,
				tableName: data.entityName,
				isActivated: data.isActivated,
			};
		},

		hydrateView({ viewData, entityData, relatedSchemas, relatedContainers }) {
			const firstTab = _.get(entityData, '[0]', {});
			const ifNotExist = _.get(entityData, '[0].ifNotExist');

			return {
				...viewData,
				selectStatement: firstTab.selectStatement || '',
				viewAttrbute: firstTab.viewAttrbute || '',
				materialized: firstTab.materialized,
				withCheckOption: Boolean(firstTab.withCheckOption),
				ifNotExist,
				options: {
					distribution: _.get(entityData, '[0].distribution', ''),
					hashColumn: _.get(entityData, '[0].hashColumn', []),
					forAppend: _.get(entityData, '[0].forAppend'),
				},
			};
		},

		commentIfDeactivated(statement, data, isPartOfLine) {
			return commentIfDeactivated(statement, data, isPartOfLine);
		},

		dropSchema(name) {
			return assignTemplates(templates.dropSchema, {
				terminator,
				name,
			});
		},

		dropTable(fullTableName) {
			return assignTemplates(templates.dropTable, {
				name: fullTableName,
				terminator,
			});
		},

		dropIndex(tableName, index) {
			const object = getTableName(tableName, index.schemaName);

			return assignTemplates(templates.dropIndex, {
				name: index.name,
				object,
				terminator,
			});
		},

		dropColumn(fullTableName, columnName) {
			const command = assignTemplates(templates.dropColumn, {
				name: columnName,
			});

			return assignTemplates(templates.alterTable, {
				tableName: fullTableName,
				command,
				terminator,
			});
		},

		addColumn(fullTableName, script) {
			const command = assignTemplates(templates.addColumn, {
				script,
			});

			return assignTemplates(templates.alterTable, {
				tableName: fullTableName,
				command,
				terminator,
			});
		},

		renameColumn(fullTableName, oldColumnName, newColumnName) {
			return assignTemplates(templates.renameColumn, {
				terminator: terminator === ';' ? '' : terminator,
				fullTableName: fullTableName,
				oldColumnName,
				newColumnName,
			});
		},

		alterColumn(fullTableName, columnDefinition) {
			const type = hasType(columnDefinition.type)
				? _.toUpper(columnDefinition.type)
				: getTableName(columnDefinition.type, columnDefinition.schemaName);
			const notNull = columnDefinition.nullable ? ' NULL' : ' NOT NULL';

			const command = assignTemplates(templates.alterColumn, {
				name: columnDefinition.name,
				type: decorateType(type, columnDefinition),
				not_null: notNull,
			});

			return assignTemplates(templates.alterTable, {
				tableName: fullTableName,
				command,
				terminator,
			});
		},

		dropView(fullViewName) {
			return assignTemplates(templates.dropView, {
				name: fullViewName,
				terminator,
			});
		},

		alterView({ name, keys, selectStatement, materialized, schemaData, ifNotExist }, isActivated) {
			const viewTerminator = ifNotExist ? ';' : terminator;
			const viewData = getViewData(keys, schemaData);

			if (materialized || ((_.isEmpty(viewData.tables) || _.isEmpty(viewData.columns)) && !selectStatement)) {
				return '';
			}

			let columnsAsString = viewData.columns.map(column => column.statement).join(',\n\t\t');

			if (isActivated) {
				const dividedColumns = divideIntoActivatedAndDeactivated(viewData.columns, column => column.statement);
				const deactivatedColumnsString = dividedColumns.deactivatedItems.length
					? commentIfDeactivated(
							dividedColumns.deactivatedItems.join(',\n\t\t'),
							{ isActivated: false },
							true,
						)
					: '';
				columnsAsString = dividedColumns.activatedItems.join(',\n\t\t') + deactivatedColumnsString;
			}

			const viewName = getTableName(name, schemaData.schemaName);
			const asSelectStatement = _.trim(selectStatement)
				? _.trim(tab(selectStatement)) + '\n'
				: assignTemplates(templates.viewSelectStatement, {
						tableName: viewData.tables.join(', '),
						keys: columnsAsString,
						terminator: viewTerminator,
					});

			return assignTemplates(templates.alterView, {
				name: viewName,
				select_statement: asSelectStatement,
				terminator: viewTerminator,
			});
		},
	};
};

module.exports = provider;
