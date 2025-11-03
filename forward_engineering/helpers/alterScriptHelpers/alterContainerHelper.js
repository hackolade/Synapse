const _ = require('lodash');
const { getDbData } = require('../../utils/general');

const alterContainerHelper = (app, options) => {
	const ddlProvider = require('../../ddlProvider')(null, options, app);

	const getAddContainerScript = containerData => {
		const constructedDbData = getDbData([containerData]);
		const schemaData = ddlProvider.hydrateSchema(constructedDbData);

		return _.trim(ddlProvider.createSchema(schemaData));
	};

	const getDeleteContainerScript = containerName => {
		return ddlProvider.dropSchema(containerName);
	};

	return {
		getAddContainerScript,
		getDeleteContainerScript,
	};
};

module.exports = alterContainerHelper;
