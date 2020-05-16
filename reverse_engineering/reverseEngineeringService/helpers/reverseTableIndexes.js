const COLUMNSTORE = 'Columnstore';
const INDEX = 'Index';
const FULL_TEXT = 'FullText';
const SPATIAL = 'Spatial';

const handleDataCompression = dataCompression => {
	const compressionTypes = ['NONE', 'ROW', 'PAGE', 'COLUMNSTORE', 'COLUMNSTORE_ARCHIVE'];
	const type = compressionTypes.find(type => dataCompression.includes(type));
	return type || '';
};

const isClusteredIndex = index => !index.type_desc.includes('NONCLUSTERED');
const getIndexType = index => {
	if (index.type === 5 || index.type === 6) {
		return COLUMNSTORE;
	} else if (index.type === 4) {
		return SPATIAL;
	} else if (index.type === 'FullText') {
		return FULL_TEXT;
	} else {
		return INDEX;
	}
};

const getIndexData = index => ({
	indxName: index.IndexName,
	ALLOW_ROW_LOCKS: index.allow_row_locks,
	ALLOW_PAGE_LOCKS: index.allow_page_locks,
	uniqueIndx: index.is_unique,
	clusteredIndx: isClusteredIndex(index),
	IGNORE_DUP_KEY: index.ignore_dup_key,
	indxType: getIndexType(index),
	COMPRESSION_DELAY: index.compression_delay,
	OPTIMIZE_FOR_SEQUENTIAL_KEY: Boolean(index.optimize_for_sequential_key),
	PAD_INDEX: Boolean(index.is_padded),
	FILLFACTOR: index.fill_factor,
	DATA_COMPRESSION: handleDataCompression(index.dataCompression || ''),
	indxHash: index.type_desc === "NONCLUSTERED HASH",
	indxBucketCount: !isNaN(Number(index.total_bucket_count)) ? Number(index.total_bucket_count) : '',
	indxFilterExpression: index.has_filter ? index.filter_definition : '',
});

const getFullTextIndex = index => ({
	indxName: index.IndexName,
	indxType: FULL_TEXT,
	indxFullTextKeyIndex: index.indexKeyName,
	indxFullTextCatalogName: index.catalogName,
	indxFullTextFileGroup: index.fileGroup === 'PRIMARY' ? '' : index.fileGroup,
	indxFullTextChangeTracking: index.changeTracking,
	indxFullTextStopList: ['OFF', 'SYSTEM'].includes(index.stopListName) ? index.stopListName : 'Stoplist name',
	indxFullTextStopListName: !['OFF', 'SYSTEM'].includes(index.stopListName) ? index.stopListName : '',
	indxFullTextSearchPropertyList: index.searchPropertyList,
});

const getSpatialIndex = index => {
	return {
		indxName: index.IndexName,
		indxType: getIndexType(index),
		indxUsing: index.tessellation_scheme,
		indxBoundingBox: ['XMIN', 'YMIN', 'XMAX', 'YMAX'].reduce((result, key) => isNaN(index[key]) ? result : { ...result, [key]: Number(index[key]) }, {}),
		indxGrids: ['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4'].reduce((result, key) => !index[key] ? result : { ...result, [key]: index[key]}, []),
		CELLS_PER_OBJECT: index.CELLS_PER_OBJECT,
		ALLOW_ROW_LOCKS: index.allow_row_locks,
		ALLOW_PAGE_LOCKS: index.allow_page_locks,
		IGNORE_DUP_KEY: index.ignore_dup_key,
		COMPRESSION_DELAY: index.compression_delay,
		PAD_INDEX: Boolean(index.is_padded),
		FILLFACTOR: index.fill_factor,
		DATA_COMPRESSION: handleDataCompression(index.dataCompression || ''),
	};
};

const reverseIndex = index => {
	if (getIndexType(index) === SPATIAL) {
		return getSpatialIndex(index);
	} else if (getIndexType(index) === FULL_TEXT) {
		return getFullTextIndex(index);
	} else {
		return getIndexData(index);
	}
};

const reverseIndexKey = index => {
	const indexType = getIndexType(index);
	if (index.is_included_column && indexType !== COLUMNSTORE) {
		return null;
	}

	return {
		name: index.columnName,
		type: index.is_descending_key ? 'descending' : 'ascending',
	};
};

const reverseIncludedKey = index => {
	const indexType = getIndexType(index);
	if (!index.is_included_column || indexType === COLUMNSTORE) {
		return null;
	}

	return {
		name: index.columnName,
		type: index.is_descending_key ? 'descending' : 'ascending',
	};
};

const getFullTextKeys = (index) => {
	const key = { name: index.columnName };

	if (!index.columnTypeName && !index.language) {
		return { key };
	}

	const properties = {
		columnType: index.columnTypeName,
		languageTerm: index.language,
		statisticalSemantics: Boolean(index.statistical_semantics),
	};

	return {
		key,
		properties
	};
};

const addKeys = (indexData, index) => {
	if (getIndexType(index) === FULL_TEXT) {
		const data = getFullTextKeys(index);
		return {
			...indexData,
			indxKey: [...(indexData.indxKey || []), data.key],
			indxFullTextKeysProperties: data.properties ? [...(indexData.indxFullTextKeysProperties || []), data.properties] : [],
		};
	} else if (getIndexType(index) === SPATIAL) {
		return {
			...indexData,
			indxKey: [...(indexData.indxKey || []), { name: index.columnName }],
		};
	} else {
		return {
			...indexData,
			indxKey: [...(indexData.indxKey || []), reverseIndexKey(index)].filter(Boolean),
			indxInclude: [...(indexData.indxInclude || []), reverseIncludedKey(index)].filter(Boolean),
		};
	}
};

const reverseTableIndexes = tableIndexes =>
	Object.values(tableIndexes.reduce((indexList, index) => {
		let existedIndex = indexList[index.IndexName];

		if (!existedIndex) {
			existedIndex = reverseIndex(index);
		}

		return {
			...indexList,
			[index.IndexName]: addKeys(existedIndex, index)
		};
	}, {}));

module.exports = reverseTableIndexes;
