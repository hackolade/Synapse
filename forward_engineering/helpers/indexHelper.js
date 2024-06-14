const templates = require('../configs/templates');
const { commentIfDeactivated } = require('./commentIfDeactivated');

module.exports = app => {
	const _ = app.require('lodash');
	const { filterColumnStoreProperties, getTableName } = require('./general')(app);
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { divideIntoActivatedAndDeactivated, checkAllKeysDeactivated } =
		app.require('@hackolade/ddl-fe-utils').general;

	const getRelationOptionsIndex = index => {
		let result = [];

		if (index.padIndex) {
			result.push('PAD_INDEX = ON');
		}

		if (index.fillFactor) {
			result.push('FILLFACTOR = ' + index.fillFactor);
		}

		if (index.ignoreDuplicateKey) {
			result.push('IGNORE_DUP_KEY = ON');
		}

		if (index.statisticsNoRecompute) {
			result.push('STATISTICS_NORECOMPUTE = ON');
		}

		if (index.statisticsIncremental) {
			result.push('STATISTICS_INCREMENTAL = ON');
		}

		if (index.allowRowLocks === false) {
			result.push('ALLOW_ROW_LOCKS = OFF');
		}

		if (index.allowPageLocks === false) {
			result.push('ALLOW_PAGE_LOCKS = OFF');
		}

		if (index.optimizeForSequentialKey) {
			result.push('OPTIMIZE_FOR_SEQUENTIAL_KEY = ON');
		}

		if (index.type === 'columnstore' && index.compressionDelay) {
			result.push('COMPRESSION_DELAY = ' + index.compressionDelay);
		}

		if (index.dataCompression && index.dataCompression !== 'NONE') {
			result.push('DATA_COMPRESSION = ' + index.dataCompression);
		}

		return result;
	};

	const getIndexOptions = indexData => {
		let result = [];

		if (indexData.dropExisting) {
			result.unshift(`DROP_EXISTING = ON`);
		}
		return result;
	};

	const createIndexOptions = options => {
		return options.length ? '\n\tWITH (\n\t\t' + options.join(',\n\t\t') + '\n\t)' : '';
	};

	const getIndexKeys = (keys, iterate, isParentActivated) => {
		const dividedKeys = divideIntoActivatedAndDeactivated(keys, iterate);

		const deactivatedKeys = dividedKeys.deactivatedItems.join(', ');
		const commentedKeys = deactivatedKeys
			? commentIfDeactivated(deactivatedKeys, { isActivated: false }, true)
			: '';

		const activatedKeys = dividedKeys.activatedItems.join(', ');

		return isParentActivated
			? activatedKeys + commentedKeys
			: activatedKeys + (deactivatedKeys ? ', ' : '') + deactivatedKeys;
	};

	const createIndex = (terminator, tableName, index, isParentActivated = true) => {
		if (_.isEmpty(index.keys) || !index.name) {
			return '';
		}

		const indexOptions = getIndexOptions(index);
		const keys = getIndexKeys(
			index.keys,
			key => `[${key.name}]` + (_.toLower(key.type) === 'descending' ? ' DESC' : ''),
			isParentActivated,
		);

		const clustered = index.clustered ? ` CLUSTERED` : ' NONCLUSTERED';

		return assignTemplates(templates.index, {
			name: index.name,
			clustered,
			table: getTableName(tableName, index.schemaName),
			keys,
			index_options: createIndexOptions(indexOptions),
			terminator,
		});
	};

	const createColumnStoreIndex = (terminator, tableName, index, isParentActivated = true) => {
		if (!index.name) {
			return '';
		}

		const indexOptions = getIndexOptions(index);
		const order = getIndexKeys(index.orderKeys || [], key => `[${key.name}]`, isParentActivated);

		return assignTemplates(templates.columnStoreIndex, {
			name: index.name,
			table: getTableName(tableName, index.schemaName),
			order: order ? `\n\tORDER (${order})` : '',
			index_options: createIndexOptions(indexOptions),
			terminator,
		});
	};

	const createTableIndex = (terminator, tableName, index, isParentActivated) => {
		if (index.type === 'columnstore') {
			return createColumnStoreIndex(terminator, tableName, index, isParentActivated);
		}
		return createIndex(terminator, tableName, index, isParentActivated);
	};

	const createMemoryOptimizedClusteredIndex = indexData => {
		let index = 'CLUSTERED COLUMNSTORE';

		if (indexData.compressionDelay) {
			index += ` WITH (COMPRESSION_DELAY = ${indexData.compressionDelay})`;
		}

		if (indexData.fileGroupName) {
			index += ` ON ${indexData.fileGroupName}`;
		}

		return index;
	};

	const createMemoryOptimizedIndex = isParentActivated => indexData => {
		let index = `INDEX ${indexData.name}`;

		if (indexData.clustered) {
			return { statement: index + ' ' + createMemoryOptimizedClusteredIndex(indexData), isActivated: true };
		}

		const isAllKeysDeactivated = checkAllKeysDeactivated(indexData.keys);

		index += ' NONCLUSTERED';

		if (indexData.unique) {
			index += ' UNIQUE';
		}

		if (indexData.hash) {
			const keys = divideIntoActivatedAndDeactivated(indexData.keys, key => `[${key.name}]`);
			const activatedKeys = keys.activatedItems.join(', ');
			const deactivatedKeys = keys.deactivatedItems.length
				? commentIfDeactivated(
						keys.deactivatedItems.join(', '),
						{
							isActivated: !isParentActivated,
						},
						true,
					)
				: '';
			index += ` HASH (${activatedKeys}${
				activatedKeys.length && deactivatedKeys.length && !deactivatedKeys.startsWith('/*') ? ', ' : ''
			}${deactivatedKeys})`;

			if (indexData.bucketCount) {
				index += ` WITH (BUCKET_COUNT=${indexData.bucketCount})`;
			}
		} else {
			const keys = divideIntoActivatedAndDeactivated(
				indexData.keys,
				key => `[${key.name}]${_.toLower(key.type) === 'descending' ? ' DESC' : ''}`,
			);
			const activatedKeys = keys.activatedItems.join(', ');
			const deactivatedKeys = keys.deactivatedItems.length
				? commentIfDeactivated(
						keys.deactivatedItems.join(', '),
						{
							isActivated: !isParentActivated,
						},
						true,
					)
				: '';

			index += ` (${activatedKeys}${
				activatedKeys.length && deactivatedKeys.length && !deactivatedKeys.startsWith('/*') ? ', ' : ''
			}${deactivatedKeys})`;

			if (indexData.fileGroupName) {
				index += ` ON ${indexData.fileGroupName}`;
			}
		}

		return { statement: index, isActivated: !isAllKeysDeactivated };
	};

	const hydrateIndex = (indexData, schemaData) => {
		const toArray = value => (Array.isArray(value) ? value : []);

		return filterColumnStoreProperties({
			name: indexData.indxName,
			isActivated: indexData.isActivated,
			type: _.toLower(indexData.indxType),
			clustered: indexData.clusteredIndx,
			keys: toArray(indexData.indxKey),
			orderKeys: toArray(indexData.orderKey),
			dropExisting: indexData.DROP_EXISTING,
			schemaName: schemaData.schemaName,
		});
	};

	const hydrateMemoryOptimizedIndex = schemaData => indexData => {
		let index = hydrateIndex(indexData, schemaData);

		return {
			name: index.name,
			isActivated: index.isActivated,
			clustered: index.clustered,
			hash: indexData.indxHash,
			unique: index.unique,
			keys: index.keys,
			bucketCount: !isNaN(indexData.indxBucketCount) ? indexData.indxBucketCount : -1,
			fileGroupName: indexData.indxFileGroupName,
			compressionDelay: index.compressionDelay,
		};
	};

	const hydrateFullTextIndex = (indexData, schemaData) => {
		const generalIndex = hydrateIndex(indexData, schemaData);

		return {
			type: 'fulltext',
			isActivated: indexData.isActivated,
			keys: Array.isArray(indexData.indxFullTextKeysProperties)
				? generalIndex.keys.map((item, i) => {
						const properties = indexData.indxFullTextKeysProperties[i];

						if (!properties) {
							return item;
						} else {
							return {
								...item,
								columnType: properties.columnType,
								languageTerm: properties.languageTerm,
								statisticalSemantics: properties.statisticalSemantics,
							};
						}
					})
				: generalIndex.keys,
			keyIndex: indexData.indxFullTextKeyIndex,
			catalogName: indexData.indxFullTextCatalogName,
			fileGroup: indexData.indxFullTextFileGroup,
			changeTracking:
				indexData.indxFullTextChangeTracking === 'OFF' && indexData.indxFullTextNoPopulation
					? 'OFF, NO POPULATION'
					: indexData.indxFullTextChangeTracking,
			stopList:
				indexData.indxFullTextStopList === 'Stoplist name'
					? indexData.indxFullTextStopListName
					: indexData.indxFullTextStopList,
			searchPropertyList: indexData.indxFullTextSearchPropertyList,
			schemaName: schemaData.schemaName,
		};
	};

	const hydrateSpatialIndex = (indexData, schemaData) => {
		const generalIndex = hydrateIndex(indexData, schemaData);

		return {
			..._.pick(generalIndex, [
				'name',
				'type',
				'padIndex',
				'fillFactor',
				'ignoreDuplicateKey',
				'statisticsNoRecompute',
				'allowRowLocks',
				'allowPageLocks',
				'dataCompression',
				'isActivated',
			]),
			column: generalIndex.keys[0],
			using: indexData.indxUsing,
			boundingBox:
				!_.isEmpty(indexData.indxBoundingBox) &&
				['GEOMETRY_AUTO_GRID', 'GEOMETRY_GRID'].includes(indexData.indxUsing)
					? indexData.indxBoundingBox
					: {},
			grids:
				!_.isEmpty(indexData.indxGrids) && ['GEOMETRY_GRID', 'GEOGRAPHY_GRID'].includes(indexData.indxUsing)
					? indexData.indxGrids
					: [],
			cellsPerObject: indexData.CELLS_PER_OBJECT,
			sortInTempdb: indexData.SORT_IN_TEMPDB,
			dropExisting: indexData.DROP_EXISTING,
			maxdop: indexData.MAXDOP,
			schemaName: schemaData.schemaName,
		};
	};

	const hydrateTableIndex = (indexData, schemaData) => {
		if (indexData.indxType === 'Spatial') {
			return hydrateSpatialIndex(indexData, schemaData);
		} else if (indexData.indxType === 'FullText') {
			return hydrateFullTextIndex(indexData, schemaData);
		} else {
			return hydrateIndex(indexData, schemaData);
		}
	};

	const getMemoryOptimizedIndexes = (tableData, schemaData) => {
		const indexTab = tableData.find(tab => _.has(tab, 'Indxs'));

		if (!indexTab) {
			return [];
		}

		return indexTab.Indxs.map(hydrateMemoryOptimizedIndex(schemaData));
	};

	return {
		getRelationOptionsIndex,
		createIndex,
		hydrateIndex,
		hydrateMemoryOptimizedIndex,
		createMemoryOptimizedIndex,
		hydrateTableIndex,
		createTableIndex,
		getMemoryOptimizedIndexes,
	};
};
