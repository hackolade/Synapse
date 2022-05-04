module.exports = (app, options) => {
	const _ = app.require('lodash');
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
