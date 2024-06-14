const { commentIfDeactivated } = require('./commentIfDeactivated');
const types = require('../configs/types');
const templates = require('../configs/templates');

module.exports = app => {
	const _ = app.require('lodash');
	const generalHasType = app.require('@hackolade/ddl-fe-utils').general.hasType;
	const { decorateDefault } = require('./columnDefinitionHelper')(app);
	const { checkAllKeysDeactivated } = app.require('@hackolade/ddl-fe-utils').general;
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');

	const ORDERED_INDEX = 'clustered columnstore index order';
	const CLUSTERED_INDEX = 'clustered index';
	const HASH_DISTRIBUTION = 'hash';

	const isString = type => ['VARCHAR', 'CHAR', 'NCHAR', 'NVARCHAR'].includes(_.toUpper(type));

	const getTableName = (tableName, schemaName) => {
		if (schemaName) {
			return `[${schemaName}].[${tableName}]`;
		} else {
			return `[${tableName}]`;
		}
	};

	const getDefaultValue = (defaultValue, defaultConstraintName, type) => {
		if (_.isUndefined(defaultValue)) {
			return '';
		}
		if (!_.isUndefined(defaultConstraintName)) {
			return '';
		}
		return ` DEFAULT ${decorateDefault(type, defaultValue)}`;
	};

	const getKeyWithAlias = key => {
		if (!key) {
			return '';
		}

		if (key.alias) {
			return `[${key.name}] as [${key.alias}]`;
		} else {
			return `[${key.name}]`;
		}
	};

	const getTableOptions = options => {
		if (!options) {
			return '';
		}

		const partition = _.get(options, 'partition', {});
		let optionsStatements = [];
		if (options.indexing) {
			let statement = _.toUpper(options.indexing);
			if (options.indexing === ORDERED_INDEX) {
				statement += '(';
				statement += options.indexingOrderColumn.map(({ name }) => `[${name}]`).join(', ');
				statement += ')';
			}

			if (options.indexing === CLUSTERED_INDEX) {
				statement += '(';
				statement += options.clusteringColumn.map(({ name }) => `[${name}]`).join(', ');
				statement += ')';
			}

			optionsStatements.push(statement);
		}

		if (partition.name) {
			const range = _.toUpper(partition.rangeForValues || 'LEFT');
			const values = partition.boundaryValue || '';
			const statement = assignTemplates(templates.partition, { name: partition.name, range, values });

			optionsStatements.push(commentIfDeactivated(statement, { isActivated: partition.isActivated }));
		}

		if (options.distribution) {
			let statement = `DISTRIBUTION = ${_.toUpper(options.distribution)}`;

			if (options.distribution === HASH_DISTRIBUTION) {
				statement += '(';
				statement += options.hashColumn.map(({ name }) => `[${name}]`).join(', ');
				statement += ')';
			}

			optionsStatements.push(statement);
		}

		if (options.forAppend) {
			optionsStatements.push('FOR_APPEND');
		}

		if (_.isEmpty(optionsStatements)) {
			return '';
		}

		return `WITH (\n\t${optionsStatements.join(',\n\t')}\n)`;
	};

	const hasType = type => {
		return generalHasType(types, type);
	};

	const getViewData = (keys, schemaData) => {
		if (!Array.isArray(keys)) {
			return { tables: [], columns: [] };
		}

		return keys.reduce(
			(result, key) => {
				if (!key.tableName) {
					result.columns.push(getKeyWithAlias(key));

					return result;
				}

				let tableName = getTableName(key.tableName, key.schemaName);

				if (key.dbName && key.dbName !== schemaData.databaseName) {
					tableName = `[${key.dbName}].` + tableName;
				}

				if (!result.tables.includes(tableName)) {
					result.tables.push(tableName);
				}

				result.columns.push({
					statement: `${tableName}.${getKeyWithAlias(key)}`,
					isActivated: key.isActivated,
				});

				return result;
			},
			{
				tables: [],
				columns: [],
			},
		);
	};

	const filterColumnStoreProperties = index => {
		if (index.type !== 'columnstore') {
			return index;
		}
		const unsupportedProperties = [
			'allowRowLocks',
			'allowPageLocks',
			'padIndex',
			'fillFactor',
			'ignoreDuplicateKey',
		];

		return Object.keys(index).reduce((result, property) => {
			if (unsupportedProperties.includes(property)) {
				return result;
			} else {
				return Object.assign({}, result, {
					[property]: index[property],
				});
			}
		}, {});
	};

	const getDefaultConstraints = columnDefinitions => {
		if (!Array.isArray(columnDefinitions)) {
			return [];
		}

		return columnDefinitions
			.filter(
				column => _.get(column, 'defaultConstraint.name') && !_.isNil(_.get(column, 'defaultConstraint.value')),
			)
			.map(column => ({
				columnName: column.name,
				constraintName: column.defaultConstraint.name,
				value: decorateDefault(column.type, column.defaultConstraint.value),
			}));
	};

	const foreignKeysToString = keys => {
		if (Array.isArray(keys)) {
			const activatedKeys = keys
				.filter(key => _.get(key, 'isActivated', true))
				.map(key => `[${key.name.trim()}]`);
			const deactivatedKeys = keys
				.filter(key => !_.get(key, 'isActivated', true))
				.map(key => `[${key.name.trim()}]`);
			const deactivatedKeysAsString = deactivatedKeys.length
				? commentIfDeactivated(deactivatedKeys, { isActivated: false }, true)
				: '';

			return activatedKeys.join(', ') + deactivatedKeysAsString;
		}
		return keys;
	};

	const foreignActiveKeysToString = keys => {
		return keys.map(key => key.name.trim()).join(', ');
	};

	const trimBraces = expression =>
		/^\(([\s\S]+?)\)$/i.test(_.trim(expression))
			? _.trim(expression).replace(/^\(([\s\S]+?)\)$/i, '$1')
			: expression;

	const checkIndexActivated = index => {
		if (index.isActivated === false) {
			return false;
		}

		const isAllKeysDeactivated = checkAllKeysDeactivated(_.get(index, 'keys', []));
		const isAllIncludesDeactivated = checkAllKeysDeactivated(_.get(index, 'include', []));
		const isColumnDeactivated = !_.get(index, 'column.isActivated', true);

		return !isAllKeysDeactivated && !isAllIncludesDeactivated && !isColumnDeactivated;
	};

	const getTempTableTime = (isTempTableStartTimeColumn, isTempTableEndTimeColumn, isHidden) => {
		if (isTempTableStartTimeColumn) {
			return ` GENERATED ALWAYS AS ROW START${isHidden ? ' HIDDEN' : ''}`;
		}
		if (isTempTableEndTimeColumn) {
			return ` GENERATED ALWAYS AS ROW END${isHidden ? ' HIDDEN' : ''}`;
		}
		return '';
	};

	const getCollation = (type, collation) => {
		if (!isString(type)) {
			return '';
		}

		if (_.isEmpty(collation)) {
			return '';
		}

		return (
			' COLLATE ' +
			Object.entries(collation)
				.map(([key, collationValue]) => {
					return collationValue;
				})
				.join('_')
		);
	};

	const setPersistenceSpecificName = (persistence, name) => {
		if (persistence !== 'temporary') {
			return name;
		}

		if (_.first(name) === '#') {
			return name;
		}

		return `#${name}`;
	};

	return {
		filterColumnStoreProperties,
		getKeyWithAlias,
		getTableName,
		getTableOptions,
		hasType,
		getViewData,
		getDefaultConstraints,
		foreignKeysToString,
		trimBraces,
		checkIndexActivated,
		foreignActiveKeysToString,
		getDefaultValue,
		getTempTableTime,
		getCollation,
		setPersistenceSpecificName,
	};
};
