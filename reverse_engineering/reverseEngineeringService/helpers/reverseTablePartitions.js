const mapPartitions = (partitions, property) => partitions.map(partition => partition[property]);

const getValue = partitions => {
	return mapPartitions(partitions, 'value')
		.filter(value => value !== null)
		.join(', ');
};

const getRange = partitions => {
	const ranges = mapPartitions(partitions, 'range');

	return ranges.length && ranges[0] === true ? 'right' : 'left';
};

const getColumnName = partitions => {
	const columnNames = mapPartitions(partitions, 'name');

	return columnNames.length ? columnNames[0] : '';
};

const reverseTablePartitions = partitions => {
	if (!partitions.length) {
		return {};
	}
	return {
		boundaryValue: getValue(partitions),
		rangeForValues: getRange(partitions),
		partition: [{ name: getColumnName(partitions) }],
	};
};

module.exports = reverseTablePartitions;
