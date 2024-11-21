const _ = require('lodash');

module.exports = (app, options) => {
	const { getDbData } = app.require('@hackolade/ddl-fe-utils').general;
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
