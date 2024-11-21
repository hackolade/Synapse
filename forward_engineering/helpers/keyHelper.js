const _ = require('lodash');

module.exports = app => {
	const { clean } = app.require('@hackolade/ddl-fe-utils').general;

	const mapProperties = (jsonSchema, iteratee) => {
		return Object.entries(jsonSchema.properties).map(iteratee);
	};

	const isInlineUnique = column => {
		if (column.compositeUniqueKey) {
			return false;
		} else if (!column.unique) {
			return false;
		} else if (!_.isEmpty(column.uniqueKeyOptions)) {
			return false;
		} else {
			return true;
		}
	};

	const isInlinePrimaryKey = column => {
		if (column.compositeUniqueKey) {
			return false;
		} else if (column.compositePrimaryKey) {
			return false;
		} else if (!column.primaryKey) {
			return false;
		} else if (!_.isEmpty(column.primaryKeyOptions)) {
			return false;
		} else {
			return true;
		}
	};

	const isUnique = column => {
		if (column.compositeUniqueKey) {
			return false;
		} else if (!column.unique) {
			return false;
		} else if (_.isEmpty(column.uniqueKeyOptions)) {
			return false;
		} else {
			return true;
		}
	};

	const isPrimaryKey = column => {
		if (column.compositeUniqueKey) {
			return false;
		} else if (column.compositePrimaryKey) {
			return false;
		} else if (!column.primaryKey) {
			return false;
		} else if (_.isEmpty(column.primaryKeyOptions)) {
			return false;
		} else {
			return true;
		}
	};

	const getOrder = order => {
		if (_.toLower(order) === 'asc') {
			return 'ASC';
		} else if (_.toLower(order) === 'desc') {
			return 'DESC';
		} else {
			return '';
		}
	};

	const hydrateUniqueOptions = (options, columnName, isActivated) =>
		clean({
			keyType: 'UNIQUE',
			name: options['constraintName'],
			columns: [
				{
					name: columnName,
					order: getOrder(options['order']),
					isActivated: isActivated,
				},
			],
			partition: options['partitionName'],
			clustered: options['clustered'],
			indexOption: clean({
				statisticsNoRecompute: options['staticticsNorecompute'],
				statisticsIncremental: options['statisticsIncremental'],
				ignoreDuplicateKey: options['ignoreDuplicate'],
				fillFactor: options['fillFactor'],
				allowRowLocks: Boolean(options['allowRowLocks']),
				allowPageLocks: Boolean(options['allowPageLocks']),
				optimizeForSequentialKey: options['isOptimizedForSequentialKey'],
				padIndex: options['isPadded'],
				dataCompression: options['dataCompression'],
			}),
		});

	const hydratePrimaryKeyOptions = (options, columnName, isActivated) =>
		clean({
			keyType: 'PRIMARY KEY',
			name: options['constraintName'],
			columns: [
				{
					name: columnName,
					order: getOrder(options['order']),
					isActivated: isActivated,
				},
			],
			partition: options['partitionName'],
			clustered: options['clustered'],
			indexOption: clean({
				statisticsNoRecompute: options['staticticsNorecompute'],
				statisticsIncremental: options['statisticsIncremental'],
				ignoreDuplicateKey: options['ignoreDuplicate'],
				fillFactor: options['fillFactor'],
				allowRowLocks: Boolean(options['allowRowLocks']),
				allowPageLocks: Boolean(options['allowPageLocks']),
				optimizeForSequentialKey: options['isOptimizedForSequentialKey'],
				padIndex: options['isPadded'],
				dataCompression: options['dataCompression'],
			}),
		});

	const findName = (keyId, properties) => {
		return Object.keys(properties).find(name => properties[name].GUID === keyId);
	};

	const checkIfActivated = (keyId, properties) => {
		return _.get(
			Object.values(properties).find(prop => prop.GUID === keyId),
			'isActivated',
			true,
		);
	};

	const getKeys = (keys, jsonSchema) => {
		return keys.map(key => {
			return {
				name: findName(key.keyId, jsonSchema.properties),
				order: key.type === 'descending' ? 'DESC' : 'ASC',
				isActivated: checkIfActivated(key.keyId, jsonSchema.properties),
			};
		});
	};

	const getCompositePrimaryKeys = jsonSchema => {
		if (!Array.isArray(jsonSchema.primaryKey)) {
			return [];
		}

		return jsonSchema.primaryKey
			.filter(primaryKey => !_.isEmpty(primaryKey.compositePrimaryKey))
			.map(primaryKey => ({
				...hydratePrimaryKeyOptions(primaryKey),
				columns: getKeys(primaryKey.compositePrimaryKey, jsonSchema),
			}));
	};

	const getCompositeUniqueKeys = jsonSchema => {
		if (!Array.isArray(jsonSchema.uniqueKey)) {
			return [];
		}

		return jsonSchema.uniqueKey
			.filter(uniqueKey => !_.isEmpty(uniqueKey.compositeUniqueKey))
			.map(uniqueKey => ({
				...hydrateUniqueOptions(uniqueKey),
				columns: getKeys(uniqueKey.compositeUniqueKey, jsonSchema),
			}));
	};

	const getTableKeyConstraints = ({ jsonSchema }) => {
		if (!jsonSchema.properties) {
			return [];
		}

		const uniqueConstraints = _.flatten(
			mapProperties(jsonSchema, ([name, columnSchema]) => {
				if (!isUnique(columnSchema)) {
					return [];
				} else {
					return columnSchema.uniqueKeyOptions.map(options =>
						hydrateUniqueOptions(options, name, columnSchema.isActivated),
					);
				}
			}),
		).filter(Boolean);
		const primaryKeyConstraints = mapProperties(jsonSchema, ([name, columnSchema]) => {
			if (!isPrimaryKey(columnSchema)) {
				return;
			} else {
				return hydratePrimaryKeyOptions(columnSchema.primaryKeyOptions, name, columnSchema.isActivated);
			}
		}).filter(Boolean);

		return [
			...getCompositePrimaryKeys(jsonSchema),
			...primaryKeyConstraints,
			...getCompositeUniqueKeys(jsonSchema),
			...uniqueConstraints,
		];
	};

	const getTablePartitionKey = jsonSchema => {
		const partitionKeys = getKeys(jsonSchema.partition || [], jsonSchema);
		return {
			..._.get(partitionKeys, '[0]', {}),
			boundaryValue: jsonSchema.boundaryValue,
			rangeForValues: jsonSchema.rangeForValues,
		};
	};

	return {
		getTableKeyConstraints,
		isInlineUnique,
		isInlinePrimaryKey,
		getTablePartitionKey,
	};
};
