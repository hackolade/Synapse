const getOptionsFromConnectionInfo = connectionInfo => ({
	includeEmptyCollection: connectionInfo.includeEmptyCollection,
	isFieldOrderAlphabetic: connectionInfo.fieldInference.active === 'alphabetical',
	recordSamplingSettings: {
		...connectionInfo.recordSamplingSettings,
	},
});

module.exports = getOptionsFromConnectionInfo;