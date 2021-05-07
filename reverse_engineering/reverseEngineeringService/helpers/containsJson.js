const containsJson = (tableInfo) => {
	return tableInfo.some(item => {
		if (item['DATA_TYPE'] !== 'nvarchar') {
			return false;
		}

		if (item['CHARACTER_MAXIMUM_LENGTH'] >= 0 && item['CHARACTER_MAXIMUM_LENGTH'] < 4000) {
			return false;
		}

		return true;
	});
};

module.exports = containsJson;
