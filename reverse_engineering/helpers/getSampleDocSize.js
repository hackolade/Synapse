const getSampleDocSize = (count, recordSamplingSettings) => {
	const limit = Math.ceil((count * recordSamplingSettings.relative.value) / 100);

	return Math.min(limit, recordSamplingSettings.maxValue);
};

module.exports = getSampleDocSize;
