const getOptionsFromConnectionInfo = connectionInfo => ({
	includeEmptyCollection: connectionInfo.includeEmptyCollection,
	isFieldOrderAlphabetic: connectionInfo.fieldInference.active === 'alphabetical',
	rowCollectionSettings: {
		isAbsoluteValue: connectionInfo.recordSamplingSettings.active === 'absolute',
		value: connectionInfo.recordSamplingSettings.active === 'absolute'
			? connectionInfo.recordSamplingSettings.absolute.value
			: connectionInfo.recordSamplingSettings.relative.value,
	},
});

module.exports = getOptionsFromConnectionInfo;