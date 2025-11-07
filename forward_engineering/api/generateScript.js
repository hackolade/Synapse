const {
	getAlterContainersScripts,
	getAlterCollectionsScripts,
	getAlterViewScripts,
} = require('../helpers/alterScriptFromDeltaHelper');
const { commentDropStatements } = require('../helpers/commentDropStatements');

function generateScript(data, logger, callback, app) {
	try {
		const collection = JSON.parse(data.jsonSchema);
		if (!collection) {
			throw new Error(
				'"comparisonModelCollection" is not found. Alter script can be generated only from Delta model',
			);
		}

		const containersScripts = getAlterContainersScripts(collection, app, data.options);
		const collectionsScripts = getAlterCollectionsScripts(collection, app, data.options);
		const viewScripts = getAlterViewScripts(collection, app, data.options);
		const script = [...containersScripts, ...collectionsScripts, ...viewScripts].join('\n\n');

		const applyDropStatements = data.options?.additionalOptions?.some(
			option => option.id === 'applyDropStatements' && option.value,
		);
		callback(null, applyDropStatements ? script : commentDropStatements(script));
	} catch (error) {
		logger.log('error', { message: error.message, stack: error.stack }, 'Azure Synapse Forward-Engineering Error');

		callback({ message: error.message, stack: error.stack });
	}
}

module.exports = {
	generateScript,
};
